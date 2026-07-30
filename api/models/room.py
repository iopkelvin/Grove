# Kyle

"""
Grove — Room models (study rooms / co-presence).

Backs the Study Room Lobby. There's ONE global room (is_global=True, no host,
no cap) that everyone can join, plus user-created rooms a user hosts and
invites friends to. A user is in many rooms and a room holds many users, so
membership is a separate join table. Co-presence for now = the set of member
avatars + a population count; something richer can come later.
"""

from datetime import datetime, timezone

from api.config.database import db


def utcnow():
    return datetime.now(timezone.utc)


class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)

    # The single public room has is_global=True and host_id=None.
    is_global = db.Column(db.Boolean, default=False, nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    memberships = db.relationship(
        "RoomMembership", back_populates="room", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_global": self.is_global,
            "host_id": self.host_id,
            "population": len(self.memberships),
            # avatars of everyone currently in the room, for co-presence
            "members": [m.user.to_dict() for m in self.memberships],
        }

    def __repr__(self):
        return f"<Room {self.name!r} pop={len(self.memberships)}>"


class RoomMembership(db.Model):
    __tablename__ = "room_memberships"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False)
    joined_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    room = db.relationship("Room", back_populates="memberships")
    user = db.relationship("User")

    # Same user can't join the same room twice.
    __table_args__ = (
        db.UniqueConstraint("user_id", "room_id", name="uq_user_room"),
    )

    def __repr__(self):
        return f"<RoomMembership user={self.user_id} room={self.room_id}>"
