"""
Grove — Friend service.

Data layer for friendships: lookups, requests, and the friends list. Routes
in app.py keep the HTTP-shaped decisions (self-friend / already-exists /
permission / bad-status checks and their status codes); everything that
touches the database lives here, same split as api/services/task.py.
"""

from sqlalchemy.orm import selectinload

from api.config.database import db
from api.models.friend import Friendship
from api.models.user import User


def find_between(user_a_id, user_b_id):
    """The friendship row between these two users, in either direction, or
    None if they have no relationship yet."""
    return Friendship.query.filter(
        db.or_(
            db.and_(Friendship.user_id == user_a_id, Friendship.friend_id == user_b_id),
            db.and_(Friendship.user_id == user_b_id, Friendship.friend_id == user_a_id),
        )
    ).first()


def get_friendship_status(viewer, other_user):
    """None if no relationship exists yet, otherwise the row's status
    ("pending"/"accepted"/"declined"). Used so the frontend can disable
    "Add Friend" up front instead of letting a click hit a 409."""
    if not viewer or not other_user or viewer.id == other_user.id:
        return None
    friendship = find_between(viewer.id, other_user.id)
    return friendship.status if friendship else None


def find(friendship_id):
    return db.session.get(Friendship, friendship_id)


def create(requester_id, target_id):
    friendship = Friendship(user_id=requester_id, friend_id=target_id, status="pending")
    db.session.add(friendship)
    db.session.commit()
    return friendship


def list_for_user(me_id, status="accepted", direction="incoming"):
    """Rows involving this user, plus the "other" user on each row, as
    (friendship, other_user) pairs.

    Eager-loads both sides of the friendship plus each side's streak in a
    handful of batched queries — without this, accessing row.friend/row.user
    and other.streak lazy-loads one query PER friend, which turns a
    24-friend list into ~50 round trips to the database."""
    eager = (
        selectinload(Friendship.user).selectinload(User.streak),
        selectinload(Friendship.friend).selectinload(User.streak),
    )

    if status == "pending":
        if direction == "sent":
            rows = Friendship.query.options(*eager).filter_by(user_id=me_id, status="pending").all()
            return [(row, row.friend) for row in rows]
        rows = Friendship.query.options(*eager).filter_by(friend_id=me_id, status="pending").all()
        return [(row, row.user) for row in rows]

    rows = Friendship.query.options(*eager).filter(
        db.or_(Friendship.user_id == me_id, Friendship.friend_id == me_id),
        Friendship.status == status,
    ).all()
    return [(row, row.friend if row.user_id == me_id else row.user) for row in rows]
