"""
Input the UI would never send but a curious user easily can.
"""

import pytest


@pytest.fixture(autouse=True)
def _trusted(monkeypatch):
    """These aren't about auth; run them the way a fresh clone runs."""
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)


def sync_user(client, supabase_id, username):
    return client.post(
        "/api/users/sync",
        json={
            "supabase_id": supabase_id,
            "email": f"{username}@example.com",
            "username": username,
            "first_name": "a",
            "last_name": "a",
        },
    )


def search(client, term):
    return client.get("/api/users/search", query_string={"q": term}).get_json()


# ── Search wildcards ─────────────────────────────────────────────────

def test_a_bare_percent_does_not_list_everyone(client):
    for index, name in enumerate(["alice", "bob", "carol"]):
        sync_user(client, f"sb-{index}", name)

    assert search(client, "%") == []


def test_an_underscore_does_not_match_any_character(client):
    sync_user(client, "sb-1", "alice")

    assert search(client, "a_i") == []


def test_an_ordinary_search_still_matches(client):
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")

    assert [u["username"] for u in search(client, "ali")] == ["alice"]


# ── Signing up without a username ────────────────────────────────────

def test_a_signup_with_no_username_gets_one_from_the_email(client):
    res = client.post(
        "/api/users/sync",
        json={
            "supabase_id": "sb-1",
            "email": "ada@berkeley.edu",
            "first_name": "ada",
            "last_name": "lovelace",
        },
    )

    assert res.status_code == 201
    assert res.get_json()["username"] == "ada"


def test_two_people_sharing_an_email_prefix_both_get_a_username(client):
    first = client.post(
        "/api/users/sync",
        json={"supabase_id": "sb-1", "email": "john@gmail.com", "first_name": "j", "last_name": "j"},
    )
    second = client.post(
        "/api/users/sync",
        json={"supabase_id": "sb-2", "email": "john@yahoo.com", "first_name": "j", "last_name": "j"},
    )

    assert first.get_json()["username"] == "john"
    assert second.get_json()["username"] == "john2"


def test_an_email_with_nothing_usable_still_produces_a_username(client):
    res = client.post(
        "/api/users/sync",
        json={"supabase_id": "sb-1", "email": "!!!@example.com", "first_name": "a", "last_name": "a"},
    )

    assert res.status_code == 201
    assert res.get_json()["username"] == "grove"


def test_a_recreated_supabase_account_keeps_its_tasks(client):
    """Same person, same email, brand-new supabase_id after a delete."""
    sync_user(client, "sb-old", "ada")
    client.post("/api/tasks", json={"supabase_id": "sb-old", "title": "Read"})

    again = client.post(
        "/api/users/sync",
        json={
            "supabase_id": "sb-new",
            "email": "ada@example.com",
            "first_name": "a",
            "last_name": "a",
        },
    )

    assert again.status_code == 200
    tasks = client.get("/api/tasks?supabase_id=sb-new").get_json()
    assert [t["title"] for t in tasks] == ["Read"]


# ── Oversized fields ─────────────────────────────────────────────────

def test_a_huge_task_title_is_refused(client):
    sync_user(client, "sb-1", "alice")

    res = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "x" * 200_000}
    )

    assert res.status_code == 400
    assert client.get("/api/tasks?supabase_id=sb-1").get_json() == []


def test_a_title_right_on_the_limit_is_accepted(client):
    sync_user(client, "sb-1", "alice")

    at_limit = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "x" * 200}
    )
    over = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "x" * 201}
    )

    assert at_limit.status_code == 201
    assert over.status_code == 400


def test_a_huge_display_name_is_refused(client):
    sync_user(client, "sb-1", "alice")

    res = client.patch("/api/users/sb-1", json={"display_name": "x" * 5000})

    assert res.status_code == 400
