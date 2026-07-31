"""Grove — study room endpoints.

Replaces three `pass`-bodied stubs. A Flask view that returns None raises
"View function did not return a valid response", so every one of these URLs
answered 500 — the Lobby and Rooms pages had nothing to call.
"""

from flask import Blueprint, jsonify

from api.models import DEFAULT_ROOM_THEME, MAX_ROOM_CAPACITY, ROOM_THEMES
from api.services import room as room_service
from api.utils.auth import current_user, require_user
from api.utils.validation import json_body, pagination_args, validate

rooms_bp = Blueprint("rooms", __name__, url_prefix="/api/rooms")


@rooms_bp.get("")
@require_user
def list_rooms():
    limit, offset = pagination_args(default_limit=50, max_limit=100)
    rooms = room_service.list_rooms(current_user(), limit=limit, offset=offset)
    return jsonify(
        {
            "items": [room.to_dict(include_members=False) for room in rooms],
            "themes": list(ROOM_THEMES),
        }
    )


@rooms_bp.get("/lobby")
@require_user
def get_lobby():
    """The global study room, created on first access."""
    return jsonify(room_service.lobby_snapshot(current_user()))


@rooms_bp.post("/lobby/join")
@require_user
def join_lobby():
    account = current_user()
    room = room_service.ensure_global_room()
    room_service.join(account, room)
    return jsonify(room_service.lobby_snapshot(account))


@rooms_bp.post("/lobby/leave")
@require_user
def leave_lobby():
    account = current_user()
    room_service.leave(account, room_service.ensure_global_room())
    return jsonify(room_service.lobby_snapshot(account))


@rooms_bp.post("")
@require_user
def create_room():
    body = json_body()

    fields = validate(body)
    name = fields.string("name", required=True, min_length=2, max_length=120)
    theme = fields.one_of("theme", ROOM_THEMES) or DEFAULT_ROOM_THEME
    capacity = fields.integer("capacity", default=None, minimum=1, maximum=MAX_ROOM_CAPACITY)
    fields.raise_if_invalid()

    room = room_service.create_room(
        current_user(), name=name, theme=theme, capacity=capacity
    )
    return jsonify(room.to_dict()), 201


@rooms_bp.get("/<int:room_id>")
@require_user
def get_room(room_id):
    account = current_user()
    room = room_service.get_room(room_id)
    return jsonify(
        {
            "room": room.to_dict(),
            "joined": room_service.membership_for(account, room) is not None,
            "is_host": room.host_id == account.id,
        }
    )


@rooms_bp.post("/<int:room_id>/join")
@require_user
def join_room(room_id):
    account = current_user()
    room = room_service.get_room(room_id)
    room_service.join(account, room)
    return jsonify({"room": room.to_dict(), "joined": True})


@rooms_bp.post("/<int:room_id>/leave")
@require_user
def leave_room(room_id):
    account = current_user()
    room = room_service.get_room(room_id)
    room_service.leave(account, room)
    return jsonify({"room": room.to_dict(), "joined": False})


@rooms_bp.delete("/<int:room_id>")
@require_user
def close_room(room_id):
    room_service.close_room(current_user(), room_service.get_room(room_id))
    return "", 204
