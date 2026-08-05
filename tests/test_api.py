"""
Focused backend test suite — covers the core workflows, not every route.

Picked to match what actually matters for Grove: account creation, the
task -> streak loop (including the once-per-day rule, which is easy to
get wrong), recurring/habit tasks, the friend request flow, and the two
places the backend is supposed to protect user data (another user's
task, another user's email).
"""

from datetime import date, timedelta

from api.config.database import db
from api.models.streak import Streak
from api.models.task import Task
from api.models.user import User

from .conftest import auth_headers, flask_app


def sync_user(client, supabase_id, username, first_name="a", last_name="a"):
    return client.post(
        "/api/users/sync",
        json={
            "supabase_id": supabase_id,
            "email": f"{username}@example.com",
            "username": username,
            "first_name": first_name,
            "last_name": last_name,
        },
        headers=auth_headers(supabase_id),
    )


def create_task(client, supabase_id, title="Read"):
    return client.post(
        "/api/tasks", json={"supabase_id": supabase_id, "title": title}, headers=auth_headers(supabase_id)
    )


def complete_task(client, supabase_id, task_id):
    return client.put(
        f"/api/tasks/{task_id}",
        json={"supabase_id": supabase_id, "completed": True},
        headers=auth_headers(supabase_id),
    )


def get_streak(client, supabase_id):
    res = client.get(f"/api/users/{supabase_id}", headers=auth_headers(supabase_id))
    return res.get_json()["current_streak"]


def get_tree_progress(client, supabase_id):
    return client.get(f"/api/streaks/{supabase_id}", headers=auth_headers(supabase_id)).get_json()


def create_room(client, supabase_id, name="Study Room"):
    return client.post(
        "/api/rooms", json={"name": name}, headers=auth_headers(supabase_id)
    )


# ── Account creation ─────────────────────────────────────────────────

def test_sync_creates_a_user(client):
    res = sync_user(client, "sb-1", "alice")
    assert res.status_code == 201
    assert res.get_json()["username"] == "alice"


def test_sync_is_idempotent(client):
    """Signing up twice with the same supabase_id shouldn't create a
    second row — this is what the frontend actually calls on every login,
    not just once at signup."""
    first = sync_user(client, "sb-1", "alice")
    second = sync_user(client, "sb-1", "alice")
    assert first.get_json()["id"] == second.get_json()["id"]


def test_tree_cycle_uses_streak_count_and_restarts_after_100(client):
    sync_user(client, "sb-1", "alice")

    assert get_tree_progress(client, "sb-1")["cycle_level"] == 1

    with flask_app.app_context():
        user = User.query.filter_by(supabase_id="sb-1").one()
        db.session.add(Streak(user_id=user.id, current_count=77))
        db.session.commit()

    assert get_tree_progress(client, "sb-1")["cycle_level"] == 77

    with flask_app.app_context():
        user = User.query.filter_by(supabase_id="sb-1").one()
        streak = Streak.query.filter_by(user_id=user.id).one()
        streak.current_count = 100
        db.session.commit()

    earned = get_tree_progress(client, "sb-1")
    assert earned["cycle_level"] == 100
    assert earned["trophy_points"] == 1

    with flask_app.app_context():
        user = User.query.filter_by(supabase_id="sb-1").one()
        streak = Streak.query.filter_by(user_id=user.id).one()
        streak.current_count = 101
        db.session.commit()

    restarted = get_tree_progress(client, "sb-1")
    assert restarted["cycle_level"] == 1
    assert restarted["trophy_points"] == 1


def test_banner_position_defaults_to_center(client):
    user = sync_user(client, "sb-1", "alice").get_json()
    assert user["banner_position_y"] == 50


def test_banner_position_can_be_updated_and_is_clamped(client):
    sync_user(client, "sb-1", "alice")

    updated = client.patch(
        "/api/users/sb-1", json={"banner_position_y": 80}, headers=auth_headers("sb-1")
    ).get_json()
    assert updated["banner_position_y"] == 80

    clamped = client.patch(
        "/api/users/sb-1", json={"banner_position_y": 500}, headers=auth_headers("sb-1")
    ).get_json()
    assert clamped["banner_position_y"] == 100


def test_pronouns_default_to_unset(client):
    user = sync_user(client, "sb-1", "alice").get_json()
    assert user["pronouns"] is None


def test_pronouns_can_be_set_and_cleared(client):
    sync_user(client, "sb-1", "alice")

    updated = client.patch(
        "/api/users/sb-1", json={"pronouns": "she/her"}, headers=auth_headers("sb-1")
    ).get_json()
    assert updated["pronouns"] == "she/her"

    cleared = client.patch(
        "/api/users/sb-1", json={"pronouns": ""}, headers=auth_headers("sb-1")
    ).get_json()
    assert cleared["pronouns"] is None


def test_pronouns_are_truncated_to_30_chars(client):
    sync_user(client, "sb-1", "alice")

    updated = client.patch(
        "/api/users/sb-1", json={"pronouns": "x" * 50}, headers=auth_headers("sb-1")
    ).get_json()
    assert updated["pronouns"] == "x" * 30


def test_visiting_a_room_sets_last_room(client):
    sync_user(client, "sb-1", "alice")
    room = create_room(client, "sb-1").get_json()

    res = client.post(f"/api/rooms/{room['id']}/visit", headers=auth_headers("sb-1"))

    assert res.status_code == 200
    assert res.get_json()["last_room_id"] == room["id"]


def test_visiting_a_missing_room_404s(client):
    sync_user(client, "sb-1", "alice")

    res = client.post("/api/rooms/999999/visit", headers=auth_headers("sb-1"))

    assert res.status_code == 404


# ── Task + streak core loop ──────────────────────────────────────────

def test_completing_a_task_bumps_streak_to_one(client):
    sync_user(client, "sb-1", "alice")
    task = create_task(client, "sb-1").get_json()

    complete_task(client, "sb-1", task["id"])

    assert get_streak(client, "sb-1") == 1


def test_completing_a_second_task_same_day_does_not_double_count(client):
    """The streak is 'did something today', not 'how many tasks today' —
    completing two tasks in one day should still only be +1."""
    sync_user(client, "sb-1", "alice")
    task_a = create_task(client, "sb-1", "Read").get_json()
    task_b = create_task(client, "sb-1", "Walk").get_json()

    complete_task(client, "sb-1", task_a["id"])
    complete_task(client, "sb-1", task_b["id"])

    assert get_streak(client, "sb-1") == 1


def test_uncompleting_a_task_does_not_reduce_the_streak(client):
    """current_count only ever moves forward from completions — there's
    no code path that decrements it, so toggling a task back off should
    leave the streak alone rather than erroring or going negative."""
    sync_user(client, "sb-1", "alice")
    task = create_task(client, "sb-1").get_json()
    complete_task(client, "sb-1", task["id"])

    res = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "completed": False},
        headers=auth_headers("sb-1"),
    )

    assert res.status_code == 200
    assert get_streak(client, "sb-1") == 1


# ── Due dates + recurring tasks ──────────────────────────────────────

def test_due_date_is_stored_and_returned(client):
    sync_user(client, "sb-1", "alice")
    res = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Submit report", "due_date": "2026-08-15"},
        headers=auth_headers("sb-1"),
    )
    assert res.get_json()["due_date"] == "2026-08-15"


def test_due_time_is_stored_and_returned(client):
    sync_user(client, "sb-1", "alice")
    res = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Submit report", "due_time": "14:30"},
        headers=auth_headers("sb-1"),
    )
    assert res.get_json()["due_time"] == "14:30"


def test_due_time_can_be_updated_and_cleared(client):
    sync_user(client, "sb-1", "alice")
    task = create_task(client, "sb-1").get_json()

    updated = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "due_time": "09:00"},
        headers=auth_headers("sb-1"),
    ).get_json()
    assert updated["due_time"] == "09:00"

    cleared = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "due_time": ""},
        headers=auth_headers("sb-1"),
    ).get_json()
    assert cleared["due_time"] is None


def test_completing_a_recurring_task_bumps_streak(client):
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True},
        headers=auth_headers("sb-1"),
    ).get_json()
    assert task["done"] is False

    complete_task(client, "sb-1", task["id"])

    assert get_streak(client, "sb-1") == 1
    tasks = client.get("/api/tasks?supabase_id=sb-1", headers=auth_headers("sb-1")).get_json()
    assert tasks[0]["done"] is True


def test_recurring_task_resets_the_next_day(client):
    """A recurring task's "done" state is derived from whether it was
    completed today, not a flag someone has to reset — completing it
    yesterday shouldn't still show as done today."""
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True},
        headers=auth_headers("sb-1"),
    ).get_json()
    complete_task(client, "sb-1", task["id"])

    row = Task.query.get(task["id"])
    row.last_completed_date = date.today() - timedelta(days=1)
    db.session.commit()

    tasks = client.get("/api/tasks?supabase_id=sb-1", headers=auth_headers("sb-1")).get_json()
    assert tasks[0]["done"] is False


def test_completing_a_recurring_task_again_the_next_day_bumps_streak_again(client):
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True},
        headers=auth_headers("sb-1"),
    ).get_json()
    complete_task(client, "sb-1", task["id"])
    assert get_streak(client, "sb-1") == 1

    # simulate yesterday's streak activity so today's completion continues
    # the streak (+1) instead of restarting it — isolates the recurring
    # reset behavior from the separate once-per-day streak rule.
    row = Task.query.get(task["id"])
    row.last_completed_date = date.today() - timedelta(days=1)
    from api.models.streak import Streak
    streak_row = Streak.query.filter_by(user_id=row.user_id).first()
    streak_row.last_activity_date = date.today() - timedelta(days=1)
    db.session.commit()

    complete_task(client, "sb-1", task["id"])

    assert get_streak(client, "sb-1") == 2


def test_turning_off_recurring_carries_over_done_today(client):
    """Switching a recurring task to one-off shouldn't silently un-complete
    it just because "done" is tracked a different way for each kind."""
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True},
        headers=auth_headers("sb-1"),
    ).get_json()
    complete_task(client, "sb-1", task["id"])

    res = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "recurring": False},
        headers=auth_headers("sb-1"),
    )
    assert res.get_json()["done"] is True


def test_turning_off_recurring_without_completing_today_stays_not_done(client):
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True},
        headers=auth_headers("sb-1"),
    ).get_json()

    res = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "recurring": False},
        headers=auth_headers("sb-1"),
    )
    assert res.get_json()["done"] is False


def test_turning_on_recurring_carries_over_todays_completion(client):
    sync_user(client, "sb-1", "alice")
    task = create_task(client, "sb-1").get_json()
    complete_task(client, "sb-1", task["id"])

    res = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "recurring": True},
        headers=auth_headers("sb-1"),
    )
    assert res.get_json()["done"] is True


def test_explicit_completed_wins_over_the_recurring_carry_over(client):
    """Setting `completed` in the same request as `recurring` is the
    caller's explicit choice — it shouldn't be overridden by the
    done-state carry-over."""
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True},
        headers=auth_headers("sb-1"),
    ).get_json()
    complete_task(client, "sb-1", task["id"])

    res = client.put(
        f"/api/tasks/{task['id']}",
        json={"supabase_id": "sb-1", "recurring": False, "completed": False},
        headers=auth_headers("sb-1"),
    )
    assert res.get_json()["done"] is False


def test_creating_a_task_with_new_tags_makes_them_listable(client):
    """Covers the create-task form's tag picker: tags typed for a new
    task should show up in GET /api/tags for next time, not just live on
    that one task."""
    sync_user(client, "sb-1", "alice")
    client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Read", "tags": ["School", "Today"]},
        headers=auth_headers("sb-1"),
    )

    tags = client.get("/api/tags?supabase_id=sb-1", headers=auth_headers("sb-1")).get_json()

    assert sorted(t["name"] for t in tags) == ["School", "Today"]


# ── Friend requests ───────────────────────────────────────────────────

def test_send_and_accept_friend_request(client):
    sync_user(client, "sb-1", "alice")
    bob = sync_user(client, "sb-2", "bob").get_json()

    sent = client.post(
        "/api/friends",
        json={"requester_supabase_id": "sb-1", "target_user_id": bob["id"]},
        headers=auth_headers("sb-1"),
    )
    assert sent.status_code == 201
    friendship_id = sent.get_json()["id"]

    accepted = client.patch(
        f"/api/friends/{friendship_id}",
        json={"supabase_id": "sb-2", "status": "accepted"},
        headers=auth_headers("sb-2"),
    )
    assert accepted.status_code == 200

    alice_friends = client.get(
        "/api/friends?supabase_id=sb-1&status=accepted", headers=auth_headers("sb-1")
    ).get_json()
    assert [f["user"]["username"] for f in alice_friends] == ["bob"]


def test_duplicate_friend_request_is_rejected(client):
    sync_user(client, "sb-1", "alice")
    bob = sync_user(client, "sb-2", "bob").get_json()
    client.post(
        "/api/friends",
        json={"requester_supabase_id": "sb-1", "target_user_id": bob["id"]},
        headers=auth_headers("sb-1"),
    )

    again = client.post(
        "/api/friends",
        json={"requester_supabase_id": "sb-1", "target_user_id": bob["id"]},
        headers=auth_headers("sb-1"),
    )

    assert again.status_code == 409


# ── Data protection ──────────────────────────────────────────────────

def test_user_cannot_modify_another_users_task(client):
    """Bob knowing Alice's task id (e.g. by guessing a sequential id)
    shouldn't let him complete or edit it as himself."""
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")
    alice_task = create_task(client, "sb-1").get_json()

    res = client.put(
        f"/api/tasks/{alice_task['id']}",
        json={"supabase_id": "sb-2", "completed": True},
        headers=auth_headers("sb-2"),
    )

    assert res.status_code == 404
    assert get_streak(client, "sb-1") == 0  # Alice's streak must not move either


def test_user_cannot_delete_another_users_task(client):
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")
    alice_task = create_task(client, "sb-1").get_json()

    res = client.delete(
        f"/api/tasks/{alice_task['id']}?supabase_id=sb-2", headers=auth_headers("sb-2")
    )

    assert res.status_code == 404
    still_there = client.get("/api/tasks?supabase_id=sb-1", headers=auth_headers("sb-1")).get_json()
    assert len(still_there) == 1


def test_public_profile_hides_email_from_other_users(client):
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")

    res = client.get("/api/users/by-username/alice", headers=auth_headers("sb-2"))

    assert res.status_code == 200
    assert "email" not in res.get_json()
