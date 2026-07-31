"""Grove — streak service.

A streak is "how many days in a row have I completed at least one task".
Only three transitions exist, and every one of them is decided by comparing
today against the last recorded day:

    same day      -> already counted, no change
    yesterday     -> the run continues, +1
    anything else -> the run is broken, restart at 1

The rule that finishing a second task today does not count twice is the one
users notice immediately if it is wrong, and it is why `last_activity_date`
exists rather than a naive counter.

Un-completing a task deliberately does NOT undo the day's credit. Habit
trackers universally treat an accidental uncheck as still-earned, and the
alternative — decrementing — cannot be made correct anyway, because the
counter alone cannot tell whether some *other* task also finished today.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from api.config.database import db
from api.models import Streak, StreakDay, Task, User
from api.utils.logger import get_logger

logger = get_logger(__name__)

DEFAULT_HISTORY_DAYS = 91  # ~13 weeks, the width of the heatmap
MAX_HISTORY_DAYS = 366


def get_or_create(account: User) -> Streak:
    """The user's streak row, created on first use.

    Created lazily rather than at signup so existing accounts need no
    backfill migration.
    """
    streak = account.streak
    if streak is None:
        # `user=account` rather than `user_id=account.id` so the in-memory
        # relationship is populated in both directions immediately; the
        # foreign key is filled in on flush.
        streak = Streak(user=account, current_count=0, longest_count=0, total_days=0)
        db.session.add(streak)
        db.session.flush()
    return streak


def record_completion(account: User, *, on_day: date | None = None) -> Streak:
    """Register that `account` completed something on `on_day` (default today).

    Idempotent per day: the second call on the same date changes only the
    day's completion count, never the streak.
    """
    today = on_day or date.today()
    streak = get_or_create(account)

    _record_day(account, today)

    if streak.last_activity_date == today:
        return streak

    if streak.last_activity_date == today - timedelta(days=1):
        streak.current_count += 1
    else:
        streak.current_count = 1

    streak.last_activity_date = today
    streak.total_days += 1
    streak.longest_count = max(streak.longest_count, streak.current_count)

    logger.info(
        "streak advanced",
        extra={"user_id": account.id, "current": streak.current_count},
    )
    return streak


def _record_day(account: User, day: date) -> None:
    """Increment (or create) the per-day history row."""
    entry = (
        db.session.query(StreakDay)
        .filter_by(user_id=account.id, day=day)
        .first()
    )
    if entry is not None:
        entry.completed_count += 1
        return

    entry = StreakDay(user_id=account.id, day=day, completed_count=1)
    db.session.add(entry)
    try:
        db.session.flush()
    except IntegrityError:
        # Two completions landing in the same instant both missed the read
        # above. The unique constraint caught it; fold into the winner.
        db.session.rollback()
        existing = (
            db.session.query(StreakDay).filter_by(user_id=account.id, day=day).first()
        )
        if existing is not None:
            existing.completed_count += 1


def expire_if_broken(account: User) -> Streak:
    """Zero out a streak whose last activity is older than yesterday.

    Without this the stored counter keeps reporting a run that has already
    lapsed until the user happens to complete another task — so somebody who
    stops using the app sees "12 day streak" forever. Read paths call this
    so what is displayed is always what is true right now.
    """
    streak = get_or_create(account)
    if streak.current_count == 0:
        return streak

    cutoff = date.today() - timedelta(days=1)
    if streak.last_activity_date is None or streak.last_activity_date < cutoff:
        logger.info(
            "streak lapsed",
            extra={"user_id": account.id, "was": streak.current_count},
        )
        streak.current_count = 0
    return streak


def history(account: User, *, days: int = DEFAULT_HISTORY_DAYS) -> list[dict]:
    """One entry per day in the window, most recent last.

    Days with no activity are included with a zero count so the frontend can
    render a contiguous heatmap without reconstructing the calendar itself.
    """
    span = max(1, min(days, MAX_HISTORY_DAYS))
    start = date.today() - timedelta(days=span - 1)

    rows = (
        db.session.query(StreakDay)
        .filter(StreakDay.user_id == account.id, StreakDay.day >= start)
        .all()
    )
    by_day = {row.day: row.completed_count for row in rows}

    return [
        {
            "day": (start + timedelta(days=offset)).isoformat(),
            "completed_count": by_day.get(start + timedelta(days=offset), 0),
        }
        for offset in range(span)
    ]


def summary(account: User, *, days: int = DEFAULT_HISTORY_DAYS) -> dict:
    """Everything the Streaks page needs in one round trip."""
    streak = expire_if_broken(account)
    db.session.commit()

    completed_total = (
        db.session.query(func.count(Task.id))
        .filter(Task.user_id == account.id, Task.completed.is_(True))
        .scalar()
        or 0
    )

    return {
        **streak.to_dict(),
        "tasks_completed": completed_total,
        "history": history(account, days=days),
    }
