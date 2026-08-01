"""Grove — Room models (study rooms / co-presence).

Backs the Lobby and Rooms pages. There is ONE global room (is_global=True,
no host, no cap) that everyone can join, plus user-created rooms that a user
hosts and friends can join. A user is in many rooms and a room holds many
users, so membership is its own table.

Co-presence is the set of members who are currently online plus a population
count. "Currently online" is derived from User.last_seen_at rather than
stored, because there is no reliable "user closed the tab" event to write.
"""

from datetime import datetime, timezone

from api.config.database import db

# Theme drives the artistic representation of the room on the frontend.
ROOM_THEMES = ("grove", "library", "cafe", "night", "garden")
DEFAULT_ROOM_THEME = "grove"

GLOBAL_ROOM_NAME = "The Grove"
MAX_ROOM_CAPACITY = 50


def utcnow():
    return datetime.now(timezone.utc)


class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)

    # The single public room has is_global=True and host_id=None.
    is_global = db.Column(db.Boolean, default=False, nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    theme = db.Column(db.String(20), default=DEFAULT_ROOM_THEME, nullable=False)
    # NULL means unlimited, which is what the global room uses.
    capacity = db.Column(db.Integer, nullable=True)

    # Turner's room preferences, from the Create Study Room dialog
    # (migration e4b7d28c6f31). Kept exactly as they are on `development`.
    #
    # `setting` and `theme` overlap: both name the room's visual style, and
    # they arrived from two branches at once with different vocabularies
    # ("campsite" vs "grove"/"library"/…). Consolidating them is a product
    # decision, so both are preserved here and the PR flags it rather than
    # one of us silently deleting the other's column.
    setting = db.Column(db.String(40), default="campsite", nullable=False)
    music_enabled = db.Column(db.Boolean, default=True, nullable=False)
    chat_enabled = db.Column(db.Boolean, default=True, nullable=False)
    focus_minutes = db.Column(db.Integer, default=50, nullable=False)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    memberships = db.relationship(
        "RoomMembership",
        back_populates="room",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
    host = db.relationship("User", foreign_keys=[host_id])

    @property
    def population(self) -> int:
        """How many members are actually present, not how many ever joined.

        The old implementation returned `len(self.memberships)`, so a room
        anyone had ever visited reported them as permanently present and the
        Lobby's population count only ever went up.
        """
        return sum(1 for m in self.memberships if m.user and m.user.is_online)

    @property
    def is_full(self) -> bool:
        return self.capacity is not None and self.population >= self.capacity

    def to_dict(self, *, include_members: bool = True) -> dict:
        data = {
            "id": self.id,
            "name": self.name,
            "is_global": self.is_global,
            "host_id": self.host_id,
            "host_username": self.host.username if self.host else None,
            "theme": self.theme,
            "capacity": self.capacity,
            # Turner's preferences, kept in the payload his frontend reads.
            "setting": self.setting,
            "music_enabled": self.music_enabled,
            "chat_enabled": self.chat_enabled,
            "focus_minutes": self.focus_minutes,
            "population": self.population,
            "is_full": self.is_full,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_members:
            # to_summary(), not to_dict() — the roster is visible to every
            # member of the room and must not carry anyone's email address.
            data["members"] = [
                m.user.to_summary() for m in self.memberships if m.user and m.user.is_online
            ]
        return data

    def __repr__(self):
        return f"<Room {self.name!r} pop={self.population}>"


class RoomMembership(db.Model):
    __tablename__ = "room_memberships"

    id = db.Column(db.Integer, primary_key=True)
    # uq_user_room(user_id, room_id) indexes user_id; room_id needs its own
    # for "who is in this room".
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    room_id = db.Column(db.Integer, db.ForeignKey("rooms.id"), nullable=False, index=True)
    joined_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    room = db.relationship("Room", back_populates="memberships")
    user = db.relationship("User", lazy="joined")

    # The same user cannot join the same room twice.
    __table_args__ = (
        db.UniqueConstraint("user_id", "room_id", name="uq_user_room"),
    )

    def to_dict(self) -> dict:
        return {
            "room_id": self.room_id,
            "user": self.user.to_summary() if self.user else None,
            "joined_at": self.joined_at.isoformat() if self.joined_at else None,
        }

    def __repr__(self):
        return f"<RoomMembership user={self.user_id} room={self.room_id}>"
