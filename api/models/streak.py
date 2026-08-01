"""Grove — Streak models.

`Streak` is one row per user holding the running count. `StreakDay` is one
row per user per day they completed something — the history the Streaks page
draws its heatmap from, and the only way to answer "did I actually do
anything on the 14th?" after the fact.

The counter alone cannot answer that: it is a single number that gets
overwritten, so a missed day silently erases the evidence that the previous
run ever happened. Recording the days as they occur costs one small row per
active day and makes the streak auditable — which also makes it testable.
"""

from datetime import date, timedelta

from api.config.database import db


class Streak(db.Model):
    __tablename__ = "streaks"

    id = db.Column(db.Integer, primary_key=True)

    # unique=True enforces one streak per user.
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )

    current_count = db.Column(db.Integer, default=0, nullable=False)
    # Kept so a broken streak still shows what the user managed before —
    # losing a 40-day run and seeing "1" with no other trace is the fastest
    # way to make somebody stop using a habit tracker.
    longest_count = db.Column(db.Integer, default=0, nullable=False)
    total_days = db.Column(db.Integer, default=0, nullable=False)

    last_activity_date = db.Column(db.Date, nullable=True)

    user = db.relationship("User", back_populates="streak")

    @property
    def is_active_today(self) -> bool:
        return self.last_activity_date == date.today()

    @property
    def is_at_risk(self) -> bool:
        """Streak is alive but today has not been logged yet — what the UI
        needs in order to nudge someone before midnight."""
        return (
            self.current_count > 0
            and self.last_activity_date == date.today() - timedelta(days=1)
        )

    def to_dict(self) -> dict:
        return {
            "user_id": self.user_id,
            "current_count": self.current_count,
            "longest_count": self.longest_count,
            "total_days": self.total_days,
            "last_activity_date": (
                self.last_activity_date.isoformat() if self.last_activity_date else None
            ),
            "active_today": self.is_active_today,
            "at_risk": self.is_at_risk,
        }

    def __repr__(self):
        return f"<Streak user={self.user_id} current={self.current_count}>"


class StreakDay(db.Model):
    """One row per (user, day) on which the user completed at least one task."""

    __tablename__ = "streak_days"

    id = db.Column(db.Integer, primary_key=True)
    # uq_streak_day(user_id, day) indexes user_id as its leading column.
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    day = db.Column(db.Date, nullable=False)
    completed_count = db.Column(db.Integer, default=1, nullable=False)

    user = db.relationship("User")

    # One row per user per day; the count is incremented, not duplicated.
    __table_args__ = (
        db.UniqueConstraint("user_id", "day", name="uq_streak_day"),
    )

    def to_dict(self) -> dict:
        return {"day": self.day.isoformat(), "completed_count": self.completed_count}

    def __repr__(self):
        return f"<StreakDay user={self.user_id} {self.day} x{self.completed_count}>"
