"""
Grove — Streak service.

Streak bumping and the tree-growth/points computation shown on the Streaks
page.
"""

from datetime import date, timedelta

from api.config.database import db
from api.models.streak import Streak
from api.models.task import Task

TREE_THRESHOLDS = [0, 3, 7, 12, 18, 25, 33]


def bump_for_completion(user):
    """Completing a task bumps the streak at most once per calendar day
    (see api/models/streak.py). Same day as last activity -> no change,
    yesterday -> streak continues (+1), anything older -> streak restarts
    at 1. Creates the Streak row on first use rather than at signup, so
    existing users don't need a backfill."""
    streak = user.streak
    if streak is None:
        streak = Streak(user_id=user.id, current_count=0, last_activity_date=None)
        db.session.add(streak)

    today = date.today()
    if streak.last_activity_date == today:
        return
    if streak.last_activity_date == today - timedelta(days=1):
        streak.current_count += 1
    else:
        streak.current_count = 1
    streak.last_activity_date = today


def tree_progress(user):
    """Builds the tree-growth data shown on the Streaks page: points, tree
    level, progress to the next level, and the user's current streak."""
    points = Task.query.filter_by(user_id=user.id, completed=True).count()
    level = sum(1 for threshold in TREE_THRESHOLDS if points >= threshold)

    max_level = len(TREE_THRESHOLDS)
    next_threshold = TREE_THRESHOLDS[level] if level < max_level else points
    points_remaining = max(0, next_threshold - points)

    return {
        "points": points,
        "current_streak": user.streak.current_count if user.streak else 0,
        "last_activity_date": (
            user.streak.last_activity_date.isoformat()
            if user.streak and user.streak.last_activity_date
            else None
        ),
        "tree_level": level,
        "max_tree_level": max_level,
        "next_level_points": next_threshold,
        "points_remaining": points_remaining,
    }
