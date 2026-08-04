"""
Grove — Room service.

Data layer for study rooms: listing, creation, and chat. Routes in app.py
keep the validation that produces specific 400s; everything that touches
the database lives here, same split as api/services/task.py.
"""

from sqlalchemy.orm import selectinload

from api.config.database import db
from api.models.room import Room, RoomMembership, RoomMessage
from api.models.user import User
from api.utils import utcnow

MESSAGE_PAGE_SIZE = 50


def list_visible(user=None):
    """Rooms visible to the signed-in user: the global room, rooms they
    host, and rooms they're a member of. With no user, returns every room
    (used for local/dev browsing without auth).

    Eager-loads memberships and each member's user row — without this,
    listing N rooms issues roughly one extra query per room (plus one per
    membership) to build each room's `to_dict()`, the same N+1 pattern
    list_for_user avoids for friends."""
    query = Room.query.options(selectinload(Room.memberships).selectinload(RoomMembership.user))
    if user:
        query = query.outerjoin(RoomMembership).filter(
            db.or_(
                Room.is_global.is_(True),
                Room.host_id == user.id,
                RoomMembership.user_id == user.id,
            )
        ).distinct()
    return query.order_by(Room.is_global.desc(), Room.created_at.desc()).all()


def create(host, name, setting, focus_minutes, music_enabled, chat_enabled, invite_user_ids):
    focus_minutes = max(5, min(focus_minutes, 180))

    room = Room(
        name=name,
        host_id=host.id,
        setting=setting,
        music_enabled=music_enabled,
        chat_enabled=chat_enabled,
        focus_minutes=focus_minutes,
    )
    db.session.add(room)
    db.session.flush()

    member_ids = {host.id}
    for raw_id in invite_user_ids or []:
        try:
            member_ids.add(int(raw_id))
        except (TypeError, ValueError):
            continue

    valid_users = User.query.filter(User.id.in_(member_ids)).all()
    for member in valid_users:
        db.session.add(RoomMembership(user_id=member.id, room_id=room.id))

    db.session.commit()
    return room


def record_visit(user, room):
    """Marks room as the user's most recently visited, for the Home page
    "continue where you left off" widget. Doesn't touch RoomMembership —
    visiting isn't the same as being a member (e.g. the global room)."""
    user.last_room_id = room.id
    user.last_room_visited_at = utcnow()
    db.session.commit()


def update_wallpaper(room, wallpaper_url):
    room.wallpaper_url = wallpaper_url
    db.session.commit()
    return room


def update_setting(room, setting):
    room.setting = setting
    room.wallpaper_url = None
    db.session.commit()
    return room


def delete(room):
    # Messages have no cascade relationship to Room, so delete them first.
    RoomMessage.query.filter_by(room_id=room.id).delete()
    db.session.delete(room)
    db.session.commit()


def remove_member(room, user_id):
    RoomMembership.query.filter_by(room_id=room.id, user_id=user_id).delete()
    db.session.commit()
    return room


def invite_members(room, user_ids):
    """Adds RoomMembership rows for the given user ids, skipping anyone
    already a member. Non-numeric ids are silently skipped, same as
    room creation."""
    candidate_ids = set()
    for raw_id in user_ids or []:
        try:
            candidate_ids.add(int(raw_id))
        except (TypeError, ValueError):
            continue

    existing_ids = {row.user_id for row in RoomMembership.query.filter_by(room_id=room.id).all()}
    new_ids = candidate_ids - existing_ids
    if new_ids:
        for member in User.query.filter(User.id.in_(new_ids)).all():
            db.session.add(RoomMembership(user_id=member.id, room_id=room.id))
        db.session.commit()
    return room


def list_messages(room, after_id=None):
    """Messages for the room, oldest first. With `after_id`, returns only
    messages newer than it (for polling just what's new); without it,
    returns the most recent page of history."""
    query = RoomMessage.query.filter_by(room_id=room.id)
    if after_id:
        return (
            query.filter(RoomMessage.id > after_id)
            .order_by(RoomMessage.id.asc())
            .limit(MESSAGE_PAGE_SIZE)
            .all()
        )
    recent = query.order_by(RoomMessage.id.desc()).limit(MESSAGE_PAGE_SIZE).all()
    return list(reversed(recent))


def send_message(room, user, body):
    message = RoomMessage(room_id=room.id, user_id=user.id, body=body)
    db.session.add(message)
    db.session.commit()
    return message
