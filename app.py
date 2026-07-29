# Kelvin

# app.py
# Entry point for the Flask backend. 
# Serves the app as a pure JSON API for the React frontend to consume.

from flask import Flask, jsonify, request
from flask_cors import CORS

# App setup
app = Flask(__name__)
CORS(app) # allow requests from the React dev server

# Config / DB init


# Auth routes
@app.route("/api/signup", methods=["POST"])
def signup():
    pass

@app.route("/api/login", methods=["POST"])
def login():
    pass

@app.route("/api/logout", methods=["POST"])
def logout():
    pass


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


if __name__ == "__main__":
    app.run(debug=True, port=5000)