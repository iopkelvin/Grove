"""
The frontend calls res.json() on every response, including the failures.
"""


def test_a_refused_request_answers_json(client):
    res = client.get("/api/tasks")

    assert res.status_code == 401
    assert res.get_json()["error"]
