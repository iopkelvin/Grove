"""Study rooms and the shared lobby.

None of this had a backend before: /api/rooms, /api/rooms/<id> and the
POST were `pass`-bodied stubs that answered 500.
"""

from datetime import timedelta

from api.models.user import utcnow
from api.services import room as room_service


class TestLobby:
    def test_the_global_room_is_created_on_first_access(self, api):
        body = api.get("/api/rooms/lobby").get_json()

        assert body["room"]["is_global"] is True
        assert body["room"]["name"] == "The Grove"
        assert body["joined"] is False

    def test_there_is_only_ever_one_global_room(self, api, other_api):
        api.get("/api/rooms/lobby")
        other_api.get("/api/rooms/lobby")

        first = api.get("/api/rooms/lobby").get_json()["room"]["id"]
        second = other_api.get("/api/rooms/lobby").get_json()["room"]["id"]
        assert first == second

    def test_joining_puts_you_in_the_roster(self, api, user):
        body = api.post("/api/rooms/lobby/join").get_json()

        assert body["joined"] is True
        assert [m["username"] for m in body["room"]["members"]] == [user.username]

    def test_joining_twice_is_harmless(self, api):
        api.post("/api/rooms/lobby/join")

        body = api.post("/api/rooms/lobby/join").get_json()

        assert body["room"]["population"] == 1

    def test_leaving_removes_you(self, api):
        api.post("/api/rooms/lobby/join")

        body = api.post("/api/rooms/lobby/leave").get_json()

        assert body["joined"] is False
        assert body["room"]["population"] == 0

    def test_leaving_a_room_you_are_not_in(self, api):
        assert api.post("/api/rooms/lobby/leave").status_code == 200

    def test_population_counts_who_is_present_not_who_ever_joined(
        self, api, other_api, other_user
    ):
        """`len(memberships)` only ever went up, so the Lobby's population
        counted everyone who had ever opened the page."""
        api.post("/api/rooms/lobby/join")
        other_api.post("/api/rooms/lobby/join")
        other_user.last_seen_at = utcnow() - timedelta(hours=3)

        assert api.get("/api/rooms/lobby").get_json()["room"]["population"] == 1

    def test_the_roster_never_carries_an_email(self, api, other_api):
        api.post("/api/rooms/lobby/join")
        other_api.post("/api/rooms/lobby/join")

        members = api.get("/api/rooms/lobby").get_json()["room"]["members"]

        assert members
        assert all("email" not in member for member in members)


class TestHostedRooms:
    def test_creating_a_room(self, api):
        response = api.post(
            "/api/rooms", json={"name": "CS160 crunch", "theme": "library", "capacity": 4}
        )

        assert response.status_code == 201
        body = response.get_json()
        assert body["name"] == "CS160 crunch"
        assert body["theme"] == "library"
        assert body["capacity"] == 4

    def test_the_host_starts_inside_their_own_room(self, api, user):
        room = api.post("/api/rooms", json={"name": "Mine"}).get_json()

        assert [m["username"] for m in room["members"]] == [user.username]

    def test_a_name_is_required(self, api):
        assert api.post("/api/rooms", json={}).status_code == 400

    def test_an_unknown_theme_is_refused(self, api):
        response = api.post("/api/rooms", json={"name": "Room", "theme": "disco"})

        assert response.status_code == 400
        assert "theme" in response.get_json()["details"]["fields"]

    def test_theme_defaults_when_omitted(self, api):
        assert api.post("/api/rooms", json={"name": "Room"}).get_json()["theme"] == "grove"

    def test_an_absurd_capacity_is_refused(self, api):
        response = api.post("/api/rooms", json={"name": "Room", "capacity": 10_000})

        assert response.status_code == 400

    def test_hosting_is_limited(self, api):
        for index in range(room_service.MAX_ROOMS_PER_HOST):
            created = api.post("/api/rooms", json={"name": f"Room {index}"})
            assert created.status_code == 201

        response = api.post("/api/rooms", json={"name": "One too many"})

        assert response.status_code == 409
        assert response.get_json()["code"] == "room_limit_reached"

    def test_a_full_room_turns_people_away(self, api, other_api):
        room = api.post("/api/rooms", json={"name": "Tiny", "capacity": 1}).get_json()

        response = other_api.post(f"/api/rooms/{room['id']}/join")

        assert response.status_code == 409
        assert response.get_json()["code"] == "room_full"

    def test_joining_and_leaving_a_hosted_room(self, api, other_api):
        room = api.post("/api/rooms", json={"name": "Study", "capacity": 5}).get_json()

        joined = other_api.post(f"/api/rooms/{room['id']}/join").get_json()
        assert joined["joined"] is True
        assert joined["room"]["population"] == 2

        left = other_api.post(f"/api/rooms/{room['id']}/leave").get_json()
        assert left["room"]["population"] == 1

    def test_only_the_host_can_close_a_room(self, api, other_api):
        room = api.post("/api/rooms", json={"name": "Study"}).get_json()
        other_api.post(f"/api/rooms/{room['id']}/join")

        by_member = other_api.delete(f"/api/rooms/{room['id']}")
        by_host = api.delete(f"/api/rooms/{room['id']}")

        assert by_member.status_code == 403
        assert by_host.status_code == 204

    def test_the_global_room_cannot_be_closed(self, api):
        lobby = api.get("/api/rooms/lobby").get_json()["room"]

        response = api.delete(f"/api/rooms/{lobby['id']}")

        assert response.status_code == 403

    def test_a_room_that_does_not_exist(self, api):
        assert api.get("/api/rooms/999999").status_code == 404


class TestVisibility:
    def test_you_see_the_lobby_your_rooms_and_rooms_you_joined(
        self, api, other_api, user
    ):
        api.post("/api/rooms", json={"name": "Mine"})
        theirs = other_api.post("/api/rooms", json={"name": "Theirs"}).get_json()
        other_api.post("/api/rooms", json={"name": "Theirs, private"})
        api.post(f"/api/rooms/{theirs['id']}/join")

        names = [room["name"] for room in api.get("/api/rooms").get_json()["items"]]

        assert "The Grove" in names
        assert "Mine" in names
        assert "Theirs" in names
        assert "Theirs, private" not in names

    def test_the_lobby_is_listed_first(self, api):
        api.post("/api/rooms", json={"name": "Mine"})

        items = api.get("/api/rooms").get_json()["items"]

        assert items[0]["is_global"] is True

    def test_the_listing_advertises_the_available_themes(self, api):
        assert "library" in api.get("/api/rooms").get_json()["themes"]

    def test_the_listing_omits_rosters(self, api):
        """A list of rooms does not need every member of every room, and
        fetching them would be a query per row."""
        api.post("/api/rooms", json={"name": "Mine"})

        assert all("members" not in room for room in api.get("/api/rooms").get_json()["items"])


class TestMaintenance:
    def test_the_sweep_removes_long_gone_members(self, app, api, make_user, user):
        api.post("/api/rooms/lobby/join")
        room = room_service.ensure_global_room()

        ghost = make_user("ghost")
        ghost.last_seen_at = utcnow() - timedelta(days=30)
        room_service.join(ghost, room)
        # join() touches presence, so push it back afterwards.
        ghost.last_seen_at = utcnow() - timedelta(days=30)
        membership = room_service.membership_for(ghost, room)
        membership.joined_at = utcnow() - timedelta(days=30)

        removed = room_service.sweep_stale_memberships()

        assert removed == 1
        assert room_service.membership_for(ghost, room) is None
        assert room_service.membership_for(user, room) is not None

    def test_the_sweep_spares_someone_who_is_merely_quiet(self, api, user):
        api.post("/api/rooms/lobby/join")
        user.last_seen_at = utcnow() - timedelta(minutes=30)

        assert room_service.sweep_stale_memberships() == 0
