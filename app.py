# Kelvin

# app.py
# Entry point for the Flask backend. 
# Serves the app as a pure JSON API for the React frontend to consume.

import os
import re
import warnings
from datetime import date, timedelta
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload
from werkzeug.exceptions import HTTPException
from api.config.database import db, SQLALCHEMY_DATABASE_URI # added by Kyle
from api import models  # added by Kyle -- noqa: F401 — registers all models so tables get created
from api.models.user import User  # Kelvin — needed for the sync route
from api.models.friend import Friendship
from api.services import task as task_service # added by Kyle -- tasks service
from api.models.room import Room, RoomMembership
from api.models.streak import Streak
from api.models.task import Task
from api.utils import auth
from api.utils.auth import caller, login_required

# App setup
app = Flask(__name__)
CORS(app) # allow requests from the React dev server

# Config / DB init -- added by Kyle
app.config["SQLALCHEMY_DATABASE_URI"] = SQLALCHEMY_DATABASE_URI
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db.init_app(app)
migrate = Migrate(app, db)

# Zero-setup local SQLite gets its tables auto-created on startup. A real
# database (DATABASE_URL set, e.g. Supabase Postgres) is expected to be
# managed with `flask db upgrade` instead, so schema changes are tracked
# migrations rather than "delete the file and let create_all rebuild it".
# Checked against the resolved URI (not the raw env var) so a blank
# DATABASE_URL — which database.py already treats as unset — doesn't
# accidentally skip auto-create too.
if SQLALCHEMY_DATABASE_URI.startswith("sqlite://"):
    with app.app_context():
        db.create_all()

# Trusted-client mode keeps a fresh clone runnable with no setup. It is not
# a deployment option: without the secret, anyone can act as anyone.
if auth.trusted_client_mode():
    if os.environ.get("FLASK_ENV") == "production":
        raise RuntimeError("SUPABASE_JWT_SECRET must be set when FLASK_ENV=production")
    warnings.warn(
        "SUPABASE_JWT_SECRET is unset — identity is taken from each request "
        "on trust. Fine locally, never in production.",
        stacklevel=2,
    )


def find_user_by_supabase_id(supabase_id):
    return User.query.filter_by(supabase_id=supabase_id).first()


def get_friendship_status(viewer, other_user):
    """None if no relationship exists yet, otherwise the row's status
    ("pending"/"accepted"/"declined"). Used so the frontend can disable
    "Add Friend" up front instead of letting a click hit a 409."""
    if not viewer or not other_user or viewer.id == other_user.id:
        return None
    friendship = Friendship.query.filter(
        db.or_(
            db.and_(Friendship.user_id == viewer.id, Friendship.friend_id == other_user.id),
            db.and_(Friendship.user_id == other_user.id, Friendship.friend_id == viewer.id),
        )
    ).first()
    return friendship.status if friendship else None


def bump_streak_for_completion(user):
    """Completing a task bumps the streak at most once per calendar day
    (see api/models/streak.py). Same day as last activity -> no change,
    yesterday -> streak continues (+1), anything older -> streak restarts
    at 1. Creates the Streak row on first use rather than at signup, so
    existing users don't need a backfill."""
    streak = user.streak
    if streak is None:
        streak = Streak(user_id=user.id, current_count=0, last_activity_date=None)
        db.session.add(streak)

    today = date.today()
    if streak.last_activity_date == today:
        return
    if streak.last_activity_date == today - timedelta(days=1):
        streak.current_count += 1
    else:
        streak.current_count = 1
    streak.last_activity_date = today


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
}
TAG_LIMIT = 40


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


def escape_like(term):
    """% and _ are wildcards in LIKE, and a search box shouldn't reach them
    — searching "%" would otherwise match every user in the table."""
    for char in ("\\", "%", "_"):
        term = term.replace(char, f"\\{char}")
    return term


def username_seed(requested, email):
    """What to build a handle out of. The client usually sends a username,
    but not always — fall back to the email prefix, then to something
    usable, rather than letting None reach a NOT NULL column."""
    seed = (requested or "").strip() or (email or "").split("@")[0]
    seed = re.sub(r"[^a-z0-9._-]", "", seed.lower())
    return seed[:40] or "grove"


def generate_unique_username(base):
    """base is the email prefix picked at signup; two people can easily
    share one (john@gmail.com vs john@yahoo.com), and username is now a
    public, searchable handle, so collisions need a fallback instead of
    tripping the DB's unique constraint."""
    username = base
    suffix = 1
    while User.query.filter_by(username=username).first():
        suffix += 1
        username = f"{base}{suffix}"
    return username


# Auth routes
# Note: Supabase Auth handles actual login/signup/session.
# This route just creates our own `users` row after Supabase signs someone up.
@app.route("/api/users/sync", methods=["POST"])
def sync_user():
    data = request.json or {}
    supabase_id = auth.resolve_supabase_id()
    if not supabase_id:
        return jsonify({"error": "Sign in to do that"}), 401

    email = data.get("email")
    first_name = data.get("first_name", "").strip().lower()
    last_name = data.get("last_name", "").strip().lower()

    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    existing = User.query.filter_by(supabase_id=supabase_id).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    username = generate_unique_username(username_seed(data.get("username"), email))

    new_user = User(
        supabase_id=supabase_id,
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        display_name=f"{first_name} {last_name}",
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify(new_user.to_dict()), 201


# User routes
# Looked up by supabase_id since that's the only identifier the frontend
# has after login (it never sees our internal integer id).
@app.route("/api/users/<supabase_id>", methods=["GET"])
def get_user(supabase_id):
    user = User.query.filter_by(supabase_id=supabase_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = user.to_dict()
    # The friends list hands out supabase_ids, so this route is reachable
    # for anyone you can see. Email is yours alone.
    if auth.resolve_supabase_id((), supabase_id) != user.supabase_id:
        data.pop("email", None)
    return jsonify(data), 200


# Public profile lookup by username (the /user/<username> page). Unlike
# get_user above, this can be hit by anyone viewing anyone's profile, so
# email is deliberately left out — your own view already gets your email
# straight from the Supabase session, not from this endpoint.
@app.route("/api/users/by-username/<username>", methods=["GET"])
def get_user_by_username(username):
    user = User.query.filter(db.func.lower(User.username) == username.lower()).first()
    if not user:
        return jsonify({"error": "User not found"}), 404
    data = user.to_dict()
    data.pop("email", None)

    viewer = caller("viewer_supabase_id")
    if viewer:
        data["friendship_status"] = get_friendship_status(viewer, user)

    return jsonify(data), 200


# Only first_name, last_name, display_name, bio, avatar_url, and banner_url
# are editable here. Email and streak are intentionally never read from the body.
@app.route("/api/users/<supabase_id>", methods=["PATCH"])
@login_required()
def update_user(supabase_id):
    if g.user.supabase_id != supabase_id:
        return jsonify({"error": "You can only edit your own profile"}), 403

    user = g.user
    data = request.json or {}

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    if "first_name" in data:
        first_name = (data.get("first_name") or "").strip().lower()
        if not first_name:
            return jsonify({"error": "first_name cannot be empty"}), 400
        user.first_name = first_name

    if "last_name" in data:
        last_name = (data.get("last_name") or "").strip().lower()
        if not last_name:
            return jsonify({"error": "last_name cannot be empty"}), 400
        user.last_name = last_name

    if "display_name" in data:
        display_name = (data.get("display_name") or "").strip()
        user.display_name = display_name or None

    if "bio" in data:
        bio = (data.get("bio") or "").strip()
        user.bio = bio or None

    if "avatar_url" in data:
        user.avatar_url = (data.get("avatar_url") or "").strip() or None

    if "banner_url" in data:
        user.banner_url = (data.get("banner_url") or "").strip() or None

    db.session.commit()
    return jsonify(user.to_dict()), 200


# Matches username, first name, or last name — the public, searchable
# fields (unlike supabase_id, which is an opaque UUID nobody would type
# in a search box, or email, which is never exposed to other users).
@app.route("/api/users/search", methods=["GET"])
def search_users():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify([]), 200

    like = f"%{escape_like(query)}%"
    search = User.query.filter(
        db.or_(
            User.username.ilike(like, escape="\\"),
            User.first_name.ilike(like, escape="\\"),
            User.last_name.ilike(like, escape="\\"),
        )
    )

    viewer = caller("exclude_supabase_id")
    if viewer:
        search = search.filter(User.supabase_id != viewer.supabase_id)

    results = search.limit(20).all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
            "friendship_status": get_friendship_status(viewer, u) if viewer else None,
        }
        for u in results
    ]), 200


# Room routes
# allows user to get and create rooms. Will add a delete function for functionality later on.
# get_rooms() applies a query retrieving the list of rooms to the supabase.
# create_room() finds the hosts, checks errors and then 
# get_room()  retrieves the room clicked on.
@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    """Return rooms visible to the signed-in user.

    The lobby also has clearly-commented frontend placeholder rooms so a fresh
    database still has something useful to display during design work.
    """
    user = caller()

    query = Room.query
    if user:
        query = query.outerjoin(RoomMembership).filter(
            db.or_(
                Room.is_global.is_(True),
                Room.host_id == user.id,
                RoomMembership.user_id == user.id,
            )
        ).distinct()

    rooms = query.order_by(Room.is_global.desc(), Room.created_at.desc()).all()
    return jsonify([room.to_dict() for room in rooms]), 200


@app.route("/api/rooms", methods=["POST"])
@login_required("host_supabase_id")
def create_room():
    data = request.json or {}
    host = g.user

    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Room name is required"}), 400

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    allowed_settings = {"campsite", "mars", "library"}
    setting = data.get("setting", "campsite")
    if setting not in allowed_settings:
        return jsonify({"error": "Unknown room setting"}), 400

    try:
        focus_minutes = int(data.get("focus_minutes", 50))
    except (TypeError, ValueError):
        return jsonify({"error": "focus_minutes must be a number"}), 400
    focus_minutes = max(5, min(focus_minutes, 180))

    room = Room(
        name=name,
        host_id=host.id,
        setting=setting,
        music_enabled=bool(data.get("music_enabled", True)),
        chat_enabled=bool(data.get("chat_enabled", True)),
        focus_minutes=focus_minutes,
    )
    db.session.add(room)
    db.session.flush()

    member_ids = {host.id}
    for raw_id in data.get("invite_user_ids", []):
        try:
            member_ids.add(int(raw_id))
        except (TypeError, ValueError):
            continue

    valid_users = User.query.filter(User.id.in_(member_ids)).all()
    for member in valid_users:
        db.session.add(RoomMembership(user_id=member.id, room_id=room.id))

    db.session.commit()
    return jsonify(room.to_dict()), 201


@app.route("/api/rooms/<int:room_id>", methods=["GET"])
def get_room(room_id):
    room = db.session.get(Room, room_id)
    if not room:
        return jsonify({"error": "Room not found"}), 404
    return jsonify(room.to_dict()), 200


# Task routes
# Thin routes — everything that touches the database lives in
# api/services/task.py (ownership checks included). The one thing that
# lives here instead is the streak bump: it's a cross-cutting side effect
# of completion, not really a "task" concern, and it needs the full User
# object that bump_streak_for_completion() (above) already expects.
@app.route("/api/tasks", methods=["GET"])
@login_required()
def get_tasks():
    tasks = task_service.list_tasks(g.user.id)
    completed = request.args.get("completed")
    if completed in ("true", "false"):
        want_completed = completed == "true"
        tasks = [t for t in tasks if t["done"] == want_completed]
    return jsonify(tasks), 200


@app.route("/api/tags", methods=["GET"])
@login_required()
def get_tags():
    return jsonify(task_service.list_tags(g.user.id)), 200


@app.route("/api/tasks", methods=["POST"])
@login_required()
def create_task():
    data = request.json or {}

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "Task title is required"}), 400

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    created = task_service.create_task(
        g.user.id,
        title=title,
        description=(data.get("description") or None),
        tag_names=data.get("tags"),
        due_date=data.get("due_date"),
        recurring=data.get("recurring", False),
    )
    return jsonify(created), 201


@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
@login_required()
def update_task(task_id):
    data = request.json or {}
    user = g.user

    problem = over_length(data)
    if problem:
        return jsonify({"error": problem}), 400

    fields = {
        k: data[k]
        for k in ("title", "description", "completed", "tags", "due_date", "recurring")
        if k in data
    }
    # commit=False: `user` was fetched above and hasn't been touched by a
    # commit yet, so bump_streak_for_completion below can still read
    # user.streak without SQLAlchemy silently re-fetching it — then this
    # route does the one commit that covers both changes together.
    updated, became_completed = task_service.update_task(user.id, task_id, fields, commit=False)
    if updated is None:
        return jsonify({"error": "Task not found"}), 404

    if became_completed:
        bump_streak_for_completion(user)

    db.session.commit()
    return jsonify(updated), 200


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
@login_required()
def delete_task(task_id):
    if not task_service.delete_task(g.user.id, task_id):
        return jsonify({"error": "Task not found"}), 404
    return "", 204
# end of task routes


# Friend routes
# A friendship is one row: user_id is whoever sent the request, friend_id
# is the recipient, and status starts "pending" until the recipient
# accepts or declines. Nothing here is instant — see api/models/friend.py.
@app.route("/api/friends", methods=["POST"])
@login_required("requester_supabase_id")
def send_friend_request():
    data = request.json or {}
    requester = g.user

    target = User.query.get(data.get("target_user_id"))
    if not target:
        return jsonify({"error": "Target user not found"}), 404

    if requester.id == target.id:
        return jsonify({"error": "Cannot friend yourself"}), 400

    existing = Friendship.query.filter(
        db.or_(
            db.and_(Friendship.user_id == requester.id, Friendship.friend_id == target.id),
            db.and_(Friendship.user_id == target.id, Friendship.friend_id == requester.id),
        )
    ).first()
    if existing:
        return jsonify({"error": "Friendship already exists", "status": existing.status}), 409

    friendship = Friendship(user_id=requester.id, friend_id=target.id, status="pending")
    db.session.add(friendship)
    db.session.commit()
    return jsonify(friendship.to_dict()), 201


# status: "accepted" (default) or "pending". For "pending", direction
# defaults to "incoming" (requests waiting on me to respond) — pass
# direction=sent to see requests I sent that are still waiting on someone else.
@app.route("/api/friends", methods=["GET"])
@login_required()
def get_friends():
    me = g.user
    status = request.args.get("status", "accepted")

    # Eager-load both sides of the friendship plus each side's streak in a
    # handful of batched queries — without this, accessing row.friend/
    # row.user and other.streak below lazy-loads one query PER friend,
    # which turns a 24-friend list into ~50 round trips to the database.
    eager = (selectinload(Friendship.user).selectinload(User.streak),
             selectinload(Friendship.friend).selectinload(User.streak))

    if status == "pending":
        direction = request.args.get("direction", "incoming")
        if direction == "sent":
            rows = Friendship.query.options(*eager).filter_by(user_id=me.id, status="pending").all()
            pairs = [(row, row.friend) for row in rows]
        else:
            rows = Friendship.query.options(*eager).filter_by(friend_id=me.id, status="pending").all()
            pairs = [(row, row.user) for row in rows]
    else:
        rows = Friendship.query.options(*eager).filter(
            db.or_(Friendship.user_id == me.id, Friendship.friend_id == me.id),
            Friendship.status == status,
        ).all()
        pairs = [(row, row.friend if row.user_id == me.id else row.user) for row in rows]

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
@login_required()
def respond_to_friend_request(friendship_id):
    data = request.json or {}
    me = g.user

    friendship = Friendship.query.get(friendship_id)
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
@login_required()
def remove_friend(friendship_id):
    me = g.user
    friendship = Friendship.query.get(friendship_id)
    if not friendship:
        return jsonify({"error": "Friendship not found"}), 404

    if me.id not in (friendship.user_id, friendship.friend_id):
        return jsonify({"error": "Not part of this friendship"}), 403

    db.session.delete(friendship)
    db.session.commit()
    return "", 204


# Streaks / Calendar routes
# gets_streaks retrieves the streaks from the supabase database.
# gret_streaks also updates and implements the streaks in the app.
TREE_THRESHOLDS = [0, 3, 7, 12, 18, 25, 33] # thresholds before tree is upgraded


@app.route("/api/streaks/<user_id>", methods=["GET"])
def get_streaks(user_id):
    # The route accepts the Supabase UUID used by the frontend. Supporting the
    # internal numeric id too makes the endpoint convenient for local testing.
    user = find_user_by_supabase_id(user_id)
    if not user and str(user_id).isdigit():
        user = db.session.get(User, int(user_id))
    if not user:
        return jsonify({"error": "User not found"}), 404

    points = Task.query.filter_by(user_id=user.id, completed=True).count()
    level = 1
    for index, threshold in enumerate(TREE_THRESHOLDS, start=1):
        if points >= threshold:
            level = index

    max_level = len(TREE_THRESHOLDS)
    next_threshold = TREE_THRESHOLDS[level] if level < max_level else points
    points_remaining = max(0, next_threshold - points)

    return jsonify({
        "points": points,
        "current_streak": user.streak.current_count if user.streak else 0,
        "last_activity_date": (
            user.streak.last_activity_date.isoformat()
            if user.streak and user.streak.last_activity_date
            else None
        ),
        "tree_level": level,
        "max_tree_level": max_level,
        "next_level_points": next_threshold,
        "points_remaining": points_remaining,
    }), 200


@app.route("/api/calendar/<user_id>", methods=["GET"])
def get_calendar(user_id):
    return jsonify([]), 200

@app.route("/")
def index():
    return {"status": "Grove API is running"}


# Errors
# Flask's default error page is HTML, which breaks a JSON client twice:
# once on the request, and again when res.json() chokes on the apology.
@app.errorhandler(HTTPException)
def handle_http_error(error):
    return jsonify({"error": error.description}), error.code


@app.errorhandler(IntegrityError)
def handle_integrity_error(error):
    # Nearly always a double-click racing itself, not a server fault.
    db.session.rollback()
    return jsonify({"error": "That already exists"}), 409


@app.errorhandler(Exception)
def handle_unexpected_error(error):
    if app.testing or app.debug:
        raise error
    db.session.rollback()
    app.logger.exception("Unhandled error")
    return jsonify({"error": "Something went wrong"}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)