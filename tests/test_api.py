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
from api.models.task import Task


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
    )


def create_task(client, supabase_id, title="Read"):
    return client.post("/api/tasks", json={"supabase_id": supabase_id, "title": title})


def complete_task(client, supabase_id, task_id):
    return client.put(f"/api/tasks/{task_id}", json={"supabase_id": supabase_id, "completed": True})


def get_streak(client, supabase_id):
    return client.get(f"/api/users/{supabase_id}").get_json()["current_streak"]


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

    res = client.put(f"/api/tasks/{task['id']}", json={"supabase_id": "sb-1", "completed": False})

    assert res.status_code == 200
    assert get_streak(client, "sb-1") == 1


# ── Due dates + recurring tasks ──────────────────────────────────────

def test_due_date_is_stored_and_returned(client):
    sync_user(client, "sb-1", "alice")
    res = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Submit report", "due_date": "2026-08-15"},
    )
    assert res.get_json()["due_date"] == "2026-08-15"


def test_completing_a_recurring_task_bumps_streak(client):
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True}
    ).get_json()
    assert task["done"] is False

    complete_task(client, "sb-1", task["id"])

    assert get_streak(client, "sb-1") == 1
    tasks = client.get("/api/tasks?supabase_id=sb-1").get_json()
    assert tasks[0]["done"] is True


def test_recurring_task_resets_the_next_day(client):
    """A recurring task's "done" state is derived from whether it was
    completed today, not a flag someone has to reset — completing it
    yesterday shouldn't still show as done today."""
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True}
    ).get_json()
    complete_task(client, "sb-1", task["id"])

    row = Task.query.get(task["id"])
    row.last_completed_date = date.today() - timedelta(days=1)
    db.session.commit()

    tasks = client.get("/api/tasks?supabase_id=sb-1").get_json()
    assert tasks[0]["done"] is False


def test_completing_a_recurring_task_again_the_next_day_bumps_streak_again(client):
    sync_user(client, "sb-1", "alice")
    task = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "Water your tree", "recurring": True}
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


def test_creating_a_task_with_new_tags_makes_them_listable(client):
    """Covers the create-task form's tag picker: tags typed for a new
    task should show up in GET /api/tags for next time, not just live on
    that one task."""
    sync_user(client, "sb-1", "alice")
    client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "Read", "tags": ["School", "Today"]},
    )

    tags = client.get("/api/tags?supabase_id=sb-1").get_json()

    assert sorted(t["name"] for t in tags) == ["School", "Today"]


# ── Friend requests ───────────────────────────────────────────────────

def test_send_and_accept_friend_request(client):
    sync_user(client, "sb-1", "alice")
    bob = sync_user(client, "sb-2", "bob").get_json()

    sent = client.post("/api/friends", json={"requester_supabase_id": "sb-1", "target_user_id": bob["id"]})
    assert sent.status_code == 201
    friendship_id = sent.get_json()["id"]

    accepted = client.patch(f"/api/friends/{friendship_id}", json={"supabase_id": "sb-2", "status": "accepted"})
    assert accepted.status_code == 200

    alice_friends = client.get("/api/friends?supabase_id=sb-1&status=accepted").get_json()
    assert [f["user"]["username"] for f in alice_friends] == ["bob"]


def test_duplicate_friend_request_is_rejected(client):
    sync_user(client, "sb-1", "alice")
    bob = sync_user(client, "sb-2", "bob").get_json()
    client.post("/api/friends", json={"requester_supabase_id": "sb-1", "target_user_id": bob["id"]})

    again = client.post("/api/friends", json={"requester_supabase_id": "sb-1", "target_user_id": bob["id"]})

    assert again.status_code == 409


# ── Data protection ──────────────────────────────────────────────────

def test_user_cannot_modify_another_users_task(client):
    """Bob knowing Alice's task id (e.g. by guessing a sequential id)
    shouldn't let him complete or edit it as himself."""
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")
    alice_task = create_task(client, "sb-1").get_json()

    res = client.put(f"/api/tasks/{alice_task['id']}", json={"supabase_id": "sb-2", "completed": True})

    assert res.status_code == 404
    assert get_streak(client, "sb-1") == 0  # Alice's streak must not move either


def test_user_cannot_delete_another_users_task(client):
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")
    alice_task = create_task(client, "sb-1").get_json()

    res = client.delete(f"/api/tasks/{alice_task['id']}?supabase_id=sb-2")

    assert res.status_code == 404
    still_there = client.get("/api/tasks?supabase_id=sb-1").get_json()
    assert len(still_there) == 1


def test_public_profile_hides_email_from_other_users(client):
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")

    res = client.get("/api/users/by-username/alice?viewer_supabase_id=sb-2")

    assert res.status_code == 200
    assert "email" not in res.get_json()
