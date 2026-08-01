"""
Focused backend test suite — covers the core workflows, not every route.

Picked to match what actually matters for Grove: account creation, the
task -> streak loop (including the once-per-day rule, which is easy to
get wrong), the friend request flow, and the two places the backend is
supposed to protect user data (another user's task, another user's email).
"""


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
