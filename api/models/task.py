"""Grove — Task model (+ Tag).

Backs the Tasks page: each task has a title, a done/not-done state, a body
(description, opens on click), an optional due date, and any number of tags.
Tags are reusable labels a user defines (College, Home, ...), so Task<->Tag
is many-to-many, joined through the task_tags table below.

The "Today" tag is just a Tag named "Today"; the home page shows tasks that
carry it.

Tag lives here rather than in its own file because it is part of the tasks
feature and has no meaning outside it.
"""

from datetime import date, datetime, timezone

from api.config.database import db


def utcnow():
    return datetime.now(timezone.utc)


# Join table for the Task <-> Tag many-to-many. Pure link table, no model.
# Rows here are cleaned up by SQLAlchemy's own handling of the relationship
# when either side is deleted, so no database-level ON DELETE is needed.
task_tags = db.Table(
    "task_tags",
    db.Column("task_id", db.Integer, db.ForeignKey("tasks.id"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id"), primary_key=True),
)


class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    # No index=True: uq_user_tag_name(user_id, name) already indexes user_id
    # as its leading column.
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(40), nullable=False)  # "College", "Today", ...

    owner = db.relationship("User", backref="tags")

    # A user cannot have two tags with the same name.
    __table_args__ = (
        db.UniqueConstraint("user_id", "name", name="uq_user_tag_name"),
    )

    def to_dict(self):
        return {"id": self.id, "name": self.name, "user_id": self.user_id}

    def __repr__(self):
        return f"<Tag {self.name!r}>"


class Task(db.Model):
    __tablename__ = "tasks"

    id = db.Column(db.Integer, primary_key=True)

    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=True)   # body, opens on click
    completed = db.Column(db.Boolean, default=False, nullable=False)

    # When it was ticked off. The bare boolean could not answer "what did I
    # get done this week", which is exactly what the Streaks page shows.
    completed_at = db.Column(db.DateTime, nullable=True)

    # Optional deadline. Drives the "Up Next" card, which otherwise has no
    # basis on which to decide what comes next.
    due_date = db.Column(db.Date, nullable=True)

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    owner = db.relationship("User", back_populates="tasks")

    # Many-to-many. backref gives each Tag a .tasks list for free.
    tags = db.relationship("Tag", secondary=task_tags, backref="tasks", lazy="selectin")

    @property
    def is_overdue(self) -> bool:
        return bool(self.due_date and not self.completed and self.due_date < date.today())

    def mark_completed(self, completed: bool) -> bool:
        """Set the done state. Returns True only on a false -> true edge,
        which is what the caller uses to decide whether to bump the streak."""
        newly_completed = completed and not self.completed
        self.completed = completed
        self.completed_at = utcnow() if completed else None
        return newly_completed

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            # The frontend has always called this "done"; the column is
            # "completed". Keeping the API name stable means the rename
            # never has to ripple through the UI.
            "done": self.completed,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "overdue": self.is_overdue,
            "user_id": self.user_id,
            "tags": [tag.name for tag in self.tags],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Task {self.title!r} done={self.completed}>"
