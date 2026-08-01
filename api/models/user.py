"""Grove — User model.

Backs the Profile, Friends and Lobby pages: name, avatar, bio, current
streak (via Streak), presence, and friends (via Friendship).
"""

from datetime import datetime, timedelta, timezone

from api.config.database import db

# How long after their last authenticated request a user still counts as
# "online". Long enough to survive a page navigation or a slow read, short
# enough that a closed tab drops off the Lobby within a couple of minutes.
ONLINE_WINDOW = timedelta(minutes=5)


def utcnow():
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)

    # ── Auth identity ───────────────────────────────────────────────────
    # Supabase Auth is the source of truth for login and passwords;
    # supabase_id links this row to the Supabase user. There is deliberately
    # no password column: storing credentials this service never checks
    # would be a liability with no upside.
    # unique=True already creates the index both backends need; adding
    # index=True on top would build a second, redundant one.
    supabase_id = db.Column(db.String(64), unique=True, nullable=False)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)

    # ── Profile ─────────────────────────────────────────────────────────
    first_name = db.Column(db.String(50), nullable=False)
    last_name = db.Column(db.String(50), nullable=False)
    display_name = db.Column(db.String(80), nullable=True)
    avatar_url = db.Column(db.String(500), nullable=True)
    banner_url = db.Column(db.String(500), nullable=True)
    bio = db.Column(db.Text, nullable=True)

    # ── Presence ────────────────────────────────────────────────────────
    # Was a plain `is_online` boolean that nothing ever set to True, so the
    # Friends and Lobby pages showed everyone permanently offline. A
    # timestamp touched on each authenticated request needs no "user closed
    # the tab" event to stay accurate — see `is_online` below.
    last_seen_at = db.Column(db.DateTime, nullable=True)

    # Lets a user hide their presence without logging out (Settings page).
    show_online_status = db.Column(db.Boolean, default=True, nullable=False)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    # ── Relationships ───────────────────────────────────────────────────
    tasks = db.relationship("Task", back_populates="owner", cascade="all, delete-orphan")
    streak = db.relationship(
        "Streak", back_populates="user", uselist=False, cascade="all, delete-orphan"
    )
    # user.tags (their tag set) comes from a backref on Tag.
    # Friendships and room memberships are reached via their own models.

    # ── Derived state ───────────────────────────────────────────────────

    @property
    def is_online(self) -> bool:
        """Seen recently, and willing to be seen."""
        if not self.show_online_status or self.last_seen_at is None:
            return False
        last_seen = self.last_seen_at
        # Rows written before this column existed — and SQLite generally —
        # hand back naive datetimes. Compare in UTC either way rather than
        # raising "can't subtract offset-naive and offset-aware datetimes".
        if last_seen.tzinfo is None:
            last_seen = last_seen.replace(tzinfo=timezone.utc)
        return utcnow() - last_seen <= ONLINE_WINDOW

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    def touch(self) -> None:
        """Mark the user as active right now."""
        self.last_seen_at = utcnow()

    # ── Serialisation ───────────────────────────────────────────────────

    def to_dict(self, *, include_email: bool = False) -> dict:
        """JSON-safe view.

        Email is opt-in rather than opt-out. It used to be included by
        default and stripped by the one endpoint that remembered to — which
        meant the room roster, built from the same method, published every
        member's address to everyone in the room.
        """
        data = {
            "id": self.id,
            "supabase_id": self.supabase_id,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "display_name": self.display_name,
            "avatar_url": self.avatar_url,
            "banner_url": self.banner_url,
            "bio": self.bio,
            "is_online": self.is_online,
            "current_streak": self.streak.current_count if self.streak else 0,
            "longest_streak": self.streak.longest_count if self.streak else 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_email:
            data["email"] = self.email
        return data

    def to_summary(self) -> dict:
        """The compact shape used in lists — search results, friend rows,
        room rosters. Never includes email or bio."""
        return {
            "id": self.id,
            "username": self.username,
            "display_name": self.display_name or self.full_name,
            "avatar_url": self.avatar_url,
            "is_online": self.is_online,
            "current_streak": self.streak.current_count if self.streak else 0,
        }

    def __repr__(self):
        return f"<User {self.username}>"
