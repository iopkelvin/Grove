# app.py
# Entry point for the Flask backend.
# Serves the app as a pure JSON API for the React frontend to consume.

import re

from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate

from api.config.database import db, SQLALCHEMY_DATABASE_URI
from api import models
from api.models.room import Room
from api.models.user import User
from api.services import auth as auth_service
from api.services import friend as friend_service
from api.services import room as room_service
from api.services import streak as streak_service
from api.services import task as task_service
from api.services import user as user_service

require_auth = auth_service.require_auth

# App setup
app = Flask(__name__)
CORS(app)  # allow requests from the React dev server

# Config / DB init
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)
migrate = Migrate(app, db)

# Local SQLite auto-creates its tables on startup (zero setup). A real
# database is expected to be managed with `flask db upgrade` migrations
# instead — checked against the resolved URI so a blank DATABASE_URL
# (already treated as "unset" by database.py) doesn't skip auto-create too.
if SQLALCHEMY_DATABASE_URI.startswith("sqlite://"):
    with app.app_context():
        db.create_all()

# Column widths from api/models. Local SQLite ignores them, so anything
# too long for its column only blows up once it reaches Supabase's
# Postgres — as a 500, from input that looked fine in development.
FIELD_LIMITS = {
    "title": 200,
    "name": 120,
    "first_name": 50,
    "last_name": 50,
    "display_name": 80,
    "avatar_url": 500,
    "banner_url": 500,
    "wallpaper_url": 500,
    "body": 500,
}
TAG_LIMIT = 40
ALLOWED_ROOM_SETTINGS = {"campsite", "mars", "poker", "library"}

def over_length(data):
    """The first field that won't fit its column, or None."""
    for field, limit in FIELD_LIMITS.items():
        value = data.get(field)
        if isinstance(value, str) and len(value.strip()) > limit:
            return f"{field} must be {limit} characters or fewer"

    for tag in data.get("tags") or []:
        if isinstance(tag, str) and len(tag.strip()) > TAG_LIMIT:
            return f"tags must be {TAG_LIMIT} characters or fewer"
    return None


def username_seed(requested, email):
    """What to build a handle out of. The client usually sends a username,
    but not always — fall back to the email prefix, then to something
    usable, rather than letting None reach a NOT NULL column."""
    seed = (requested or "").strip() or (email or "").split("@")[0]
    seed = re.sub(r"[^a-z0-9._-]", "", seed.lower())
    return seed[:40] or "grove"



# Auth routes
# Note: Supabase Auth handles actual login/signup/session.
# This route just creates our own `users` row after Supabase signs someone up.
@app.route("/api/users/sync", methods=["POST"])
def sync_user():
    data = request.json or {}
    first_name = data.get("first_name", "").strip().lower()
    last_name = data.get("last_name", "").strip().lower()
    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400

    # A session (and therefore a verifiable token) may not exist yet if the
    # Supabase project requires email confirmation before login — fall back
    # to the client-claimed id only in that case. Once a token is present
    # it always wins over whatever the body claims.
    supabase_id = auth_service.verify_request() or data.get("supabase_id")
    if not supabase_id:
        return jsonify({"error": "supabase_id is required"}), 400

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    user, created = user_service.get_or_create(
        supabase_id=supabase_id,
        email=data.get("email"),
        first_name=first_name,
        last_name=last_name,
        username=username_seed(data.get("username"), data.get("email")),
    )
    return jsonify(user), 201 if created else 200


# User routes
# Looked up by supabase_id since that's the only identifier the frontend
# has after login (it never sees our internal integer id). Must match the
# verified token — nobody can look up (or edit) another user's row here.
@app.route("/api/users/<supabase_id>", methods=["GET"])
@require_auth
def get_user(supabase_id):
    if supabase_id != g.supabase_id:
        return jsonify({"error": "Forbidden"}), 403
    user = user_service.find_by_supabase_id(supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(user.to_dict()), 200


# Public profile lookup by username (the /user/<username> page). Unlike
# get_user above, this can be hit by anyone viewing anyone's profile, so
# email and supabase_id are deliberately left out — your own view already
# gets your email straight from the Supabase session, not from this
# endpoint, and supabase_id would let anyone pivot to get_user (by
# supabase_id) for the full profile, email included.
@app.route("/api/users/by-username/<username>", methods=["GET"])
@require_auth
def get_user_by_username(username):
    user = user_service.find_by_username(username)
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = user.to_dict()
    data.pop("email", None)
    data.pop("supabase_id", None)
    data.update(user_service.public_profile_stats(user))

    viewer = user_service.find_by_supabase_id(g.supabase_id)
    if viewer:
        data["friendship_status"] = friend_service.get_friendship_status(viewer, user)

    return jsonify(data), 200


# Only first_name, last_name, display_name, bio, avatar_url, and banner_url
# are editable here. Email and streak are intentionally never read from the body.
@app.route("/api/users/<supabase_id>", methods=["PATCH"])
@require_auth
def update_user(supabase_id):
    if supabase_id != g.supabase_id:
        return jsonify({"error": "Forbidden"}), 403
    user = user_service.find_by_supabase_id(supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json or {}
    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    updated, error = user_service.update_profile(user, data)
    if error:
        return jsonify({"error": error}), 400
    return jsonify(updated), 200


# Matches username, first name, or last name — the public, searchable
# fields (unlike supabase_id, which is an opaque UUID nobody would type
# in a search box, or email, which is never exposed to other users).
@app.route("/api/users/search", methods=["GET"])
@require_auth
def search_users():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify([]), 200

    viewer = user_service.find_by_supabase_id(g.supabase_id)
    results = user_service.search(query, exclude_supabase_id=g.supabase_id)

    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "friendship_status": friend_service.get_friendship_status(viewer, u) if viewer else None,
        }
        for u in results
    ]), 200


# Room routes
# Global room + rooms the user hosts or is a member of.
@app.route("/api/rooms", methods=["GET"])
@require_auth
def get_rooms():
    user = user_service.find_by_supabase_id(g.supabase_id)
    rooms = room_service.list_visible(user)
    return jsonify([room.to_dict() for room in rooms]), 200


@app.route("/api/rooms", methods=["POST"])
@require_auth
def create_room():
    data = request.json or {}
    host = user_service.find_by_supabase_id(g.supabase_id)
    if not host:
        return jsonify({"error": "User not found"}), 404

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Room name is required"}), 400

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    setting = data.get("setting", "campsite")
    if setting not in ALLOWED_ROOM_SETTINGS:
        return jsonify({"error": "Unknown room setting"}), 400

    try:
        focus_minutes = int(data.get("focus_minutes", 50))
    except (TypeError, ValueError):
        return jsonify({"error": "focus_minutes must be a number"}), 400

    room = room_service.create(
        host,
        name=name,
        setting=setting,
        focus_minutes=focus_minutes,
        music_enabled=bool(data.get("music_enabled", True)),
        chat_enabled=bool(data.get("chat_enabled", True)),
        invite_user_ids=data.get("invite_user_ids", []),
    )
    return jsonify(room.to_dict()), 201


@app.route("/api/rooms/<int:room_id>", methods=["GET"])
@require_auth
def get_room(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404
    return jsonify(room.to_dict()), 200


@app.route("/api/rooms/<int:room_id>", methods=["PATCH"])
@require_auth
def update_room(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    data = request.json or {}

    # Switching setting changes the room's whole look (and ambient sound,
    # on the frontend) — any custom wallpaper belonged to the old setting,
    # so update_setting() clears it rather than leaving a mismatched image.
    if "setting" in data:
        if data["setting"] not in ALLOWED_ROOM_SETTINGS:
            return jsonify({"error": "Unknown room setting"}), 400
        room = room_service.update_setting(room, data["setting"])
        return jsonify(room.to_dict()), 200

    if "wallpaper_url" in data:
        problem = over_length(data)
        if problem:
            return jsonify({"error": problem}), 400
        room = room_service.update_wallpaper(room, data["wallpaper_url"])
        return jsonify(room.to_dict()), 200

    return jsonify({"error": "Nothing to update"}), 400


@app.route("/api/rooms/<int:room_id>/invite", methods=["POST"])
@require_auth
def invite_room_members(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.id != room.host_id:
        return jsonify({"error": "Only the host can invite people to this room"}), 403

    user_ids = (request.json or {}).get("user_ids", [])
    room = room_service.invite_members(room, user_ids)
    return jsonify(room.to_dict()), 200


@app.route("/api/rooms/<int:room_id>", methods=["DELETE"])
@require_auth
def delete_room(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user or user.id != room.host_id:
        return jsonify({"error": "Only the host can delete this room"}), 403

    room_service.delete(room)
    return "", 204


@app.route("/api/rooms/<int:room_id>/members/<int:user_id>", methods=["DELETE"])
@require_auth
def remove_room_member(room_id, user_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user or user.id != room.host_id:
        return jsonify({"error": "Only the host can remove members"}), 403
    if user_id == room.host_id:
        return jsonify({"error": "The host can't be removed"}), 400

    room = room_service.remove_member(room, user_id)
    return jsonify(room.to_dict()), 200


@app.route("/api/rooms/<int:room_id>/visit", methods=["POST"])
@require_auth
def visit_room(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404
    user = user_service.find_by_supabase_id(g.supabase_id)
    room_service.record_visit(user, room)
    return jsonify(user.to_dict()), 200


@app.route("/api/rooms/<int:room_id>/messages", methods=["GET"])
@require_auth
def get_room_messages(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    after_id = request.args.get("after_id", type=int)
    messages = room_service.list_messages(room, after_id=after_id)
    return jsonify([message.to_dict() for message in messages]), 200


@app.route("/api/rooms/<int:room_id>/messages", methods=["POST"])
@require_auth
def create_room_message(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404

    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json or {}
    body = (data.get("body") or "").strip()
    if not body:
        return jsonify({"error": "Message body is required"}), 400
    problem = over_length({"body": body})
    if problem:
        return jsonify({"error": problem}), 400

    message = room_service.send_message(room, user, body)
    return jsonify(message.to_dict()), 201


# Task routes
# Thin routes — DB work lives in api/services/task.py. The one exception is
# the streak bump: a cross-cutting side effect of completion, not a "task"
# concern, and it needs the full User object bump_for_completion() expects.
@app.route("/api/tasks", methods=["GET"])
@require_auth
def get_tasks():
    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    tasks = task_service.list_tasks(user.id)
    completed = request.args.get("completed")
    if completed in ("true", "false"):
        want_completed = completed == "true"
        tasks = [t for t in tasks if t["done"] == want_completed]
    return jsonify(tasks), 200


@app.route("/api/tags", methods=["GET"])
@require_auth
def get_tags():
    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    return jsonify(task_service.list_tags(user.id)), 200


@app.route("/api/tasks", methods=["POST"])
@require_auth
def create_task():
    data = request.json or {}
    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Task title is required"}), 400

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    created = task_service.create_task(
        user.id,
        title=title,
        description=(data.get("description") or None),
        tag_names=data.get("tags"),
        due_date=data.get("due_date"),
        due_time=data.get("due_time"),
        recurring=data.get("recurring", False),
    )
    return jsonify(created), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
@require_auth
def update_task(task_id):
    data = request.json or {}
    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    fields = {
        k: data[k]
        for k in ("title", "description", "completed", "tags", "due_date", "due_time", "recurring")
        if k in data
    }
    # commit=False: `user` was fetched above and hasn't been touched by a
    # commit yet, so bump_for_completion below can still read user.streak
    # without SQLAlchemy silently re-fetching it — then this route does the
    # one commit that covers both changes together.
    updated, became_completed = task_service.update_task(user.id, task_id, fields, commit=False)
    if updated is None:
        return jsonify({"error": "Task not found"}), 404

    if became_completed:
        streak_service.bump_for_completion(user)

    db.session.commit()
    return jsonify(updated), 200


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@require_auth
def delete_task(task_id):
    user = user_service.find_by_supabase_id(g.supabase_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if not task_service.delete_task(user.id, task_id):
        return jsonify({"error": "Task not found"}), 404
    return "", 204


# Friend routes
# A friendship is one row: user_id is whoever sent the request, friend_id
# is the recipient, and status starts "pending" until the recipient
# accepts or declines. Nothing here is instant — see api/models/friend.py.
@app.route("/api/friends", methods=["POST"])
@require_auth
def send_friend_request():
    data = request.json or {}
    requester = user_service.find_by_supabase_id(g.supabase_id)
    if not requester:
        return jsonify({"error": "User not found"}), 404

    target = db.session.get(User, data.get("target_user_id"))
    if not target:
        return jsonify({"error": "Target user not found"}), 404

    if requester.id == target.id:
        return jsonify({"error": "Cannot friend yourself"}), 400

    existing = friend_service.find_between(requester.id, target.id)
    if existing:
        return jsonify({"error": "Friendship already exists", "status": existing.status}), 409

    friendship = friend_service.create(requester.id, target.id)
    return jsonify(friendship.to_dict()), 201


# status: "accepted" (default) or "pending". For "pending", direction
# defaults to "incoming" (requests waiting on me to respond) — pass
# direction=sent to see requests I sent that are still waiting on someone else.
@app.route("/api/friends", methods=["GET"])
@require_auth
def get_friends():
    me = user_service.find_by_supabase_id(g.supabase_id)
    if not me:
        return jsonify({"error": "User not found"}), 404

    status = request.args.get("status", "accepted")
    direction = request.args.get("direction", "incoming")
    pairs = friend_service.list_for_user(me.id, status=status, direction=direction)

    return jsonify([
        {
            "friendship_id": row.id,
            "status": row.status,
            "created_at": row.created_at.isoformat() if row.created_at else None,
            "user": {
                "id": other.id,
                "supabase_id": other.supabase_id,
                "username": other.username,
                "first_name": other.first_name,
                "last_name": other.last_name,
                "display_name": other.display_name,
                "avatar_url": other.avatar_url,
                "is_online": other.is_online,
                "current_streak": other.streak.current_count if other.streak else 0,
            },
        }
        for row, other in pairs
    ]), 200


# Only the recipient (friend_id) can accept or decline.
@app.route("/api/friends/<int:friendship_id>", methods=["PATCH"])
@require_auth
def respond_to_friend_request(friendship_id):
    data = request.json or {}
    me = user_service.find_by_supabase_id(g.supabase_id)
    if not me:
        return jsonify({"error": "User not found"}), 404

    friendship = friend_service.find(friendship_id)
    if not friendship:
        return jsonify({"error": "Friendship not found"}), 404

    if friendship.friend_id != me.id:
        return jsonify({"error": "Only the recipient can respond to this request"}), 403

    new_status = data.get("status")
    if new_status not in ("accepted", "declined"):
        return jsonify({"error": "status must be 'accepted' or 'declined'"}), 400

    friendship.status = new_status
    db.session.commit()
    return jsonify(friendship.to_dict()), 200


# Either side can remove an accepted friendship, or cancel a pending one.
@app.route("/api/friends/<int:friendship_id>", methods=["DELETE"])
@require_auth
def remove_friend(friendship_id):
    me = user_service.find_by_supabase_id(g.supabase_id)
    if not me:
        return jsonify({"error": "User not found"}), 404

    friendship = friend_service.find(friendship_id)
    if not friendship:
        return jsonify({"error": "Friendship not found"}), 404

    if me.id not in (friendship.user_id, friendship.friend_id):
        return jsonify({"error": "Not part of this friendship"}), 403

    db.session.delete(friendship)
    db.session.commit()
    return "", 204


# Streaks / Calendar routes
@app.route("/api/streaks/<user_id>", methods=["GET"])
@require_auth
def get_streaks(user_id):
    user = user_service.find_for_streaks(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404
    if user.supabase_id != g.supabase_id:
        return jsonify({"error": "Forbidden"}), 403
    return jsonify(streak_service.tree_progress(user)), 200


@app.route("/api/calendar/<user_id>", methods=["GET"])
@require_auth
def get_calendar(user_id):
    return jsonify([]), 200


@app.route("/")
def index():
    return {"status": "Grove API is running"}


if __name__ == "__main__":
    app.run(debug=True, port=5000)
