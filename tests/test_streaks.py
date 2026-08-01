"""Streak counting.

The streak is the feature users notice immediately when it is wrong, and it
is entirely a function of dates — which makes it the part of this codebase
most worth testing directly rather than through the HTTP layer.

`record_completion` takes an explicit day so these tests describe real
calendars instead of monkeypatching the clock.
"""

from datetime import date, timedelta

import pytest

from api.config.database import db
from api.models import StreakDay
from api.services import streak as streak_service

TODAY = date.today()
YESTERDAY = TODAY - timedelta(days=1)


class TestCounting:
    def test_the_first_completion_starts_a_streak(self, user):
        streak = streak_service.record_completion(user)

        assert streak.current_count == 1
        assert streak.last_activity_date == TODAY

    def test_a_second_completion_on_the_same_day_does_not_count_twice(self, user):
        streak_service.record_completion(user)
        streak = streak_service.record_completion(user)

        assert streak.current_count == 1

    def test_consecutive_days_extend_the_streak(self, user):
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=2))
        streak_service.record_completion(user, on_day=YESTERDAY)
        streak = streak_service.record_completion(user, on_day=TODAY)

        assert streak.current_count == 3

    def test_a_gap_restarts_the_streak(self, user):
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=5))
        streak = streak_service.record_completion(user, on_day=TODAY)

        assert streak.current_count == 1

    def test_the_longest_run_survives_a_break(self, user):
        for offset in (4, 3, 2):
            streak_service.record_completion(user, on_day=TODAY - timedelta(days=offset))
        streak = streak_service.record_completion(user, on_day=TODAY)

        assert streak.current_count == 1
        assert streak.longest_count == 3

    def test_total_days_counts_every_active_day(self, user):
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=10))
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=10))
        streak_service.record_completion(user, on_day=TODAY)

        assert user.streak.total_days == 2

    def test_the_streak_row_is_created_lazily(self, user):
        assert user.streak is None

        streak_service.get_or_create(user)

        assert user.streak is not None


class TestLapsing:
    def test_a_streak_that_ended_days_ago_reads_as_zero(self, user):
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=9))

        streak = streak_service.expire_if_broken(user)

        assert streak.current_count == 0

    def test_yesterdays_activity_keeps_the_streak_alive(self, user):
        streak_service.record_completion(user, on_day=YESTERDAY)

        streak = streak_service.expire_if_broken(user)

        assert streak.current_count == 1

    def test_a_streak_alive_but_not_logged_today_is_flagged_at_risk(self, user):
        streak_service.record_completion(user, on_day=YESTERDAY)

        assert user.streak.is_at_risk is True

    def test_a_streak_logged_today_is_not_at_risk(self, user):
        streak_service.record_completion(user)

        assert user.streak.is_at_risk is False
        assert user.streak.is_active_today is True

    def test_a_lapsed_streak_can_be_started_again(self, user):
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=30))
        streak_service.expire_if_broken(user)

        streak = streak_service.record_completion(user, on_day=TODAY)

        assert streak.current_count == 1


class TestHistory:
    def test_one_row_per_active_day(self, user):
        streak_service.record_completion(user, on_day=YESTERDAY)
        streak_service.record_completion(user, on_day=TODAY)
        db.session.commit()

        assert db.session.query(StreakDay).filter_by(user_id=user.id).count() == 2

    def test_repeat_completions_increment_the_days_count(self, user):
        streak_service.record_completion(user)
        streak_service.record_completion(user)
        streak_service.record_completion(user)
        db.session.commit()

        entry = db.session.query(StreakDay).filter_by(user_id=user.id, day=TODAY).one()
        assert entry.completed_count == 3

    def test_history_fills_in_the_quiet_days(self, user):
        """A contiguous window, so the frontend can draw a heatmap without
        reconstructing the calendar itself."""
        streak_service.record_completion(user, on_day=TODAY - timedelta(days=3))
        db.session.commit()

        history = streak_service.history(user, days=7)

        assert len(history) == 7
        assert history[-1]["day"] == TODAY.isoformat()
        assert sum(entry["completed_count"] for entry in history) == 1

    def test_history_window_is_bounded(self, user):
        assert len(streak_service.history(user, days=10_000)) == 366


class TestEndpoints:
    def test_completing_a_task_moves_the_streak_shown_on_the_profile(self, api, make_task):
        task = make_task()

        api.put(f"/api/tasks/{task['id']}", json={"done": True})

        assert api.get("/api/users/me").get_json()["current_streak"] == 1

    def test_the_streaks_page_gets_everything_in_one_request(self, api, make_task):
        task = make_task()
        api.put(f"/api/tasks/{task['id']}", json={"done": True})

        body = api.get("/api/streaks/me").get_json()

        assert body["current_count"] == 1
        assert body["tasks_completed"] == 1
        assert body["tasks"]["completed"] == 1
        assert len(body["history"]) == 91

    def test_the_history_window_is_configurable(self, api):
        assert len(api.get("/api/streaks/me?days=14").get_json()["history"]) == 14

    def test_a_public_streak_shows_numbers_but_not_the_history(self, api, other_user):
        response = api.get(f"/api/streaks/user/{other_user.username}")

        body = response.get_json()
        assert response.status_code == 200
        assert body["current_count"] == 0
        assert "history" not in body

    def test_unknown_username_is_a_clean_404(self, api):
        response = api.get("/api/streaks/user/nobody")

        assert response.status_code == 404
        assert response.get_json()["code"] == "not_found"


@pytest.mark.parametrize(
    ("gap_days", "expected"),
    [(0, 1), (1, 2), (2, 1), (7, 1)],
    ids=["same-day", "consecutive", "one-day-gap", "week-gap"],
)
def test_every_transition(user, gap_days, expected):
    """The whole state machine in one table: same day, next day, and two
    sizes of gap."""
    streak_service.record_completion(user, on_day=TODAY - timedelta(days=gap_days))

    streak = streak_service.record_completion(user, on_day=TODAY)

    assert streak.current_count == expected
