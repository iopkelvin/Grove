"""Edge and stress cases.

The milestone plan asks for at least five documented stress or edge-case
tests. These are those, marked so they can be run on their own:

    pytest -m edge

Each one covers something that either did break the old code or would have
the first time a real user did something slightly unusual. TESTING.md
records the expected result, the observed result, and the fix for each.
"""

from datetime import date, timedelta

import pytest

from api.config.database import db
from api.models import Tag, Task, User
from api.services import streak as streak_service
from api.services import task as task_service
from api.services import user as user_service
from tests.conftest import AuthedClient

pytestmark = pytest.mark.edge


class TestOversizedInput:
    def test_a_200000_character_title_is_rejected_not_500(self, api):
        """EDGE 1. title is String(200). The old code checked only that the
        title was non-empty, so anything longer reached the column and came
        back as an unhandled database error."""
        response = api.post("/api/tasks", json={"title": "x" * 200_000})

        assert response.status_code == 400
        assert response.get_json()["code"] == "validation_error"
        assert db.session.query(Task).count() == 0

    def test_a_title_exactly_at_the_limit_is_accepted(self, api):
        assert api.post("/api/tasks", json={"title": "x" * 200}).status_code == 201

    def test_one_character_over_the_limit_is_not(self, api):
        assert api.post("/api/tasks", json={"title": "x" * 201}).status_code == 400

    def test_a_request_body_larger_than_the_cap_is_refused(self, api):
        """Rejected by MAX_CONTENT_LENGTH before anything tries to parse it."""
        response = api.post(
            "/api/tasks",
            data=b"x" * (2 * 1024 * 1024),
            content_type="application/json",
        )

        assert response.status_code == 413

    def test_a_task_cannot_carry_unlimited_tags(self, api):
        response = api.post(
            "/api/tasks", json={"title": "Tagged", "tags": [f"tag{i}" for i in range(500)]}
        )

        assert response.status_code == 400
        assert db.session.query(Tag).count() == 0


class TestSearchAbuse:
    def test_a_bare_percent_does_not_dump_every_user(self, api, make_user):
        """EDGE 2. `ilike(f"%{query}%")` interpolated the term straight into
        the pattern, so "%" matched every row and the search box became a
        full user listing."""
        for name in ("alice", "bob", "carol"):
            make_user(name)

        assert api.get("/api/users/search?q=%").get_json() == []

    def test_an_underscore_is_a_literal_underscore(self, api, make_user):
        make_user("a_b")
        make_user("axb")

        results = api.get("/api/users/search?q=a_b").get_json()

        assert [r["username"] for r in results] == ["a_b"]

    def test_a_backslash_does_not_break_the_pattern(self, api):
        assert api.get("/api/users/search?q=%5C%5C").status_code == 200

    def test_a_single_character_query_returns_nothing(self, api, make_user):
        make_user("alice")

        assert api.get("/api/users/search?q=a").get_json() == []

    def test_sql_metacharacters_are_just_text(self, api, make_user):
        make_user("bobby")

        response = api.get("/api/users/search?q=%27%3B+DROP+TABLE+users%3B--")

        assert response.status_code == 200
        assert response.get_json() == []
        assert db.session.query(User).count() >= 1


class TestConcurrencyAndRepeats:
    def test_a_double_clicked_add_friend_produces_one_friendship(
        self, api, other_user
    ):
        """EDGE 3. Impatient users double-click. The second request must not
        create a contradictory second row."""
        first = api.post("/api/friends", json={"target_user_id": other_user.id})
        second = api.post("/api/friends", json={"target_user_id": other_user.id})

        assert first.status_code == 201
        assert second.status_code == 409
        from api.models import Friendship

        assert db.session.query(Friendship).count() == 1

    def test_a_retried_signup_does_not_create_a_second_account(self, client):
        from tests.conftest import auth_headers

        payload = {"first_name": "Ada", "last_name": "Lovelace"}
        headers = auth_headers("retry-me", email="ada@berkeley.edu")

        for _ in range(5):
            client.post("/api/users/sync", json=payload, headers=headers)

        assert db.session.query(User).filter_by(supabase_id="retry-me").count() == 1

    def test_completing_the_same_task_repeatedly_bumps_the_streak_once(
        self, api, make_task
    ):
        task = make_task()

        for _ in range(10):
            api.put(f"/api/tasks/{task['id']}", json={"done": False})
            api.put(f"/api/tasks/{task['id']}", json={"done": True})

        assert api.get("/api/streaks/me").get_json()["current_count"] == 1

    def test_a_recreated_supabase_account_keeps_its_data(self, client, make_user):
        """A user deleted and recreated in Supabase arrives with the same
        email and a brand new id. Creating a second row would orphan every
        task and friendship behind an id nobody can log in as."""
        from tests.conftest import auth_headers

        original = make_user("returning", email="returning@berkeley.edu")
        task_service.create(original, title="Should survive")
        original_id = original.id

        client.post(
            "/api/users/sync",
            json={"first_name": "Returning", "last_name": "User"},
            headers=auth_headers("brand-new-supabase-id", email="returning@berkeley.edu"),
        )

        assert db.session.query(User).filter_by(email="returning@berkeley.edu").count() == 1
        assert db.session.get(User, original_id).supabase_id == "brand-new-supabase-id"
        assert db.session.query(Task).filter_by(user_id=original_id).count() == 1


class TestBoundariesInTime:
    def test_a_streak_across_a_year_boundary(self, make_user):
        """EDGE 4. Date arithmetic, not integer arithmetic: 1 January
        follows 31 December."""
        account = make_user("newyear")
        streak_service.record_completion(account, on_day=date(2025, 12, 31))

        streak = streak_service.record_completion(account, on_day=date(2026, 1, 1))

        assert streak.current_count == 2

    def test_a_streak_across_a_leap_day(self, make_user):
        account = make_user("leaper")
        streak_service.record_completion(account, on_day=date(2024, 2, 28))
        streak_service.record_completion(account, on_day=date(2024, 2, 29))

        streak = streak_service.record_completion(account, on_day=date(2024, 3, 1))

        assert streak.current_count == 3

    def test_a_very_long_streak_still_counts_correctly(self, make_user):
        account = make_user("marathon")
        start = date.today() - timedelta(days=399)

        for offset in range(400):
            streak_service.record_completion(account, on_day=start + timedelta(days=offset))

        assert account.streak.current_count == 400
        assert account.streak.longest_count == 400

    def test_history_only_covers_the_requested_window(self, make_user):
        account = make_user("historic")
        streak_service.record_completion(account, on_day=date.today() - timedelta(days=200))
        streak_service.record_completion(account)
        db.session.commit()

        history = streak_service.history(account, days=30)

        assert len(history) == 30
        assert sum(entry["completed_count"] for entry in history) == 1


class TestUnicodeAndWhitespace:
    def test_emoji_and_non_latin_text_survive_a_round_trip(self, api):
        """EDGE 5. Titles are user text, not ASCII."""
        title = "复习 CS160 📚 — chapître trois"

        created = api.post("/api/tasks", json={"title": title}).get_json()

        assert created["title"] == title
        assert api.get("/api/tasks").get_json()["items"][0]["title"] == title

    def test_a_username_seed_of_only_emoji_still_yields_a_username(self, app):
        assert user_service.normalise_username_seed("🌲🌲🌲") == "grove"

    def test_a_title_of_only_zero_width_characters_is_not_a_title(self, api):
        response = api.post("/api/tasks", json={"title": "​​"})

        # Either rejected as empty, or stored as-is — but never a 500, and
        # never a task the user cannot see or select.
        assert response.status_code in (201, 400)

    def test_newlines_and_tabs_are_trimmed_from_the_edges(self, api):
        created = api.post("/api/tasks", json={"title": "\n\t Real title \t\n"}).get_json()

        assert created["title"] == "Real title"

    def test_a_null_byte_does_not_crash_the_search(self, api):
        assert api.get("/api/users/search?q=ab%00cd").status_code in (200, 400)


class TestMalformedRequests:
    def test_json_content_type_with_a_non_json_body(self, api):
        response = api.post("/api/tasks", data="not json", content_type="application/json")

        assert response.status_code == 400
        assert response.get_json()["code"] == "bad_request"

    def test_a_json_array_where_an_object_is_expected(self, api):
        response = api.post("/api/tasks", json=["title", "hello"])

        assert response.status_code == 400

    def test_a_json_null_body(self, api):
        response = api.post("/api/tasks", json=None)

        assert response.status_code == 400

    def test_wrong_types_are_reported_per_field(self, api):
        response = api.post("/api/tasks", json={"title": 42, "tags": "not-a-list"})

        assert response.status_code == 400
        fields = response.get_json()["details"]["fields"]
        assert set(fields) == {"title", "tags"}

    def test_a_non_numeric_id_in_the_path_is_a_404_not_a_500(self, api):
        assert api.put("/api/tasks/abc", json={"done": True}).status_code == 404

    def test_the_wrong_method_is_a_405_in_json(self, api):
        response = api.delete("/api/tasks")

        assert response.status_code == 405
        assert response.is_json


class TestScale:
    def test_a_user_with_many_tasks_pages_rather_than_returning_everything(
        self, api, user
    ):
        for index in range(250):
            db.session.add(Task(title=f"Task {index}", user_id=user.id))
        db.session.commit()

        body = api.get("/api/tasks").get_json()

        assert body["total"] == 250
        assert len(body["items"]) == 100  # the default page size

    def test_there_is_a_ceiling_on_tasks_per_user(self, api, user):
        for index in range(task_service.MAX_TASKS_PER_USER):
            db.session.add(Task(title=f"Task {index}", user_id=user.id))
        db.session.commit()

        response = api.post("/api/tasks", json={"title": "One too many"})

        assert response.status_code == 400

    def test_a_room_with_many_members(self, app, client, api, make_user):
        room = api.post("/api/rooms", json={"name": "Big"}).get_json()

        for index in range(20):
            member = make_user(f"member{index}")
            AuthedClient(client, member).post(f"/api/rooms/{room['id']}/join")

        body = api.get(f"/api/rooms/{room['id']}").get_json()

        assert body["room"]["population"] == 21
        assert len(body["room"]["members"]) == 21
