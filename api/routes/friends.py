"""Grove — friendship endpoints."""

from flask import Blueprint, jsonify, request

from api.models import FRIENDSHIP_STATUSES, STATUS_ACCEPTED
from api.services import friend as friend_service
from api.utils.auth import current_user, require_user
from api.utils.validation import json_body, pagination_args, validate

friends_bp = Blueprint("friends", __name__, url_prefix="/api/friends")


@friends_bp.get("")
@require_user
def list_friends():
    """Friendships involving the caller.

    `status` defaults to accepted. For pending, `direction=incoming`
    (default) is what is waiting on me and `direction=sent` is what I am
    waiting on somebody else for.
    """
    me = current_user()
    limit, offset = pagination_args(default_limit=100, max_limit=200)

    status = request.args.get("status", STATUS_ACCEPTED)
    if status not in FRIENDSHIP_STATUSES:
        status = STATUS_ACCEPTED

    direction = "sent" if request.args.get("direction") == "sent" else "incoming"

    rows = friend_service.list_for_user(
        me, status=status, direction=direction, limit=limit, offset=offset
    )
    return jsonify([row.to_row(me.id) for row in rows])


@friends_bp.get("/summary")
@require_user
def friends_summary():
    """Counts for the Home page's Friends card — one request instead of
    fetching every friend row and counting them in the browser."""
    me = current_user()
    accepted = friend_service.friends_of(me)
    pending = friend_service.list_for_user(me, status="pending", direction="incoming")

    return jsonify(
        {
            "total": len(accepted),
            "online": sum(1 for friend in accepted if friend and friend.is_online),
            "pending_incoming": len(pending),
        }
    )


@friends_bp.post("")
@require_user
def send_friend_request():
    body = json_body()

    fields = validate(body)
    target_id = fields.integer("target_user_id", required=True, minimum=1)
    fields.raise_if_invalid()

    friendship = friend_service.send_request(current_user(), target_id)
    return jsonify(friendship.to_dict()), 201


@friends_bp.patch("/<int:friendship_id>")
@require_user
def respond_to_request(friendship_id):
    body = json_body()

    fields = validate(body)
    status = fields.one_of("status", ("accepted", "declined"), required=True)
    fields.raise_if_invalid()

    friendship = friend_service.respond(current_user(), friendship_id, status)
    return jsonify(friendship.to_dict())


@friends_bp.delete("/<int:friendship_id>")
@require_user
def remove_friend(friendship_id):
    friend_service.remove(current_user(), friendship_id)
    return "", 204
