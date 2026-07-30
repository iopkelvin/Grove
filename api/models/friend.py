# Kyle

"""
Grove — Friendship model.

Instant friendship for now 
no request/accept flow — we can implement later if we want 
One row links two users. Because both columns point at the users table,
SQLAlchemy needs each relationship to name its foreign_keys explicitly —
that's the one non-obvious bit.

Querying "my friends": a friendship may be stored in either direction, so
check both columns — WHERE user_id = me OR friend_id = me. (If you'd rather
avoid that, write two rows per friendship on creation; pick one approach and
keep it consistent in the service.)
"""

from datetime import datetime, timezone

from api.config.database import db


def utcnow():
    return datetime.now(timezone.utc)


class Friendship(db.Model):
    __tablename__ = "friendships"

    id = db.Column(db.Integer, primary_key=True)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    friend_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)

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
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Friendship {self.user_id}<->{self.friend_id}>"
