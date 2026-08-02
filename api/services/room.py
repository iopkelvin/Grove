"""
Grove — Room service.

Data layer for study rooms: listing and creation. Routes in app.py keep the
validation that produces specific 400s; everything that touches the
database lives here, same split as api/services/task.py.
"""

from sqlalchemy.orm import selectinload

from api.config.database import db
from api.models.room import Room, RoomMembership
from api.models.user import User
from api.utils import utcnow


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
