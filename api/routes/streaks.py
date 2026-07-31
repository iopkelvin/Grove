"""Grove — streak endpoints.

Replaces a `pass`-bodied `/api/streaks/<user_id>` stub. The path parameter
is gone on purpose: a streak is read either for yourself or for a public
profile, and taking a user id from the URL invited exactly the kind of
"whose data is this" confusion the rest of this refactor removes.
"""

from flask import Blueprint, jsonify

from api.services import streak as streak_service
from api.services import task as task_service
from api.services import user as user_service
from api.utils.auth import current_user, optional_user, require_user
from api.utils.validation import query_int

streaks_bp = Blueprint("streaks", __name__, url_prefix="/api/streaks")


@streaks_bp.get("/me")
@require_user
def my_streak():
    """Current count, longest run, day-by-day history and task totals —
    everything the Streaks page draws, in one request."""
    days = query_int("days", default=91, minimum=7, maximum=366)
    account = current_user()

    return jsonify(
        {
            **streak_service.summary(account, days=days),
            "tasks": task_service.stats(account),
        }
    )


@streaks_bp.get("/user/<username>")
@optional_user
def public_streak(username):
    """Another user's streak, as shown on their profile.

    Only the headline numbers: the day-by-day history is a fairly detailed
    record of when somebody is active, and that is theirs.
    """
    account = user_service.require_by_username(username)
    streak = streak_service.expire_if_broken(account)

    return jsonify(
        {
            "username": account.username,
            "current_count": streak.current_count,
            "longest_count": streak.longest_count,
        }
    )
