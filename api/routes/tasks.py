"""Grove — task endpoints.

The task id is always taken from the URL and the owner always from the
verified session, so there is no request in which a caller can name both a
task and whose task it is. That is what makes cross-user access impossible
here rather than merely unlikely.
"""

from flask import Blueprint, jsonify, request

from api.services import task as task_service
from api.utils.auth import current_user, require_user
from api.utils.validation import (
    MISSING,
    json_body,
    pagination_args,
    query_flag,
    validate,
)

tasks_bp = Blueprint("tasks", __name__, url_prefix="/api/tasks")

SORT_FIELDS = ("created_at", "due_date", "title")


@tasks_bp.get("")
@require_user
def list_tasks():
    """A page of the caller's tasks.

    Returns an envelope rather than a bare array. A bare array cannot carry
    the total, so the UI has no way to know whether it is showing
    everything, and adding that later would be a breaking change.
    """
    limit, offset = pagination_args(default_limit=100, max_limit=200)

    sort = request.args.get("sort", "created_at")
    if sort not in SORT_FIELDS:
        sort = "created_at"

    tasks, total = task_service.list_for_user(
        current_user(),
        completed=query_flag("completed"),
        tag=request.args.get("tag"),
        search=request.args.get("q"),
        sort=sort,
        descending=request.args.get("order", "desc") != "asc",
        limit=limit,
        offset=offset,
    )

    return jsonify(
        {
            "items": [task.to_dict() for task in tasks],
            "total": total,
            "limit": limit,
            "offset": offset,
        }
    )


@tasks_bp.get("/up-next")
@require_user
def get_up_next():
    """The handful of tasks the Home page's "Up Next" card shows."""
    tasks = task_service.up_next(current_user())
    return jsonify([task.to_dict() for task in tasks])


@tasks_bp.get("/stats")
@require_user
def get_stats():
    return jsonify(task_service.stats(current_user()))


@tasks_bp.get("/tags")
@require_user
def get_tags():
    return jsonify([tag.to_dict() for tag in task_service.list_tags(current_user())])


@tasks_bp.post("")
@require_user
def create_task():
    body = json_body()

    fields = validate(body)
    title = fields.string("title", required=True, max_length=200)
    description = fields.string("description", max_length=2000, allow_empty=True, default=None)
    tags = fields.string_list("tags", default=[])
    due_date = fields.date("due_date", default=None)
    fields.raise_if_invalid()

    task = task_service.create(
        current_user(),
        title=title,
        description=description,
        tags=tags,
        due_date=due_date,
    )
    return jsonify(task.to_dict()), 201


@tasks_bp.route("/<int:task_id>", methods=["PUT", "PATCH"])
@require_user
def update_task(task_id):
    """Partial update.

    PUT is accepted alongside PATCH because that is the verb the existing
    frontend uses; the semantics are PATCH's either way — fields that are
    not present are left untouched.
    """
    body = json_body()

    fields = validate(body)
    parsed = {
        "title": fields.string("title", max_length=200),
        "description": fields.string("description", max_length=2000, allow_empty=True),
        "tags": fields.string_list("tags"),
        "due_date": fields.date("due_date"),
        "done": fields.boolean("done"),
    }
    fields.raise_if_invalid()

    changes = {key: value for key, value in parsed.items() if value is not MISSING}
    task, streak_bumped = task_service.update(current_user(), task_id, changes)

    # Telling the client whether the streak moved saves it a follow-up
    # request to find out — which the Tasks page previously fired on every
    # single completion.
    return jsonify({**task.to_dict(), "streak_bumped": streak_bumped})


@tasks_bp.delete("/<int:task_id>")
@require_user
def delete_task(task_id):
    task_service.delete(current_user(), task_id)
    return "", 204


@tasks_bp.post("/clear-completed")
@require_user
def clear_completed():
    removed = task_service.clear_completed(current_user())
    return jsonify({"deleted": removed})
