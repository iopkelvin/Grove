# Kyle

"""
Grove — Task service.

The data layer for tasks: create / list / update / delete, plus tag handling.
Routes in app.py stay thin and only deal with HTTP (resolving the signed-in
user from their supabase_id, choosing status codes); everything that touches
the database lives here. Every function takes an internal integer `user_id`
(never a supabase_id) so it can be unit-tested without any auth in the picture.

Ownership is enforced on every read/write: a task is only ever found when its
user_id matches, so one user can't see or mutate another's tasks.
"""

from api.config.database import db
from api.models.task import Task, Tag


def _get_or_create_tag(user_id, name):
    """Return this user's Tag with `name`, creating it if they don't have one.

    Tags are per-user (the model has a unique constraint on user_id+name), so
    two people can both have a "Today" tag and they're different rows. We flush
    (not commit) so a brand-new tag gets an id but the whole create/update stays
    a single transaction the caller commits.
    """
    name = (name or "").strip()
    tag = Tag.query.filter_by(user_id=user_id, name=name).first()
    if tag is None:
        tag = Tag(user_id=user_id, name=name)
        db.session.add(tag)
        db.session.flush()
    return tag


def list_tasks(user_id):
    """Every task owned by this user, oldest first (matches the page's
    add-to-the-bottom behavior). Flip to .desc() for newest-first."""
    tasks = (
        Task.query.filter_by(user_id=user_id)
        .order_by(Task.created_at.asc())
        .all()
    )
    return [t.to_dict() for t in tasks]


def create_task(user_id, title, description=None, tag_names=None):
    """Create one task for this user. `tag_names` is a list of strings like
    ["Today", "School"]; each is resolved to (or created as) one of the user's
    tags. Returns the new task as a dict."""
    task = Task(title=title, description=description, user_id=user_id)
    if tag_names:
        task.tags = [_get_or_create_tag(user_id, n) for n in tag_names]
    db.session.add(task)
    db.session.commit()
    return task.to_dict()


def update_task(user_id, task_id, fields, commit=True):
    """Partial update. `fields` only contains the keys the client actually sent
    (title / description / completed / tags), so an omitted key is left alone —
    same pattern as the update_user route. Returns (task_dict, became_completed),
    or (None, False) if no task with that id belongs to this user (route turns
    that into a 404). became_completed is True only on the false -> true edge —
    the caller uses it to decide whether to bump the streak, since re-saving an
    already-completed task shouldn't count as completing it again.

    commit=False lets a caller fold this into a bigger transaction (e.g. the
    streak bump) instead of committing here — otherwise SQLAlchemy expires
    every object in the session on commit, and whatever the caller touches
    next (like the user's streak) silently costs an extra round trip to
    re-fetch it from scratch."""
    task = Task.query.filter_by(id=task_id, user_id=user_id).first()
    if task is None:
        return None, False

    was_completed = task.completed

    if "title" in fields:
        task.title = fields["title"]
    if "description" in fields:
        task.description = fields["description"] or None
    if "completed" in fields:
        task.completed = bool(fields["completed"])
    if "tags" in fields:
        task.tags = [_get_or_create_tag(user_id, n) for n in (fields["tags"] or [])]

    became_completed = task.completed and not was_completed

    # Read while everything's still fresh in memory, before a commit would
    # expire it and force a needless re-SELECT just to serialize the same
    # values we already have.
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