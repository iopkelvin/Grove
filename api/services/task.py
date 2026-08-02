"""
Grove — Task service.

The data layer for tasks: create / list / update / delete, plus tag handling.
Every function takes an internal integer `user_id` (never a supabase_id) so
it can be unit-tested without any auth in the picture.

Ownership is enforced on every read/write: a task is only ever found when its
user_id matches, so one user can't see or mutate another's tasks.
"""

from datetime import date, datetime

from api.config.database import db
from api.models.task import Task, Tag


def _parse_date(value):
    """"2026-08-01" -> date, "" / None -> None. Bad input also -> None
    (clearing a due date) rather than a 500 for a malformed request."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return None


def _parse_time(value):
    """"14:30" -> time, "" / None -> None. Bad input also -> None, same
    reasoning as _parse_date."""
    if not value:
        return None
    try:
        return datetime.strptime(value, "%H:%M").time()
    except ValueError:
        return None


def _get_or_create_tag(user_id, name):
    """Return this user's Tag named `name`, creating it if missing.

    Tags are per-user (unique constraint on user_id+name) — two users can each
    have a "School" tag as separate rows. Flushes (not commits) so a new tag
    gets an id while the whole create/update stays one transaction for the
    caller to commit."""
    name = (name or "").strip()
    tag = Tag.query.filter_by(user_id=user_id, name=name).first()
    if tag is None:
        tag = Tag(user_id=user_id, name=name)
        db.session.add(tag)
        db.session.flush()
    return tag


def list_tags(user_id):
    """This user's tags, alphabetical — lets the create-task form offer
    existing tags to pick from instead of only typing new ones."""
    tags = Tag.query.filter_by(user_id=user_id).order_by(Tag.name.asc()).all()
    return [t.to_dict() for t in tags]


def list_tasks(user_id):
    """Every task owned by this user, oldest first (matches the page's
    add-to-the-bottom behavior)."""
    tasks = (
        Task.query.filter_by(user_id=user_id)
        .order_by(Task.created_at.asc())
        .all()
    )
    return [t.to_dict() for t in tasks]


def create_task(user_id, title, description=None, tag_names=None, due_date=None, due_time=None, recurring=False):
    """Create one task for this user. `tag_names` is a list of strings like
    ["Work", "School"]; each is resolved to (or created as) one of the user's
    tags. `due_date` is an ISO "YYYY-MM-DD" string or None, `due_time` an
    "HH:MM" string or None. Returns the new task as a dict."""
    task = Task(
        title=title,
        description=description,
        user_id=user_id,
        due_date=_parse_date(due_date),
        due_time=_parse_time(due_time),
        recurring=bool(recurring),
    )
    if tag_names:
        task.tags = [_get_or_create_tag(user_id, n) for n in tag_names]
    db.session.add(task)
    db.session.commit()
    return task.to_dict()


def update_task(user_id, task_id, fields, commit=True):
    """Partial update — only keys present in `fields` (title / description /
    completed / tags) are changed, same pattern as update_user. Returns
    (task_dict, became_completed), or (None, False) if no task with that id
    belongs to this user (route turns that into a 404). became_completed is
    True only on the false -> true edge, so the caller can decide whether to
    bump the streak without double-counting a re-save.

    commit=False lets the caller fold this into a bigger transaction (e.g.
    the streak bump) — committing here would expire every object in the
    session, forcing a needless re-fetch of whatever the caller touches
    next."""
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return None, False

    was_done_today = task.is_done_today

    if "title" in fields:
        task.title = fields["title"]
    if "description" in fields:
        task.description = fields["description"] or None
    if "due_date" in fields:
        task.due_date = _parse_date(fields["due_date"])
    if "due_time" in fields:
        task.due_time = _parse_time(fields["due_time"])

    if "recurring" in fields:
        new_recurring = bool(fields["recurring"])
        # "done" is tracked differently for recurring vs one-off tasks (see
        # Task.is_done_today) — switching modes would otherwise silently
        # discard whatever "done today" state existed under the old
        # representation. Carry it across, unless the caller is also
        # setting `completed` explicitly in this same request (that value
        # wins instead of the carry-over).
        if new_recurring != task.recurring and "completed" not in fields:
            if new_recurring:
                task.last_completed_date = date.today() if was_done_today else None
            else:
                task.completed = was_done_today
        task.recurring = new_recurring

    if "completed" in fields:
        mark_done = bool(fields["completed"])
        if task.recurring:
            task.last_completed_date = date.today() if mark_done else None
        else:
            task.completed = mark_done
    if "tags" in fields:
        task.tags = [_get_or_create_tag(user_id, n) for n in (fields["tags"] or [])]

    became_completed = task.is_done_today and not was_done_today

    # Grab the dict before commit expires the session and forces a re-SELECT.
    result = task.to_dict()

    if commit:
        db.session.commit()

    return result, became_completed


def delete_task(user_id, task_id):
    """Delete this user's task. Returns True if something was deleted, False if
    no matching task existed (route turns False into a 404)."""
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return False
    db.session.delete(task)
    db.session.commit()
    return True