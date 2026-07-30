# Kyle

"""
Grove — Streak model.

One row per user (one-to-one). Completing ANY task on a given day bumps
current_count. last_activity_date is what tells the streak logic whether
the next completion continues the streak (yesterday) or restarts it (older).

highest/longest streak is intentionally left out for now (stretch goal);
it's a one-line column to add if you want it.

NOTE: NEW file — api/models/ has had no streak.py before
"""

from api.config.database import db


class Streak(db.Model):
    __tablename__ = "streaks"

    id = db.Column(db.Integer, primary_key=True)

    # unique=True enforces one streak per user.
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), unique=True, nullable=False
    )

    current_count = db.Column(db.Integer, default=0, nullable=False)
    last_activity_date = db.Column(db.Date, nullable=True)

    user = db.relationship("User", back_populates="streak")

    def to_dict(self):
        return {
            "id": self.id,
            "user_id": self.user_id,
            "current_count": self.current_count,
            "last_activity_date": (
                self.last_activity_date.isoformat() if self.last_activity_date else None
            ),
        }

    def __repr__(self):
        return f"<Streak user={self.user_id} current={self.current_count}>"
