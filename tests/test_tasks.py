"""Task CRUD, tags, ownership, filtering and paging."""

from datetime import date, timedelta

from api.config.database import db
from api.models import Tag, Task


class TestCreate:
    def test_creating_a_task(self, api):
        response = api.post("/api/tasks", json={"title": "Write the user manual"})

        assert response.status_code == 201
        body = response.get_json()
        assert body["title"] == "Write the user manual"
        assert body["done"] is False
        assert body["tags"] == []

    def test_title_is_required(self, api):
        response = api.post("/api/tasks", json={})

        assert response.status_code == 400
        assert "title" in response.get_json()["details"]["fields"]

    def test_a_whitespace_only_title_is_not_a_title(self, api):
        response = api.post("/api/tasks", json={"title": "     "})

        assert response.status_code == 400

    def test_titles_are_trimmed(self, api):
        response = api.post("/api/tasks", json={"title": "  padded  "})

        assert response.get_json()["title"] == "padded"

    def test_a_task_can_carry_a_due_date(self, api):
        response = api.post("/api/tasks", json={"title": "Submit", "due_date": "2026-08-15"})

        assert response.get_json()["due_date"] == "2026-08-15"

    def test_an_unparseable_due_date_is_rejected(self, api):
        response = api.post("/api/tasks", json={"title": "Submit", "due_date": "next tuesday"})

        assert response.status_code == 400
        assert "due_date" in response.get_json()["details"]["fields"]

    def test_a_body_that_is_not_json_gets_a_clear_message(self, api):
        response = api.post("/api/tasks", data="title=hello")

        assert response.status_code == 400
        assert response.get_json()["code"] == "bad_request"


class TestTags:
    def test_tags_are_created_on_first_use(self, api):
        response = api.post("/api/tasks", json={"title": "Read", "tags": ["College"]})

        assert response.get_json()["tags"] == ["College"]
        assert db.session.query(Tag).filter_by(name="College").count() == 1

    def test_the_same_tag_is_reused_across_tasks(self, api):
        api.post("/api/tasks", json={"title": "One", "tags": ["College"]})
        api.post("/api/tasks", json={"title": "Two", "tags": ["College"]})

        assert db.session.query(Tag).count() == 1

    def test_tag_matching_ignores_case(self, api):
        """"today", "Today" and "TODAY" used to become three separate tags
        that look identical in the UI."""
        api.post("/api/tasks", json={"title": "One", "tags": ["Today"]})
        api.post("/api/tasks", json={"title": "Two", "tags": ["today"]})
        api.post("/api/tasks", json={"title": "Three", "tags": ["TODAY"]})

        assert db.session.query(Tag).count() == 1

    def test_duplicate_tags_in_one_request_collapse(self, api):
        response = api.post(
            "/api/tasks", json={"title": "One", "tags": ["Home", "home", "HOME"]}
        )

        assert response.get_json()["tags"] == ["Home"]

    def test_deleting_the_last_task_with_a_tag_removes_the_tag(self, api, make_task):
        task = make_task("Only user of this tag", tags=["Fleeting"])

        api.delete(f"/api/tasks/{task['id']}")

        assert db.session.query(Tag).filter_by(name="Fleeting").count() == 0

    def test_a_tag_still_in_use_survives(self, api, make_task):
        keeper = make_task("Keeps the tag", tags=["Shared"])
        goer = make_task("Goes away", tags=["Shared"])

        api.delete(f"/api/tasks/{goer['id']}")

        assert db.session.query(Tag).filter_by(name="Shared").count() == 1
        assert api.get(f"/api/tasks?q={keeper['title']}").status_code == 200

    def test_the_tag_list_endpoint_returns_only_your_tags(self, api, other_api):
        api.post("/api/tasks", json={"title": "Mine", "tags": ["Private"]})
        other_api.post("/api/tasks", json={"title": "Theirs", "tags": ["Other"]})

        names = [tag["name"] for tag in api.get("/api/tasks/tags").get_json()]

        assert names == ["Private"]


class TestOwnership:
    def test_you_only_see_your_own_tasks(self, api, other_api):
        api.post("/api/tasks", json={"title": "Mine"})
        other_api.post("/api/tasks", json={"title": "Theirs"})

        titles = [t["title"] for t in api.get("/api/tasks").get_json()["items"]]

        assert titles == ["Mine"]

    def test_you_cannot_update_someone_elses_task(self, make_task, other_api):
        task = make_task("Not yours")

        response = other_api.put(f"/api/tasks/{task['id']}", json={"title": "hijacked"})

        assert response.status_code == 404

    def test_you_cannot_delete_someone_elses_task(self, make_task, other_api, api):
        task = make_task("Not yours")

        removal = other_api.delete(f"/api/tasks/{task['id']}")

        assert removal.status_code == 404
        assert api.get("/api/tasks").get_json()["total"] == 1

    def test_not_yours_looks_the_same_as_does_not_exist(self, make_task, other_api):
        """Answering 403 for one and 404 for the other would confirm which
        task ids exist."""
        task = make_task("Not yours")

        yours = other_api.put(f"/api/tasks/{task['id']}", json={"done": True})
        missing = other_api.put("/api/tasks/999999", json={"done": True})

        assert yours.status_code == missing.status_code == 404
        assert yours.get_json()["error"] == missing.get_json()["error"]


class TestUpdate:
    def test_marking_a_task_done(self, api, make_task):
        task = make_task()

        response = api.put(f"/api/tasks/{task['id']}", json={"done": True})

        assert response.get_json()["done"] is True
        assert response.get_json()["completed_at"] is not None

    def test_unchecking_a_task_clears_its_completion_time(self, api, make_task):
        task = make_task()
        api.put(f"/api/tasks/{task['id']}", json={"done": True})

        response = api.put(f"/api/tasks/{task['id']}", json={"done": False})

        assert response.get_json()["done"] is False
        assert response.get_json()["completed_at"] is None

    def test_a_partial_update_does_not_blank_other_fields(self, api, make_task):
        task = make_task("Original", description="Some detail", tags=["College"])

        response = api.put(f"/api/tasks/{task['id']}", json={"done": True})

        body = response.get_json()
        assert body["title"] == "Original"
        assert body["description"] == "Some detail"
        assert body["tags"] == ["College"]

    def test_title_cannot_be_emptied(self, api, make_task):
        task = make_task()

        response = api.put(f"/api/tasks/{task['id']}", json={"title": ""})

        assert response.status_code == 400

    def test_patch_and_put_behave_identically(self, api, make_task):
        one = make_task("One")
        two = make_task("Two")

        assert api.put(f"/api/tasks/{one['id']}", json={"done": True}).status_code == 200
        assert api.patch(f"/api/tasks/{two['id']}", json={"done": True}).status_code == 200

    def test_the_response_says_whether_the_streak_moved(self, api, make_task):
        task = make_task()

        first = api.put(f"/api/tasks/{task['id']}", json={"done": True})
        api.put(f"/api/tasks/{task['id']}", json={"done": False})
        second = api.put(f"/api/tasks/{task['id']}", json={"done": True})

        assert first.get_json()["streak_bumped"] is True
        # Already counted today, so re-completing does not move it again.
        assert second.get_json()["streak_bumped"] is False


class TestDelete:
    def test_deleting_a_task(self, api, make_task):
        task = make_task()

        removal = api.delete(f"/api/tasks/{task['id']}")

        assert removal.status_code == 204
        assert api.get("/api/tasks").get_json()["total"] == 0

    def test_deleting_a_task_that_is_already_gone(self, api, make_task):
        task = make_task()
        api.delete(f"/api/tasks/{task['id']}")

        second_removal = api.delete(f"/api/tasks/{task['id']}")

        assert second_removal.status_code == 404

    def test_clear_completed_removes_only_finished_tasks(self, api, make_task):
        done = make_task("Done")
        make_task("Still open")
        api.put(f"/api/tasks/{done['id']}", json={"done": True})

        response = api.post("/api/tasks/clear-completed")

        assert response.get_json()["deleted"] == 1
        assert api.get("/api/tasks").get_json()["total"] == 1


class TestListing:
    def test_the_response_carries_a_total(self, api, make_task):
        for index in range(3):
            make_task(f"Task {index}")

        body = api.get("/api/tasks?limit=2").get_json()

        assert len(body["items"]) == 2
        assert body["total"] == 3

    def test_paging_does_not_repeat_or_skip_rows(self, api, make_task):
        for index in range(5):
            make_task(f"Task {index}")

        first = api.get("/api/tasks?limit=2&offset=0").get_json()["items"]
        second = api.get("/api/tasks?limit=2&offset=2").get_json()["items"]
        third = api.get("/api/tasks?limit=2&offset=4").get_json()["items"]

        ids = [t["id"] for t in first + second + third]
        assert len(ids) == len(set(ids)) == 5

    def test_filtering_by_completion(self, api, make_task):
        done = make_task("Done")
        make_task("Open")
        api.put(f"/api/tasks/{done['id']}", json={"done": True})

        assert api.get("/api/tasks?completed=true").get_json()["total"] == 1
        assert api.get("/api/tasks?completed=false").get_json()["total"] == 1

    def test_filtering_by_tag(self, api, make_task):
        make_task("Tagged", tags=["College"])
        make_task("Untagged")

        body = api.get("/api/tasks?tag=college").get_json()

        assert [t["title"] for t in body["items"]] == ["Tagged"]

    def test_searching_by_text(self, api, make_task):
        make_task("Read chapter three")
        make_task("Buy groceries")

        body = api.get("/api/tasks?q=chapter").get_json()

        assert [t["title"] for t in body["items"]] == ["Read chapter three"]

    def test_a_nonsense_limit_is_a_client_error_not_a_silent_default(self, api):
        response = api.get("/api/tasks?limit=banana")

        assert response.status_code == 400

    def test_limit_is_capped(self, api):
        response = api.get("/api/tasks?limit=100000")

        assert response.status_code == 400


class TestUpNext:
    def test_soonest_due_date_comes_first(self, api, make_task):
        today = date.today()
        make_task("Later", due_date=str(today + timedelta(days=10)))
        make_task("Sooner", due_date=str(today + timedelta(days=1)))

        titles = [t["title"] for t in api.get("/api/tasks/up-next").get_json()]

        assert titles[0] == "Sooner"

    def test_dated_tasks_outrank_undated_ones(self, api, make_task):
        make_task("No deadline")
        make_task("Has a deadline", due_date=str(date.today() + timedelta(days=30)))

        titles = [t["title"] for t in api.get("/api/tasks/up-next").get_json()]

        assert titles == ["Has a deadline", "No deadline"]

    def test_completed_tasks_are_not_up_next(self, api, make_task):
        task = make_task("Finished")
        api.put(f"/api/tasks/{task['id']}", json={"done": True})

        assert api.get("/api/tasks/up-next").get_json() == []

    def test_an_overdue_task_is_flagged(self, api, make_task):
        make_task("Late", due_date=str(date.today() - timedelta(days=2)))

        assert api.get("/api/tasks/up-next").get_json()[0]["overdue"] is True


class TestStats:
    def test_counts_reflect_the_tasks(self, api, make_task):
        done = make_task("Done")
        make_task("Open")
        make_task("Late", due_date=str(date.today() - timedelta(days=1)))
        api.put(f"/api/tasks/{done['id']}", json={"done": True})

        stats = api.get("/api/tasks/stats").get_json()

        assert stats["total"] == 3
        assert stats["completed"] == 1
        assert stats["open"] == 2
        assert stats["overdue"] == 1

    def test_stats_are_scoped_to_you(self, api, other_api):
        other_api.post("/api/tasks", json={"title": "Theirs"})

        assert api.get("/api/tasks/stats").get_json()["total"] == 0


def test_task_rows_are_removed_with_their_owner(api, make_task, user):
    """Cascade check — orphaned tasks pointing at a deleted user would
    break every listing that joins to users."""
    make_task("Will be orphaned")

    db.session.delete(user)
    db.session.commit()

    assert db.session.query(Task).count() == 0
