"""
Input the UI would never send but a curious user easily can.
"""

from .conftest import auth_headers


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


def search(client, supabase_id, term):
    return client.get(
        "/api/users/search", query_string={"q": term}, headers=auth_headers(supabase_id)
    ).get_json()


# ── Search wildcards ─────────────────────────────────────────────────

def test_a_bare_percent_does_not_list_everyone(client):
    for index, name in enumerate(["alice", "bob", "carol"]):
        sync_user(client, f"sb-{index}", name)

    assert search(client, "sb-0", "%") == []


def test_an_underscore_does_not_match_any_character(client):
    sync_user(client, "sb-1", "alice")

    assert search(client, "sb-1", "a_i") == []


def test_an_ordinary_search_still_matches(client):
    sync_user(client, "sb-1", "alice")
    sync_user(client, "sb-2", "bob")

    assert [u["username"] for u in search(client, "sb-2", "ali")] == ["alice"]


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


# ── Oversized fields ─────────────────────────────────────────────────

def test_a_huge_task_title_is_refused(client):
    sync_user(client, "sb-1", "alice")

    res = client.post(
        "/api/tasks",
        json={"supabase_id": "sb-1", "title": "x" * 200_000},
        headers=auth_headers("sb-1"),
    )

    assert res.status_code == 400
    tasks = client.get("/api/tasks?supabase_id=sb-1", headers=auth_headers("sb-1")).get_json()
    assert tasks == []


def test_a_title_right_on_the_limit_is_accepted(client):
    sync_user(client, "sb-1", "alice")

    at_limit = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "x" * 200}, headers=auth_headers("sb-1")
    )
    over = client.post(
        "/api/tasks", json={"supabase_id": "sb-1", "title": "x" * 201}, headers=auth_headers("sb-1")
    )

    assert at_limit.status_code == 201
    assert over.status_code == 400


def test_a_huge_display_name_is_refused(client):
    sync_user(client, "sb-1", "alice")

    res = client.patch(
        "/api/users/sb-1", json={"display_name": "x" * 5000}, headers=auth_headers("sb-1")
    )

    assert res.status_code == 400
