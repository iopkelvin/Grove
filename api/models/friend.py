"""Grove — Friendship model.

Request/accept flow: user_id is the requester, friend_id is the recipient,
and status starts "pending" until the recipient accepts or declines. One row
links two users. Because both columns point at the users table, SQLAlchemy
needs each relationship to name its foreign_keys explicitly — that is the
one non-obvious bit.

Querying "my accepted friends": a friendship may be stored in either
direction, so check both columns — WHERE user_id = me OR friend_id = me.
Querying "my incoming requests" only checks friend_id = me, since only the
recipient can act on a pending request.
"""

from datetime import datetime, timezone

from api.config.database import db

STATUS_PENDING = "pending"
STATUS_ACCEPTED = "accepted"
STATUS_DECLINED = "declined"
FRIENDSHIP_STATUSES = (STATUS_PENDING, STATUS_ACCEPTED, STATUS_DECLINED)


def utcnow():
    return datetime.now(timezone.utc)


class Friendship(db.Model):
    __tablename__ = "friendships"

    id = db.Column(db.Integer, primary_key=True)

    # user_id needs no index of its own: uq_friendship(user_id, friend_id)
    # already indexes it as the leading column. friend_id does, because
    # "requests waiting on me" filters on it alone.
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)

    status = db.Column(db.String(20), nullable=False, default=STATUS_PENDING)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)
    responded_at = db.Column(db.DateTime, nullable=True)

    user = db.relationship("User", foreign_keys=[user_id])
    friend = db.relationship("User", foreign_keys=[friend_id])

    # One friendship per ordered pair. The reverse pair is prevented in
    # application code (services/friend.py checks both directions before
    # inserting) because a database-level constraint on an unordered pair
    # needs an expression index Postgres and SQLite spell differently.
    __table_args__ = (
        db.UniqueConstraint("user_id", "friend_id", name="uq_friendship"),
        db.CheckConstraint("user_id != friend_id", name="ck_friendship_not_self"),
    )

    def other_user(self, me_id: int):
        """Whichever side of this friendship is not `me_id`."""
        return self.friend if self.user_id == me_id else self.user

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "friend_id": self.friend_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "responded_at": self.responded_at.isoformat() if self.responded_at else None,
        }

    def to_row(self, me_id: int) -> dict:
        """The shape the Friends page renders: the friendship plus the
        *other* person, so the UI never has to work out which side is which."""
        other = self.other_user(me_id)
        return {
            "friendship_id": self.id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "is_incoming": self.friend_id == me_id,
            "user": other.to_summary() if other else None,
        }

    def __repr__(self):
        return f"<Friendship {self.user_id}<->{self.friend_id} {self.status}>"
