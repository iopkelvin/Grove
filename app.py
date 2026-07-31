# Kelvin

# app.py
# Entry point for the Flask backend. 
# Serves the app as a pure JSON API for the React frontend to consume.

import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_migrate import Migrate
from api.config.database import db, SQLALCHEMY_DATABASE_URI # added by Kyle
from api import models  # added by Kyle -- noqa: F401 — registers all models so tables get created
from api.models.user import User  # Kelvin — needed for the sync route

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
if not os.environ.get("DATABASE_URL"):
    with app.app_context():
        db.create_all()

# Auth routes
# Note: Supabase Auth handles actual login/signup/session.
# This route just creates our own `users` row after Supabase signs someone up.
@app.route("/api/users/sync", methods=["POST"])
def sync_user():
    data = request.json
    supabase_id = data.get("supabase_id")
    email = data.get("email")
    username = data.get("username")
    first_name = data.get("first_name", "").strip().lower()
    last_name = data.get("last_name", "").strip().lower()

    if not first_name or not last_name:
        return jsonify({"error": "first_name and last_name are required"}), 400

    existing = User.query.filter_by(supabase_id=supabase_id).first()
    if existing:
        return jsonify(existing.to_dict()), 200

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
@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    pass

@app.route("/api/tasks", methods=["POST"])
def create_task():
    pass

@app.route("/api/tasks/<task_id>", methods=["PUT"])
def update_task(task_id):
    pass

@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    pass


# Friend routes
@app.route("/api/friends", methods=["GET"])
def get_friends():
    pass

@app.route("/api/friends", methods=["POST"])
def add_friend():
    pass


# Streaks / Calendar routes
@app.route("/api/streaks/<user_id>", methods=["GET"])
def get_streaks(user_id):
    pass

@app.route("/api/calendar/<user_id>", methods=["GET"])
def get_calendar(user_id):
    pass


if __name__ == "__main__":
    app.run(debug=True, port=5000)