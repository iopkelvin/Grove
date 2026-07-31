"""Grove — task service.

Ownership is the rule that matters here: a task belongs to exactly one user,
and every read and write goes through a query scoped to that user. Nothing
in this module accepts a task id without also being told whose it must be,
so "task not found" and "task belongs to someone else" are indistinguishable
from outside — which is the point. Reporting 403 for the second case would
confirm to an attacker that the id exists.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, or_

from api.config.database import db
from api.models import Tag, Task, User, task_tags
from api.services import streak as streak_service
from api.utils.errors import NotFound, ValidationError
from api.utils.logger import get_logger

logger = get_logger(__name__)

MAX_TAGS_PER_TASK = 20
MAX_TASKS_PER_USER = 1000
UP_NEXT_LIMIT = 5

SORTABLE_FIELDS = {
    "created_at": Task.created_at,
    "due_date": Task.due_date,
    "title": Task.title,
}


# ── Tags ────────────────────────────────────────────────────────────────


def get_or_create_tags(account: User, names: list[str]) -> list[Tag]:
    """Resolve tag names to Tag rows belonging to this user, creating any
    that do not exist yet.

    Matching is case-insensitive so "today", "Today" and "TODAY" cannot
    become three separate tags that all look the same in the UI, while the
    casing the user first typed is what gets stored.
    """
    if not names:
        return []

    wanted = {name.strip().casefold(): name.strip() for name in names if name.strip()}
    if not wanted:
        return []

    existing = (
        db.session.query(Tag)
        .filter(Tag.user_id == account.id, func.lower(Tag.name).in_(list(wanted)))
        .all()
    )
    by_fold = {tag.name.casefold(): tag for tag in existing}

    resolved: list[Tag] = []
    for fold, original in wanted.items():
        tag = by_fold.get(fold)
        if tag is None:
            tag = Tag(user_id=account.id, name=original)
            db.session.add(tag)
            by_fold[fold] = tag
        resolved.append(tag)

    return resolved


def list_tags(account: User) -> list[Tag]:
    return (
        db.session.query(Tag)
        .filter(Tag.user_id == account.id)
        .order_by(Tag.name.asc())
        .all()
    )


def prune_orphan_tags(account: User) -> int:
    """Delete tags that are no longer attached to any task.

    Deleting the last task carrying a tag used to leave the tag behind
    forever, so a user's tag list grew monotonically and never shrank.

    Asked as a NOT-EXISTS query rather than by inspecting `tag.tasks` in
    Python: the caller has just deleted rows, and an already-loaded Tag
    still has its stale `tasks` collection in the identity map.
    """
    orphans = (
        db.session.query(Tag)
        .outerjoin(task_tags, Tag.id == task_tags.c.tag_id)
        .filter(Tag.user_id == account.id, task_tags.c.task_id.is_(None))
        .all()
    )
    for tag in orphans:
        db.session.delete(tag)
    return len(orphans)


# ── Reads ───────────────────────────────────────────────────────────────


def _owned_query(account: User):
    return db.session.query(Task).filter(Task.user_id == account.id)


def get_owned(account: User, task_id: int) -> Task:
    """The user's task with this id, or 404.

    Deliberately never distinguishes "no such task" from "not yours".
    """
    task = _owned_query(account).filter(Task.id == task_id).first()
    if task is None:
        raise NotFound("Task not found.")
    return task


def list_for_user(
    account: User,
    *,
    completed: bool | None = None,
    tag: str | None = None,
    search: str | None = None,
    sort: str = "created_at",
    descending: bool = True,
    limit: int = 50,
    offset: int = 0,
) -> tuple[list[Task], int]:
    """A page of the user's tasks plus the total that matched.

    The total is what lets the frontend show "showing 50 of 214" and decide
    whether a "load more" control belongs on screen at all.
    """
    query = _owned_query(account)

    if completed is not None:
        query = query.filter(Task.completed.is_(completed))

    if tag:
        query = query.filter(Task.tags.any(func.lower(Tag.name) == tag.strip().lower()))

    if search:
        needle = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Task.title).like(needle),
                func.lower(Task.description).like(needle),
            )
        )

    total = query.with_entities(func.count(Task.id)).order_by(None).scalar() or 0

    column = SORTABLE_FIELDS.get(sort, Task.created_at)
    ordering = column.desc() if descending else column.asc()
    # A stable secondary key: without it, rows sharing a due date come back
    # in whatever order the database feels like, so paging can show the same
    # task twice and skip another.
    tasks = query.order_by(ordering, Task.id.desc()).limit(limit).offset(offset).all()

    return tasks, total


def up_next(account: User, *, limit: int = UP_NEXT_LIMIT) -> list[Task]:
    """The next few things to actually do.

    Ordered by urgency rather than recency: overdue and due-soon tasks
    first, then undated ones oldest-first, because a to-do list that shows
    the most recently typed item at the top buries everything that matters.
    """
    dated = (
        _owned_query(account)
        .filter(Task.completed.is_(False), Task.due_date.isnot(None))
        .order_by(Task.due_date.asc(), Task.id.asc())
        .limit(limit)
        .all()
    )
    if len(dated) >= limit:
        return dated

    undated = (
        _owned_query(account)
        .filter(Task.completed.is_(False), Task.due_date.is_(None))
        .order_by(Task.created_at.asc(), Task.id.asc())
        .limit(limit - len(dated))
        .all()
    )
    return dated + undated


def stats(account: User) -> dict:
    """Counts for the Home and Streaks pages, in one query per number."""
    base = db.session.query(func.count(Task.id)).filter(Task.user_id == account.id)
    total = base.scalar() or 0
    completed = base.filter(Task.completed.is_(True)).scalar() or 0
    overdue = (
        base.filter(Task.completed.is_(False), Task.due_date < date.today()).scalar() or 0
    )
    due_today = (
        base.filter(Task.completed.is_(False), Task.due_date == date.today()).scalar() or 0
    )
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    completed_this_week = (
        db.session.query(func.count(Task.id))
        .filter(
            Task.user_id == account.id,
            Task.completed.is_(True),
            Task.completed_at >= week_ago,
        )
        .scalar()
        or 0
    )

    return {
        "total": total,
        "completed": completed,
        "open": total - completed,
        "overdue": overdue,
        "due_today": due_today,
        "completed_this_week": completed_this_week,
    }


# ── Writes ──────────────────────────────────────────────────────────────


def create(
    account: User,
    *,
    title: str,
    description: str | None = None,
    tags: list[str] | None = None,
    due_date: date | None = None,
) -> Task:
    # A ceiling per user, so one runaway script cannot fill the shared
    # database. Well above anything a real user reaches.
    current = db.session.query(func.count(Task.id)).filter(Task.user_id == account.id).scalar()
    if (current or 0) >= MAX_TASKS_PER_USER:
        raise ValidationError(
            {"title": f"You have reached the maximum of {MAX_TASKS_PER_USER} tasks."}
        )

    task = Task(
        title=title,
        description=description,
        due_date=due_date,
        user_id=account.id,
        tags=get_or_create_tags(account, tags or []),
    )
    db.session.add(task)
    db.session.commit()

    logger.info("task created", extra={"user_id": account.id, "task_id": task.id})
    return task


def update(account: User, task_id: int, changes: dict) -> tuple[Task, bool]:
    """Apply a partial update. Returns (task, streak_was_bumped).

    Only keys actually present in `changes` are touched, so a PATCH that
    sends `{"done": true}` cannot blank out the description.
    """
    task = get_owned(account, task_id)
    bumped = False

    if "title" in changes:
        task.title = changes["title"]
    if "description" in changes:
        task.description = changes["description"]
    if "due_date" in changes:
        task.due_date = changes["due_date"]
    if "tags" in changes:
        task.tags = get_or_create_tags(account, changes["tags"] or [])

    if "done" in changes:
        if task.mark_completed(bool(changes["done"])):
            streak_service.record_completion(account)
            bumped = True

    db.session.commit()
    return task, bumped


def delete(account: User, task_id: int) -> None:
    task = get_owned(account, task_id)
    db.session.delete(task)
    db.session.flush()
    prune_orphan_tags(account)
    db.session.commit()
    logger.info("task deleted", extra={"user_id": account.id, "task_id": task_id})


def clear_completed(account: User) -> int:
    """Bulk-delete every finished task. Returns how many went."""
    tasks = _owned_query(account).filter(Task.completed.is_(True)).all()
    for task in tasks:
        db.session.delete(task)
    db.session.flush()
    prune_orphan_tags(account)
    db.session.commit()
    return len(tasks)
