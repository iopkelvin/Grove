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

# turner changes to the class
# added new room columns for different maps and features for each of the rooms
# documentation: https://flask-sqlalchemy.palletsprojects.com/en/stable/models/
# https://docs.sqlalchemy.org/en/20/core/metadata.html#sqlalchemy.schema.Column)
# [SQLAlchemy types](https://docs.sqlalchemy.org/en/20/core/type_basics.html
class Room(db.Model):
    __tablename__ = "rooms"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)

    # The single public room has is_global=True and host_id=None.
    is_global = db.Column(db.Boolean, default=False, nullable=False)
    host_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    # turner change - MVP room settings selected in the Create Study Room dialog.
    setting = db.Column(db.String(40), default="campsite", nullable=False)
    music_enabled = db.Column(db.Boolean, default=True, nullable=False)
    chat_enabled = db.Column(db.Boolean, default=True, nullable=False)
    focus_minutes = db.Column(db.Integer, default=50, nullable=False)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)


    memberships = db.relationship(
        "RoomMembership", back_populates="room", cascade="all, delete-orphan"
    )
    
# added more features the the room toggleability
# added more security to the fields making sure that only specific fields were normalized.
# DOCUMENTATION:
# [Flask JSON responses](https://flask.palletsprojects.com/en/stable/quickstart/#apis-with-json)
# [SQLAlchemy relationship API](https://docs.sqlalchemy.org/en/20/orm/relationship_api.html
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "is_global": self.is_global,
            "host_id": self.host_id,
            # added features - turner
            "setting": self.setting,
            "music_enabled": self.music_enabled,
            "chat_enabled": self.chat_enabled,
            "focus_minutes": self.focus_minutes,

            "population": len(self.memberships),
            # avatars of everyone currently in the room, for co-presence
            # turner change - specified the specific attributes that should be allowed.
            "members": [
                {
                    "id": membership.user.id,
                    "username": membership.user.username,
                    "display_name": membership.user.display_name,
                    "avatar_url": membership.user.avatar_url,
                    "is_online": membership.user.is_online,
                }
                for membership in self.memberships
            ],
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
