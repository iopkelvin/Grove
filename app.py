# Kelvin

# app.py
# Entry point for the Flask backend. 
# Serves the app as a pure JSON API for the React frontend to consume.

from datetime import date, timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from api.config.database import db, SQLALCHEMY_DATABASE_URI # added by Kyle
from api import models  # added by Kyle -- noqa: F401 — registers all models so tables get created
from api.models.user import User  # Kelvin — needed for the sync route
from api.models.friend import Friendship
from api.models.task import Task, Tag
from api.models.streak import Streak

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

def find_user_by_supabase_id(supabase_id):
    return User.query.filter_by(supabase_id=supabase_id).first()


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
    data = request.json
    supabase_id = data.get("supabase_id")
    email = data.get("email")
    first_name = data.get("first_name", "").strip().lower()
    last_name = data.get("last_name", "").strip().lower()

    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400

    existing = User.query.filter_by(supabase_id=supabase_id).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    username = generate_unique_username(data.get("username"))

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
    return jsonify(user.to_dict()), 200


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

    # Lets the frontend disable "Add Friend" up front instead of letting the
    # user click it and hit a "friendship already exists" error.
    viewer = find_user_by_supabase_id(request.args.get("viewer_supabase_id"))
    if viewer and viewer.id != user.id:
        friendship = Friendship.query.filter(
            db.or_(
                db.and_(Friendship.user_id == viewer.id, Friendship.friend_id == user.id),
                db.and_(Friendship.user_id == user.id, Friendship.friend_id == viewer.id),
            )
        ).first()
        data["friendship_status"] = friendship.status if friendship else None

    return jsonify(data), 200


# Only first_name, last_name, display_name, bio, avatar_url, and banner_url
# are editable here. Email and streak are intentionally never read from the body.
@app.route("/api/users/<supabase_id>", methods=["PATCH"])
def update_user(supabase_id):
    user = User.query.filter_by(supabase_id=supabase_id).first()
    if not user:
        return jsonify({"error": "User not found"}), 404

    data = request.json or {}

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


# Looked up by username — the public, searchable handle (unlike supabase_id,
# which is an opaque UUID nobody would type in a search box).
@app.route("/api/users/search", methods=["GET"])
def search_users():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify([]), 200

    search = User.query.filter(User.username.ilike(f"%{query}%"))

    exclude_supabase_id = request.args.get("exclude_supabase_id")
    if exclude_supabase_id:
        search = search.filter(User.supabase_id != exclude_supabase_id)

    results = search.limit(20).all()
    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url,
        }
        for u in results
    ]), 200


# Room routes
@app.route("/api/rooms", methods=["GET"])
def get_rooms():
    pass

@app.route("/api/rooms", methods=["POST"])
def create_room():
    pass

@app.route("/api/rooms/<room_id>", methods=["GET"])
def get_room(room_id):
    pass


# Task routes
def get_or_create_tags(user, tag_names):
    tags = []
    for name in tag_names:
        name = name.strip()
        if not name:
            continue
        tag = Tag.query.filter_by(user_id=user.id, name=name).first()
        if not tag:
            tag = Tag(user_id=user.id, name=name)
            db.session.add(tag)
        tags.append(tag)
    return tags


@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    user = find_user_by_supabase_id(request.args.get("supabase_id"))
    if not user:
        return jsonify({"error": "User not found"}), 404

    tasks = Task.query.filter_by(user_id=user.id).order_by(Task.created_at.desc()).all()
    return jsonify([t.to_dict() for t in tasks]), 200


@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.json or {}
    user = find_user_by_supabase_id(data.get("supabase_id"))
    if not user:
        return jsonify({"error": "User not found"}), 404

    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400

    task = Task(
        title=title,
        description=(data.get("description") or "").strip() or None,
        user_id=user.id,
        tags=get_or_create_tags(user, data.get("tags") or []),
    )
    db.session.add(task)
    db.session.commit()
    return jsonify(task.to_dict()), 201


# Only the task's owner can update it. Flipping "done" False -> True is
# what bumps the streak; flipping it back off does NOT undo the bump —
# same-day credit stays earned, matching how habit trackers usually treat
# an accidental uncheck.
@app.route("/api/tasks/<int:task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.json or {}
    user = find_user_by_supabase_id(data.get("supabase_id"))
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = Task.query.get(task_id)
    if not task or task.user_id != user.id:
        return jsonify({"error": "Task not found"}), 404

    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return jsonify({"error": "title cannot be empty"}), 400
        task.title = title

    if "description" in data:
        task.description = (data.get("description") or "").strip() or None

    if "tags" in data:
        task.tags = get_or_create_tags(user, data.get("tags") or [])

    if "done" in data:
        newly_completed = bool(data["done"]) and not task.completed
        task.completed = bool(data["done"])
        if newly_completed:
            bump_streak_for_completion(user)

    db.session.commit()
    return jsonify(task.to_dict()), 200


@app.route("/api/tasks/<int:task_id>", methods=["DELETE"])
def delete_task(task_id):
    user = find_user_by_supabase_id(request.args.get("supabase_id"))
    if not user:
        return jsonify({"error": "User not found"}), 404

    task = Task.query.get(task_id)
    if not task or task.user_id != user.id:
        return jsonify({"error": "Task not found"}), 404

    db.session.delete(task)
    db.session.commit()
    return "", 204


# Friend routes
# A friendship is one row: user_id is whoever sent the request, friend_id
# is the recipient, and status starts "pending" until the recipient
# accepts or declines. Nothing here is instant — see api/models/friend.py.
@app.route("/api/friends", methods=["POST"])
def send_friend_request():
    data = request.json or {}
    requester = find_user_by_supabase_id(data.get("requester_supabase_id"))
    if not requester:
        return jsonify({"error": "User not found"}), 404

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
def get_friends():
    me = find_user_by_supabase_id(request.args.get("supabase_id"))
    if not me:
        return jsonify({"error": "User not found"}), 404

    status = request.args.get("status", "accepted")

    if status == "pending":
        direction = request.args.get("direction", "incoming")
        if direction == "sent":
            rows = Friendship.query.filter_by(user_id=me.id, status="pending").all()
            pairs = [(row, row.friend) for row in rows]
        else:
            rows = Friendship.query.filter_by(friend_id=me.id, status="pending").all()
            pairs = [(row, row.user) for row in rows]
    else:
        rows = Friendship.query.filter(
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
                "username": other.username,
                "display_name": other.display_name,
                "avatar_url": other.avatar_url,
                "is_online": other.is_online,
            },
        }
        for row, other in pairs
    ]), 200


# Only the recipient (friend_id) can accept or decline.
@app.route("/api/friends/<int:friendship_id>", methods=["PATCH"])
def respond_to_friend_request(friendship_id):
    data = request.json or {}
    me = find_user_by_supabase_id(data.get("supabase_id"))
    if not me:
        return jsonify({"error": "User not found"}), 404

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
def remove_friend(friendship_id):
    me = find_user_by_supabase_id(request.args.get("supabase_id"))
    if not me:
        return jsonify({"error": "User not found"}), 404

    friendship = Friendship.query.get(friendship_id)
    if not friendship:
        return jsonify({"error": "Friendship not found"}), 404

    if me.id not in (friendship.user_id, friendship.friend_id):
        return jsonify({"error": "Not part of this friendship"}), 403

    db.session.delete(friendship)
    db.session.commit()
    return "", 204


# Streaks / Calendar routes
@app.route("/api/streaks/<user_id>", methods=["GET"])
def get_streaks(user_id):
    pass

@app.route("/api/calendar/<user_id>", methods=["GET"])
def get_calendar(user_id):
    pass

@app.route("/")
def index():
    return {"status": "Grove API is running"}

if __name__ == "__main__":
    app.run(debug=True, port=5000)