"""Plumbing: health checks, error shape, configuration, and the worker.

Nothing here is a product feature. It is the machinery everything else
depends on, and it is exactly the machinery that used to fail silently.
"""

from unittest.mock import patch

import pytest
from sqlalchemy.exc import OperationalError

from api.config.database import DEFAULT_DATABASE_URL, resolve_database_url
from api.utils.errors import ApiError, BadRequest, Conflict, NotFound
from api.workers.queue import BackgroundQueue


class TestHealth:
    def test_the_root_explains_what_this_service_is(self, client):
        body = client.get("/").get_json()

        assert body["service"] == "grove-api"
        assert body["status"] == "running"

    def test_liveness_does_not_touch_the_database(self, client):
        """So a database outage cannot make the host kill and restart
        otherwise-healthy instances in a loop."""
        with patch("api.config.database.db.session.execute") as execute:
            response = client.get("/api/health")

        assert response.status_code == 200
        execute.assert_not_called()

    def test_readiness_reports_the_database(self, client):
        assert client.get("/api/ready").get_json()["database"] == "ok"

    def test_readiness_fails_when_the_database_is_unreachable(self, client):
        with patch(
            "api.config.database.db.session.execute",
            side_effect=OperationalError("SELECT 1", {}, Exception("down")),
        ):
            response = client.get("/api/ready")

        assert response.status_code == 503
        assert response.get_json()["database"] == "unreachable"


class TestErrorShape:
    def test_an_unknown_api_endpoint_says_which_one(self, client):
        response = client.get("/api/does-not-exist")

        assert response.status_code == 404
        assert response.is_json
        assert "/api/does-not-exist" in response.get_json()["error"]

    def test_errors_are_json_not_html(self, client):
        """A JSON client cannot parse an HTML error page — res.json()
        throws while reading the error and the user gets a blank screen."""
        response = client.get("/api/nope")

        assert response.content_type.startswith("application/json")

    def test_every_error_carries_a_request_id(self, client):
        response = client.get("/api/nope")

        assert response.get_json()["request_id"]
        assert response.headers["X-Request-ID"]

    def test_the_request_id_in_the_body_matches_the_header(self, client):
        response = client.get("/api/nope")

        assert response.get_json()["request_id"] == response.headers["X-Request-ID"]

    def test_an_upstream_request_id_is_honoured(self, client):
        response = client.get("/api/health", headers={"X-Request-ID": "from-the-proxy"})

        assert response.headers["X-Request-ID"] == "from-the-proxy"

    def test_an_absurd_upstream_request_id_is_truncated(self, client):
        response = client.get("/api/health", headers={"X-Request-ID": "x" * 500})

        assert len(response.headers["X-Request-ID"]) <= 64

    def test_successful_responses_get_a_request_id_too(self, client):
        assert client.get("/api/health").headers["X-Request-ID"]

    @pytest.mark.parametrize(
        ("error", "status", "code"),
        [
            (BadRequest(), 400, "bad_request"),
            (NotFound(), 404, "not_found"),
            (Conflict(), 409, "conflict"),
            (ApiError(), 500, "internal_error"),
        ],
    )
    def test_the_hierarchy_maps_to_the_right_status(self, error, status, code):
        body, resolved = error.to_response()

        assert resolved == status
        assert body["code"] == code

    def test_an_unhandled_exception_becomes_a_clean_500(self, app, client):
        @app.get("/api/boom")
        def boom():
            raise RuntimeError("something nobody anticipated")

        response = client.get("/api/boom")

        assert response.status_code == 500
        assert response.is_json
        assert response.get_json()["code"] == "internal_error"

    def test_a_500_does_not_leak_internals_when_debug_is_off(self, app, client):
        app.config["DEBUG"] = False

        @app.get("/api/boom")
        def boom():
            raise RuntimeError("connection string: postgres://user:hunter2@host")

        body = client.get("/api/boom").get_json()

        assert "hunter2" not in str(body)


class TestCalendarIsExplicitlyNotBuilt:
    def test_it_answers_501_rather_than_crashing(self, client):
        """The stub returned None, which Flask reports as a 500 with a
        message about view functions — indistinguishable from a real fault.
        Calendar is out of scope, not broken."""
        response = client.get("/api/calendar")

        assert response.status_code == 501
        assert response.get_json()["code"] == "not_implemented"

    def test_the_events_path_answers_the_same_way(self, client):
        assert client.get("/api/calendar/events").status_code == 501


class TestDatabaseUrlResolution:
    def test_an_unset_url_falls_back_to_sqlite(self):
        assert resolve_database_url("") == DEFAULT_DATABASE_URL

    def test_whitespace_counts_as_unset(self):
        assert resolve_database_url("   ") == DEFAULT_DATABASE_URL

    def test_the_legacy_postgres_scheme_is_rewritten(self):
        """Several providers still hand out postgres:// URLs, which
        SQLAlchemy 1.4+ refuses to parse."""
        resolved = resolve_database_url("postgres://user:pw@host:5432/db")

        assert resolved.startswith("postgresql://")

    def test_a_valid_url_is_left_alone(self):
        url = "postgresql://user:pw@host:5432/db"

        assert resolve_database_url(url) == url

    def test_a_malformed_url_degrades_instead_of_taking_the_app_down(self):
        """Someone pasting the whole DATABASE_URL=... line as the value in
        a host's dashboard should not be an outage."""
        assert resolve_database_url("DATABASE_URL=postgresql://x") == DEFAULT_DATABASE_URL

    def test_the_literal_string_none(self):
        assert resolve_database_url("None") == DEFAULT_DATABASE_URL


class TestLogScrubbing:
    """Anything caller-controlled that reaches a log line goes through
    scrub() first. Without it a request for a path containing a newline
    writes a second, entirely fabricated entry into the log."""

    def test_newlines_are_removed(self):
        from api.utils.logger import scrub

        forged = "/api/x\n2026-01-01 ERROR admin deleted everything"

        assert "\n" not in scrub(forged)

    @pytest.mark.parametrize("char", ["\r", "\n", "\x00", "\x1b", "\x7f"])
    def test_control_characters_are_removed(self, char):
        from api.utils.logger import scrub

        assert char not in scrub(f"before{char}after")

    def test_ordinary_text_is_untouched(self):
        from api.utils.logger import scrub

        assert scrub("/api/users/by-username/kelvin") == "/api/users/by-username/kelvin"

    def test_long_values_are_truncated_but_say_so(self):
        from api.utils.logger import scrub

        result = scrub("x" * 5000, limit=50)

        assert len(result) < 100
        assert "5000" in result

    def test_non_strings_are_coerced(self):
        from api.utils.logger import scrub

        assert scrub(42) == "42"
        assert scrub(None) == "None"

    def test_a_request_path_reaches_the_log_scrubbed(self, client, caplog):
        import logging

        with caplog.at_level(logging.INFO, logger="api"):
            client.get("/api/health")

        assert all("\n" not in record.getMessage() for record in caplog.records)


class TestBackgroundQueue:
    def test_eager_mode_runs_a_job_immediately(self, app):
        seen = []
        queue = BackgroundQueue(app, eager=True)

        queue.submit(seen.append, "done")

        assert seen == ["done"]

    def test_a_failing_job_does_not_propagate(self, app):
        """An exception escaping a worker would kill the thread and
        silently stop all background processing for the process."""
        queue = BackgroundQueue(app, eager=True)

        def explode():
            raise RuntimeError("boom")

        assert queue.submit(explode) is True
        assert queue.stats()["failed"] == 1

    def test_a_full_queue_drops_work_rather_than_blocking(self, app):
        queue = BackgroundQueue(app, max_queue=1, eager=False)

        assert queue.submit(lambda: None) is True
        assert queue.submit(lambda: None) is False
        assert queue.stats()["dropped"] == 1

    def test_stats_report_what_happened(self, app):
        queue = BackgroundQueue(app, eager=True)
        queue.submit(lambda: None)

        stats = queue.stats()

        assert stats["completed"] == 1
        assert stats["failed"] == 0
        assert stats["eager"] is True

    def test_the_app_gets_a_queue_attached(self, app):
        assert app.extensions["grove_queue"].eager is True

    def test_presence_is_recorded_after_a_request(self, api, user):
        user.last_seen_at = None

        api.get("/api/users/me")

        assert user.last_seen_at is not None


class TestPresence:
    def test_a_user_seen_just_now_is_online(self, user):
        user.touch()

        assert user.is_online is True

    def test_a_user_never_seen_is_offline(self, make_user):
        account = make_user("neverhere")
        account.last_seen_at = None

        assert account.is_online is False

    def test_a_user_seen_long_ago_is_offline(self, user):
        from datetime import timedelta

        from api.models.user import utcnow

        user.last_seen_at = utcnow() - timedelta(hours=2)

        assert user.is_online is False

    def test_a_naive_timestamp_does_not_raise(self, user):
        """SQLite hands back naive datetimes, and rows written before the
        column existed have none at all. Comparing a naive value against an
        aware one raises TypeError if it is not handled."""
        from datetime import datetime, timezone

        user.last_seen_at = datetime.now(timezone.utc).replace(tzinfo=None)

        assert user.is_online is True

    def test_hiding_your_status_makes_you_appear_offline(self, user):
        user.touch()
        user.show_online_status = False

        assert user.is_online is False
