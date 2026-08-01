"""
The frontend calls res.json() on every response, including the failures.
"""


def test_an_unknown_endpoint_answers_json(client):
    res = client.get("/api/nope")

    assert res.status_code == 404
    assert res.mimetype == "application/json"
    assert "error" in res.get_json()


def test_the_wrong_method_answers_json(client):
    res = client.delete("/api/users/sync")

    assert res.status_code == 405
    assert res.mimetype == "application/json"


def test_a_refused_request_answers_json(client, monkeypatch):
    monkeypatch.setenv("SUPABASE_JWT_SECRET", "test-jwt-secret")

    res = client.get("/api/tasks")

    assert res.status_code == 401
    assert res.get_json()["error"]
