"""Grove — friendship service.

One row represents the relationship between two people, stored in the
direction it was requested. Everything awkward about this model comes from
that single fact:

* "Am I friends with X" has to check both column orders.
* Only the recipient may accept or decline; only either party may remove.
* A pending request from A to B must block a duplicate request from B to A,
  or the pair ends up with two rows disagreeing about who asked whom.

All three rules live here rather than in the routes, where the third one was
previously enforced by one endpoint and missed by another.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import and_, or_
from sqlalchemy.exc import IntegrityError

from api.config.database import db
from api.models import (
    STATUS_ACCEPTED,
    STATUS_DECLINED,
    STATUS_PENDING,
    Friendship,
    User,
)
from api.utils.errors import BadRequest, Conflict, Forbidden, NotFound
from api.utils.logger import get_logger, scrub

logger = get_logger(__name__)

RESPONDABLE_STATUSES = (STATUS_ACCEPTED, STATUS_DECLINED)


def _pair_filter(a_id: int, b_id: int):
    """Matches the friendship between two users, stored in either direction."""
    return or_(
        and_(Friendship.user_id == a_id, Friendship.friend_id == b_id),
        and_(Friendship.user_id == b_id, Friendship.friend_id == a_id),
    )


def between(a_id: int, b_id: int) -> Friendship | None:
    return db.session.query(Friendship).filter(_pair_filter(a_id, b_id)).first()


def status_between(a_id: int, b_id: int) -> str | None:
    """The status string for a pair, or None if they have no history.

    Used to render the profile's Add Friend button in the right state up
    front, rather than letting the user click it and receive a 409.
    """
    friendship = between(a_id, b_id)
    return friendship.status if friendship else None


def send_request(requester: User, target_id: int) -> Friendship:
    target = db.session.get(User, target_id)
    if target is None:
        raise NotFound("That user does not exist.")

    if target.id == requester.id:
        raise BadRequest("You cannot send yourself a friend request.", code="self_friend")

    existing = between(requester.id, target.id)
    if existing is not None:
        if existing.status == STATUS_ACCEPTED:
            raise Conflict("You are already friends.", code="already_friends")
        if existing.status == STATUS_PENDING:
            # They asked first; treat this as accepting rather than as an
            # error. Two people clicking "Add" on each other should end up
            # friends, which is what they both plainly intended.
            if existing.friend_id == requester.id:
                return respond(requester, existing.id, STATUS_ACCEPTED)
            raise Conflict("That request is already pending.", code="request_pending")
        # Previously declined — allow one fresh attempt by reusing the row,
        # flipped so the new requester owns it.
        existing.user_id = requester.id
        existing.friend_id = target.id
        existing.status = STATUS_PENDING
        existing.responded_at = None
        db.session.commit()
        return existing

    friendship = Friendship(
        user_id=requester.id, friend_id=target.id, status=STATUS_PENDING
    )
    db.session.add(friendship)
    try:
        db.session.commit()
    except IntegrityError:
        # Double-click, or the two users sent requests at the same instant.
        db.session.rollback()
        raced = between(requester.id, target.id)
        if raced is None:
            raise
        return raced

    logger.info(
        "friend request sent",
        extra={"user_id": requester.id, "target_id": target.id},
    )
    return friendship


def list_for_user(
    me: User,
    *,
    status: str = STATUS_ACCEPTED,
    direction: str = "incoming",
    limit: int = 100,
    offset: int = 0,
) -> list[Friendship]:
    """Friendships involving `me`, filtered by status.

    For pending requests the direction matters: "incoming" is what is
    waiting on me, "sent" is what I am waiting on someone else for. For
    accepted friendships direction is meaningless and ignored.
    """
    query = db.session.query(Friendship).filter(Friendship.status == status)

    if status == STATUS_PENDING and direction == "sent":
        query = query.filter(Friendship.user_id == me.id)
    elif status == STATUS_PENDING:
        query = query.filter(Friendship.friend_id == me.id)
    else:
        query = query.filter(
            or_(Friendship.user_id == me.id, Friendship.friend_id == me.id)
        )

    return (
        query.order_by(Friendship.created_at.desc(), Friendship.id.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


def friends_of(me: User) -> list[User]:
    """The accepted friends themselves, rather than the friendship rows."""
    return [f.other_user(me.id) for f in list_for_user(me, status=STATUS_ACCEPTED)]


def online_friend_count(me: User) -> int:
    """How many accepted friends are online right now.

    Computed in Python because online-ness is derived from a timestamp
    (see User.is_online) and expressing the same window in SQL would put
    the same rule in two places that could drift apart.
    """
    return sum(1 for friend in friends_of(me) if friend and friend.is_online)


def respond(me: User, friendship_id: int, new_status: str) -> Friendship:
    if new_status not in RESPONDABLE_STATUSES:
        raise BadRequest(
            f"Status must be one of: {', '.join(RESPONDABLE_STATUSES)}.",
            code="invalid_status",
        )

    friendship = db.session.get(Friendship, friendship_id)
    if friendship is None:
        raise NotFound("Friend request not found.")

    # Only the recipient decides. Without this check, the requester could
    # accept on the other person's behalf.
    if friendship.friend_id != me.id:
        raise Forbidden("Only the person who received this request can respond to it.")

    if friendship.status != STATUS_PENDING:
        raise Conflict(
            "That request has already been answered.", code="already_answered"
        )

    friendship.status = new_status
    friendship.responded_at = datetime.now(timezone.utc)
    db.session.commit()

    logger.info(
        "friend request answered",
        extra={
            "user_id": me.id,
            "friendship_id": friendship.id,
            # Constrained to RESPONDABLE_STATUSES above; scrubbed regardless,
            # for the same reason as in the user service.
            "status": scrub(new_status, limit=20),
        },
    )
    return friendship


def remove(me: User, friendship_id: int) -> None:
    """Unfriend, or cancel a request you sent. Either party may do this."""
    friendship = db.session.get(Friendship, friendship_id)
    if friendship is None:
        raise NotFound("Friendship not found.")

    if me.id not in (friendship.user_id, friendship.friend_id):
        raise Forbidden("You are not part of this friendship.")

    db.session.delete(friendship)
    db.session.commit()
    logger.info("friendship removed", extra={"user_id": me.id, "friendship_id": friendship_id})
