"""
Every endpoint used to read the caller's id straight out of the request,
and a supabase_id is not a secret — the profile endpoints hand them out.
Anyone holding one could act as that person. These cover the token check
that replaced it, and the no-secret fallback teammates still develop on.
"""

from datetime import datetime, timedelta, timezone

import jwt
import pytest

SECRET = "test-jwt-secret"


@pytest.fixture()
def secured(monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", SECRET)


@pytest.fixture()
def trusted(monkeypatch):
    monkeypatch.delenv("SUPABASE_JWT_SECRET", raising=False)


def bearer(supabase_id, secret=SECRET, expires_in=3600):
    token = jwt.encode(
        {
            "sub": supabase_id,
            "aud": "authenticated",
            "exp": datetime.now(timezone.utc) + timedelta(seconds=expires_in),
        },
        secret,
        algorithm="HS256",
    )
    return {"Authorization": f"Bearer {token}"}


def sync_user(client, supabase_id, username, headers=None):
    return client.post(
        "/api/users/sync",
        json={
            "supabase_id": supabase_id,
            "email": f"{username}@example.com",
            "username": username,
            "first_name": "a",
            "last_name": "a",
        },
        headers=headers or {},
    )


# ── Identity can't be claimed ────────────────────────────────────────

def test_a_supabase_id_alone_edits_nothing(client, secured):
    sync_user(client, "sb-alice", "alice", bearer("sb-alice"))

    res = client.patch("/api/users/sb-alice", json={"bio": "hacked"})
    assert res.status_code == 401
    assert client.get("/api/users/sb-alice").get_json()["bio"] is None


def test_a_valid_token_cannot_edit_someone_elses_profile(client, secured):
    sync_user(client, "sb-alice", "alice", bearer("sb-alice"))
    sync_user(client, "sb-bob", "bob", bearer("sb-bob"))

    res = client.patch(
        "/api/users/sb-alice", json={"bio": "hacked"}, headers=bearer("sb-bob")
    )
    assert res.status_code == 403
    assert client.get("/api/users/sb-alice").get_json()["bio"] is None


def test_you_cannot_read_another_users_tasks_by_naming_them(client, secured):
    sync_user(client, "sb-alice", "alice", bearer("sb-alice"))
    sync_user(client, "sb-bob", "bob", bearer("sb-bob"))
    client.post("/api/tasks", json={"title": "Alice's"}, headers=bearer("sb-alice"))

    res = client.get("/api/tasks?supabase_id=sb-alice", headers=bearer("sb-bob"))
    assert res.get_json() == []


def test_the_body_does_not_override_the_token(client, secured):
    """Bob plants Alice's id in the body; the task should still be his."""
    sync_user(client, "sb-alice", "alice", bearer("sb-alice"))
    sync_user(client, "sb-bob", "bob", bearer("sb-bob"))

    client.post(
        "/api/tasks",
        json={"supabase_id": "sb-alice", "title": "planted"},
        headers=bearer("sb-bob"),
    )

    assert client.get("/api/tasks", headers=bearer("sb-alice")).get_json() == []
    assert len(client.get("/api/tasks", headers=bearer("sb-bob")).get_json()) == 1


def test_only_you_see_your_own_email(client, secured):
    sync_user(client, "sb-alice", "alice", bearer("sb-alice"))
    sync_user(client, "sb-bob", "bob", bearer("sb-bob"))

    mine = client.get("/api/users/sb-alice", headers=bearer("sb-alice"))
    theirs = client.get("/api/users/sb-alice", headers=bearer("sb-bob"))

    assert mine.get_json()["email"] == "alice@example.com"
    assert "email" not in theirs.get_json()


# ── Bad tokens ───────────────────────────────────────────────────────

def test_a_request_with_no_token_is_refused(client, secured):
    assert client.get("/api/tasks").status_code == 401


def test_a_token_signed_with_the_wrong_key_is_refused(client, secured):
    res = client.get("/api/tasks", headers=bearer("sb-alice", secret="wrong"))
    assert res.status_code == 401


def test_an_expired_token_is_refused(client, secured):
    res = client.get("/api/tasks", headers=bearer("sb-alice", expires_in=-60))
    assert res.status_code == 401


# ── The no-secret fallback ───────────────────────────────────────────

def test_without_a_secret_the_old_untokened_calls_still_work(client, trusted):
    """A fresh clone has no secret and must still run end to end."""
    assert sync_user(client, "sb-alice", "alice").status_code == 201
    assert client.get("/api/tasks?supabase_id=sb-alice").status_code == 200
