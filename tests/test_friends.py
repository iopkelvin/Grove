"""The friend request lifecycle.

A friendship is one row stored in the direction it was requested, which is
where every awkward case comes from: the pair has to be matched in both
column orders, and only one of the two people may answer a request.
"""

from datetime import timedelta

from api.models import Friendship
from api.models.user import utcnow


class TestSendingRequests:
    def test_sending_a_request(self, api, other_user):
        response = api.post("/api/friends", json={"target_user_id": other_user.id})

        assert response.status_code == 201
        assert response.get_json()["status"] == "pending"

    def test_you_cannot_friend_yourself(self, api, user):
        response = api.post("/api/friends", json={"target_user_id": user.id})

        assert response.status_code == 400
        assert response.get_json()["code"] == "self_friend"

    def test_a_target_that_does_not_exist(self, api):
        response = api.post("/api/friends", json={"target_user_id": 999999})

        assert response.status_code == 404

    def test_target_id_is_required(self, api):
        response = api.post("/api/friends", json={})

        assert response.status_code == 400

    def test_sending_the_same_request_twice(self, api, other_user):
        api.post("/api/friends", json={"target_user_id": other_user.id})

        response = api.post("/api/friends", json={"target_user_id": other_user.id})

        assert response.status_code == 409
        assert response.get_json()["code"] == "request_pending"

    def test_requesting_someone_who_already_requested_you_just_accepts(
        self, api, other_api, user, other_user
    ):
        """Two people clicking Add on each other plainly meant to become
        friends. The old code stored a second, contradictory row."""
        other_api.post("/api/friends", json={"target_user_id": user.id})

        response = api.post("/api/friends", json={"target_user_id": other_user.id})

        assert response.status_code == 201
        assert response.get_json()["status"] == "accepted"
        assert Friendship.query.count() == 1

    def test_asking_again_after_being_declined_is_allowed(
        self, api, other_api, user, other_user
    ):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "declined"})

        response = api.post("/api/friends", json={"target_user_id": other_user.id})

        assert response.status_code == 201
        assert response.get_json()["status"] == "pending"

    def test_asking_an_existing_friend_again(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        response = api.post("/api/friends", json={"target_user_id": other_user.id})

        assert response.status_code == 409
        assert response.get_json()["code"] == "already_friends"


class TestResponding:
    def test_the_recipient_can_accept(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()

        response = other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        assert response.status_code == 200
        assert response.get_json()["status"] == "accepted"
        assert response.get_json()["responded_at"] is not None

    def test_the_sender_cannot_accept_their_own_request(self, api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()

        response = api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        assert response.status_code == 403

    def test_an_unrelated_user_cannot_answer(self, api, client, make_user, other_user):
        from tests.conftest import AuthedClient

        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        bystander = AuthedClient(client, make_user("nosy"))

        response = bystander.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        assert response.status_code == 403

    def test_answering_twice(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        response = other_api.patch(f"/api/friends/{sent['id']}", json={"status": "declined"})

        assert response.status_code == 409
        assert response.get_json()["code"] == "already_answered"

    def test_an_invalid_status_is_refused(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()

        response = other_api.patch(f"/api/friends/{sent['id']}", json={"status": "maybe"})

        assert response.status_code == 400

    def test_responding_to_a_request_that_does_not_exist(self, api):
        response = api.patch("/api/friends/999999", json={"status": "accepted"})

        assert response.status_code == 404


class TestListing:
    def _befriend(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})
        return sent

    def test_both_sides_see_the_friendship(self, api, other_api, other_user):
        self._befriend(api, other_api, other_user)

        mine = api.get("/api/friends").get_json()
        theirs = other_api.get("/api/friends").get_json()

        assert [row["user"]["username"] for row in mine] == ["kyle"]
        assert [row["user"]["username"] for row in theirs] == ["kelvin"]

    def test_a_pending_request_is_not_a_friendship(self, api, other_user):
        api.post("/api/friends", json={"target_user_id": other_user.id})

        assert api.get("/api/friends").get_json() == []

    def test_incoming_requests_are_the_ones_waiting_on_you(
        self, api, other_api, other_user
    ):
        api.post("/api/friends", json={"target_user_id": other_user.id})

        assert api.get("/api/friends?status=pending").get_json() == []
        incoming = other_api.get("/api/friends?status=pending").get_json()
        assert incoming[0]["is_incoming"] is True

    def test_sent_requests_are_visible_to_the_sender(self, api, other_user):
        api.post("/api/friends", json={"target_user_id": other_user.id})

        sent = api.get("/api/friends?status=pending&direction=sent").get_json()

        assert [row["user"]["username"] for row in sent] == ["kyle"]

    def test_rows_never_include_an_email(self, api, other_api, other_user):
        self._befriend(api, other_api, other_user)

        assert "email" not in api.get("/api/friends").get_json()[0]["user"]

    def test_an_unrecognised_status_falls_back_to_accepted(self, api):
        assert api.get("/api/friends?status=banana").status_code == 200


class TestSummary:
    def test_counts_friends_requests_and_who_is_online(
        self, api, other_api, other_user, make_user
    ):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        offline = make_user("ghost")
        offline.last_seen_at = utcnow() - timedelta(days=2)
        api.post("/api/friends", json={"target_user_id": offline.id})

        summary = api.get("/api/friends/summary").get_json()

        assert summary["total"] == 1
        assert summary["online"] == 1

    def test_an_offline_friend_is_not_counted_as_online(
        self, api, other_api, other_user
    ):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})
        other_user.last_seen_at = utcnow() - timedelta(hours=1)

        summary = api.get("/api/friends/summary").get_json()

        assert summary["total"] == 1
        assert summary["online"] == 0

    def test_a_friend_hiding_their_status_reads_as_offline(
        self, api, other_api, other_user
    ):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})
        other_user.show_online_status = False

        assert api.get("/api/friends/summary").get_json()["online"] == 0


class TestRemoval:
    def test_either_party_can_unfriend(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})

        removal = other_api.delete(f"/api/friends/{sent['id']}")

        assert removal.status_code == 204
        assert api.get("/api/friends").get_json() == []

    def test_the_sender_can_cancel_a_pending_request(self, api, other_api, other_user):
        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()

        cancellation = api.delete(f"/api/friends/{sent['id']}")

        assert cancellation.status_code == 204
        assert other_api.get("/api/friends?status=pending").get_json() == []

    def test_a_bystander_cannot_break_up_a_friendship(
        self, api, other_api, client, make_user, other_user
    ):
        from tests.conftest import AuthedClient

        sent = api.post("/api/friends", json={"target_user_id": other_user.id}).get_json()
        other_api.patch(f"/api/friends/{sent['id']}", json={"status": "accepted"})
        bystander = AuthedClient(client, make_user("nosy"))

        attempt = bystander.delete(f"/api/friends/{sent['id']}")

        assert attempt.status_code == 403
        assert len(api.get("/api/friends").get_json()) == 1


def test_profile_shows_the_friendship_status_before_you_click(
    api, other_api, user, other_user
):
    """So the button can say "Requested" on first paint rather than after
    a failed click."""
    api.post("/api/friends", json={"target_user_id": other_user.id})

    viewed = api.get(f"/api/users/by-username/{other_user.username}").get_json()

    assert viewed["friendship_status"] == "pending"
