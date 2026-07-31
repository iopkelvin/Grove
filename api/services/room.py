"""Grove — study room service.

Backs the Lobby (one global room everybody shares) and Rooms (rooms a user
hosts). The three routes for this feature were `pass`-bodied stubs, so none
of it existed.

Presence is the interesting part. There is no reliable "user left" event —
browsers close, laptops sleep, networks drop — so membership rows alone
would only ever accumulate and the population count would only ever rise.
Instead a member counts as present when their `last_seen_at` is recent
(see User.is_online), and the background worker sweeps rows that have gone
quiet for much longer.
"""

from __future__ import annotations

from datetime import timedelta

from sqlalchemy import func

from api.config.database import db
from api.models import (
    DEFAULT_ROOM_THEME,
    GLOBAL_ROOM_NAME,
    MAX_ROOM_CAPACITY,
    ROOM_THEMES,
    Room,
    RoomMembership,
    User,
)
from api.models.user import ONLINE_WINDOW, utcnow
from api.utils.errors import Conflict, Forbidden, NotFound, ValidationError
from api.utils.logger import get_logger

logger = get_logger(__name__)

MAX_ROOMS_PER_HOST = 5
# Well past ONLINE_WINDOW: a member who has merely gone quiet stops counting
# towards the population immediately, but their row is only deleted once
# they are clearly gone, so a brief disconnect does not lose their seat.
STALE_MEMBERSHIP_AFTER = timedelta(hours=6)


# ── The global room ─────────────────────────────────────────────────────


def ensure_global_room() -> Room:
    """Get-or-create the single shared room.

    Called on first access rather than seeded by a migration, so a fresh
    database — including the one every test run builds — has a working
    Lobby without any setup step.
    """
    room = db.session.query(Room).filter_by(is_global=True).first()
    if room is not None:
        return room

    room = Room(
        name=GLOBAL_ROOM_NAME,
        is_global=True,
        host_id=None,
        theme=DEFAULT_ROOM_THEME,
        capacity=None,
    )
    db.session.add(room)
    db.session.commit()
    logger.info("global room created", extra={"room_id": room.id})
    return room


# ── Reads ───────────────────────────────────────────────────────────────


def get_room(room_id: int) -> Room:
    room = db.session.get(Room, room_id)
    if room is None:
        raise NotFound("Room not found.")
    return room


def list_rooms(account: User, *, limit: int = 50, offset: int = 0) -> list[Room]:
    """Rooms this user can see: the global one, ones they host, and ones
    they are a member of.

    Deliberately not "every room in the database" — a room somebody made
    for their study group is not a public listing.
    """
    # The global room is created lazily. Without this, a user who opens the
    # Rooms page before anyone has opened the Lobby sees no shared room at
    # all, which reads as a bug rather than as "nobody has been here yet".
    ensure_global_room()

    member_room_ids = (
        db.session.query(RoomMembership.room_id)
        .filter(RoomMembership.user_id == account.id)
        .subquery()
    )

    return (
        db.session.query(Room)
        .filter(
            db.or_(
                Room.is_global.is_(True),
                Room.host_id == account.id,
                Room.id.in_(db.session.query(member_room_ids.c.room_id)),
            )
        )
        .order_by(Room.is_global.desc(), Room.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


def membership_for(account: User, room: Room) -> RoomMembership | None:
    return (
        db.session.query(RoomMembership)
        .filter_by(user_id=account.id, room_id=room.id)
        .first()
    )


# ── Writes ──────────────────────────────────────────────────────────────


def create_room(
    host: User,
    *,
    name: str,
    theme: str = DEFAULT_ROOM_THEME,
    capacity: int | None = None,
) -> Room:
    if theme not in ROOM_THEMES:
        raise ValidationError({"theme": f"Must be one of: {', '.join(ROOM_THEMES)}."})

    if capacity is not None and not (1 <= capacity <= MAX_ROOM_CAPACITY):
        raise ValidationError(
            {"capacity": f"Must be between 1 and {MAX_ROOM_CAPACITY}."}
        )

    hosted = (
        db.session.query(func.count(Room.id))
        .filter(Room.host_id == host.id, Room.is_global.is_(False))
        .scalar()
        or 0
    )
    if hosted >= MAX_ROOMS_PER_HOST:
        raise Conflict(
            f"You can host at most {MAX_ROOMS_PER_HOST} rooms. Close one first.",
            code="room_limit_reached",
        )

    room = Room(
        name=name, is_global=False, host_id=host.id, theme=theme, capacity=capacity
    )
    db.session.add(room)
    db.session.flush()

    # The host is a member of their own room; otherwise creating a room
    # leaves you standing outside it.
    db.session.add(RoomMembership(user_id=host.id, room_id=room.id))
    db.session.commit()

    logger.info("room created", extra={"user_id": host.id, "room_id": room.id})
    return room


def join(account: User, room: Room) -> RoomMembership:
    """Enter a room. Idempotent — re-joining refreshes presence, and the
    frontend can call it on every page load without special-casing."""
    existing = membership_for(account, room)
    if existing is not None:
        account.touch()
        db.session.commit()
        return existing

    if room.is_full:
        raise Conflict("That room is full.", code="room_full")

    membership = RoomMembership(user_id=account.id, room_id=room.id)
    db.session.add(membership)
    account.touch()
    db.session.commit()

    logger.info("room joined", extra={"user_id": account.id, "room_id": room.id})
    return membership


def leave(account: User, room: Room) -> None:
    membership = membership_for(account, room)
    if membership is None:
        # Leaving a room you are not in is already the desired end state.
        return

    db.session.delete(membership)
    db.session.commit()
    logger.info("room left", extra={"user_id": account.id, "room_id": room.id})


def close_room(account: User, room: Room) -> None:
    if room.is_global:
        raise Forbidden("The global room cannot be closed.")
    if room.host_id != account.id:
        raise Forbidden("Only the host can close this room.")

    db.session.delete(room)  # memberships cascade
    db.session.commit()
    logger.info("room closed", extra={"user_id": account.id, "room_id": room.id})


# ── Maintenance ─────────────────────────────────────────────────────────


def sweep_stale_memberships(*, older_than: timedelta = STALE_MEMBERSHIP_AFTER) -> int:
    """Remove memberships whose user has not been seen in a long time.

    Without this, room_memberships grows forever and every room accumulates
    ghosts. Run by the background worker; also safe to call directly.
    """
    cutoff = utcnow() - older_than

    stale = (
        db.session.query(RoomMembership)
        .join(User, User.id == RoomMembership.user_id)
        .filter(db.or_(User.last_seen_at.is_(None), User.last_seen_at < cutoff))
        .filter(RoomMembership.joined_at < cutoff)
        .all()
    )

    for membership in stale:
        db.session.delete(membership)

    if stale:
        db.session.commit()
        logger.info("swept stale room memberships", extra={"count": len(stale)})

    return len(stale)


def lobby_snapshot(account: User) -> dict:
    """Everything the Lobby page renders, in one round trip."""
    room = ensure_global_room()
    return {
        "room": room.to_dict(),
        "joined": membership_for(account, room) is not None,
        "online_window_seconds": int(ONLINE_WINDOW.total_seconds()),
    }
