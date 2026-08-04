"""
Grove — Room models (study rooms / co-presence).

Backs the Study Room Lobby. There's ONE global room (is_global=True, no host,
no cap) that everyone can join, plus user-created rooms a user hosts and
invites friends to. A user is in many rooms and a room holds many users, so
membership is a separate join table. Co-presence for now = the set of member
avatars + a population count; something richer can come later.
"""

from api.config.database import db
from api.utils import utcnow


class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)

    # The single public room has is_global=True and host_id=None.
    is_global = db.Column(db.Boolean, default=False, nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    # MVP room settings selected in the Create Study Room dialog.
    setting = db.Column(db.String(40), default="campsite", nullable=False)
    music_enabled = db.Column(db.Boolean, default=True, nullable=False)
    chat_enabled = db.Column(db.Boolean, default=True, nullable=False)
    focus_minutes = db.Column(db.Integer, default=50, nullable=False)

    # A custom background the host uploaded; falls back to the setting's
    # curated default art on the frontend when unset.
    wallpaper_url = db.Column(db.String(500), nullable=True)

    memberships = db.relationship(
        "RoomMembership", back_populates="room", cascade="all, delete-orphan"
    )

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_global": self.is_global,
            "host_id": self.host_id,
            "setting": self.setting,
            "music_enabled": self.music_enabled,
            "chat_enabled": self.chat_enabled,
            "focus_minutes": self.focus_minutes,
            "wallpaper_url": self.wallpaper_url,
            "population": len(self.memberships),
            # avatars of everyone currently in the room, for co-presence
            "members": [membership.user.to_summary_dict() for membership in self.memberships],
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


class RoomMessage(db.Model):
    __tablename__ = "room_messages"

    id = db.Column(db.Integer, primary_key=True)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    body = db.Column(db.String(500), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    user = db.relationship("User")

    def to_dict(self):
        return {
            "id": self.id,
            "room_id": self.room_id,
            "body": self.body,
            "created_at": self.created_at.isoformat(),
            "user": self.user.to_summary_dict(),
        }

    def __repr__(self):
        return f"<RoomMessage user={self.user_id} room={self.room_id}>"
