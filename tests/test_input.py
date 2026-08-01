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
