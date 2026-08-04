"""
Grove — User model.

Backs the Profile and Friends pages: name, avatar, bio,
current streak (via Streak), online status, and friends (via Friendship).
"""

from api.config.database import db
from api.utils import utcnow


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    # Auth identity
    # Supabase Auth is the source of truth for login/password; supabase_id
    # links this row to the Supabase user.
    supabase_id = db.Column(db.String(64), unique=True, nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    # Profile (shown on Profile + Friends pages)
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    display_name = db.Column(db.String(80), nullable=True)   # "Kyle Gibson"
    pronouns = db.Column(db.String(30), nullable=True)        # "she/her", or a custom value
    avatar_url = db.Column(db.String(500), nullable=True)
    banner_url = db.Column(db.String(500), nullable=True)
    # Vertical crop offset for the banner image, 0 (top) - 100 (bottom).
    # Lets a banner wider than its frame be repositioned without re-cropping
    # the source file. Defaults to center.
    banner_position_y = db.Column(db.Integer, nullable=False, default=50)
    bio = db.Column(db.Text, nullable=True)

    # Study room the user last visited, for the Home page "continue where
    # you left off" widget. Set on room mount (see /api/rooms/<id>/visit),
    # not on every join — a stale value just means the widget quietly
    # disappears if the room's since been deleted (SET NULL below).
    last_room_id = db.Column(
        db.Integer,
        db.ForeignKey("rooms.id", ondelete="SET NULL", use_alter=True, name="fk_users_last_room_id_rooms"),
        nullable=True,
    )
    last_room_visited_at = db.Column(db.DateTime, nullable=True)

    # "Online now" indicator. Simple boolean for now; if you later want
    # auto-timeout, swap this for a last_seen DateTime and compute online-ness.
    is_online = db.Column(db.Boolean, default=False, nullable=False)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    # Relationships
    tasks = db.relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    streak = db.relationship(
        "Streak", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    # user.tags (their tag set) comes from a backref on Tag.
    # Friendships and room memberships are reached via their own models.

    def to_dict(self):
        return {
            "id": self.id,
            "supabase_id": self.supabase_id,
            "username": self.username,
            "email": self.email,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "display_name": self.display_name,
            "pronouns": self.pronouns,
            "avatar_url": self.avatar_url,
            "banner_url": self.banner_url,
            "banner_position_y": self.banner_position_y,
            "bio": self.bio,
            "last_room_id": self.last_room_id,
            "last_room_visited_at": self.last_room_visited_at.isoformat() if self.last_room_visited_at else None,
            "is_online": self.is_online,
            "current_streak": self.streak.current_count if self.streak else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def to_summary_dict(self):
        """Minimal shape for showing this user inline in someone else's
        payload (room members, chat authorship) — not the full profile."""
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "is_online": self.is_online,
        }

    def __repr__(self):
        return f"<User {self.username}>"
