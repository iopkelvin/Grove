# Kyle

"""
Grove — Task model (+ Tag).

Backs the Tasks page: each task has a title, a done/not-done state, a body
(description, opens on click), and one or more tags. Tags are reusable
labels a user defines (College, Home, ...), so Task<->Tag is many-to-many,
joined through the task_tags table below.

The "Today" tag: it's just a Tag named "Today". The home page shows tasks
that carry it. If we'd rather guarantee it can't be renamed/deleted, a
boolean is_today column on Task is the alternative. 

Tag lives here (not its own file) because it's part of the tasks feature. 
Split into api/models/tag.py later if we prefer one-per-file.
"""

from datetime import datetime, timezone

from api.config.database import db


def utcnow():
    return datetime.now(timezone.utc)


# Join table for the Task <-> Tag many-to-many. Pure link table, no model.
task_tags = db.Table(
    "task_tags",
    db.Column("task_id", db.Integer, db.ForeignKey("tasks.id"), primary_key=True),
    db.Column("tag_id", db.Integer, db.ForeignKey("tags.id"), primary_key=True),
)


class Tag(db.Model):
    __tablename__ = "tags"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(40), nullable=False)  # "College", "Today", ...

    owner = db.relationship("User", backref="tags")

    # A user can't have two tags with the same name.
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

    created_at = db.Column(db.DateTime, default=utcnow, nullable=False)

    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    owner = db.relationship("User", back_populates="tasks")

    # Many-to-many. backref gives each Tag a .tasks list for free.
    tags = db.relationship("Tag", secondary=task_tags, backref="tasks")

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "completed": self.completed,
            "user_id": self.user_id,
            "tags": [tag.name for tag in self.tags],
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<Task {self.title!r} done={self.completed}>"
