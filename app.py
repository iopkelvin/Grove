# Kelvin

# app.py
# Entry point for the Flask backend. 
# Serves the app as a pure JSON API for the React frontend to consume.

from flask import Flask, jsonify, request
from flask_cors import CORS
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

with app.app_context(): 
    db.create_all()  # builds all tables in grove.db on startup 

# Auth routes
# Note: Supabase Auth handles actual login/signup/session.
# This route just creates our own `users` row after Supabase signs someone up.
@app.route("/api/users/sync", methods=["POST"])
def sync_user():
    data = request.json
    supabase_id = data.get("supabase_id")
    email = data.get("email")
    username = data.get("username")
    first_name = data.get("first_name").lower() if data.get("first_name") else None
    last_name = data.get("last_name").lower() if data.get("last_name") else None
    display_name = f"{first_name} {last_name}".strip() if first_name or last_name else username

    existing = User.query.filter_by(supabase_id=supabase_id).first()
    if existing:
        return jsonify(existing.to_dict()), 200

    new_user = User(
        supabase_id=supabase_id,
        email=email,
        username=username,
        first_name=first_name,
        last_name=last_name,
        display_name=display_name,
    )
    db.session.add(new_user)
    db.session.commit()
    return jsonify(new_user.to_dict()), 201


# User routes
@app.route("/api/users/<user_id>", methods=["GET"])
def get_user(user_id):
    pass


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

@app.route("/")
def index():
    return {"status": "Grove API is running"}

if __name__ == "__main__":
    app.run(debug=True, port=5000)