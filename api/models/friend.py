"""
Grove — Friendship model.

Request/accept flow: user_id is the requester, friend_id is the recipient,
and status starts "pending" until the recipient accepts or declines it.
One row links two users. Because both columns point at the users table,
SQLAlchemy needs each relationship to name its foreign_keys explicitly —
that's the one non-obvious bit.

Querying "my accepted friends": a friendship may be stored in either
direction, so check both columns — WHERE user_id = me OR friend_id = me.
Querying "my incoming requests" only checks friend_id = me, since only the
recipient can act on a pending request.
"""

from api.config.database import db
from api.utils import utcnow


class Friendship(db.Model):
    __tablename__ = "friendships"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

    # "pending" | "accepted" | "declined"
    status = db.Column(db.String(20), nullable=False, default="pending")

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    user = db.relationship("User", foreign_keys=[user_id])
    friend = db.relationship("User", foreign_keys=[friend_id])

    # One friendship per ordered pair.
    __table_args__ = (
        db.UniqueConstraint("user_id", "friend_id", name="uq_friendship"),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "friend_id": self.friend_id,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Friendship {self.user_id}<->{self.friend_id}>"
