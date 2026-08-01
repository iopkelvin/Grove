"""
Grove — models package.

Importing every model here (1) registers each table so db.create_all()
builds all of them, and (2) lets other code do `from api.models import User`.

Calendar is intentionally excluded for now (group said later).
"""

from api.models.user import User
from api.models.task import Task, Tag, task_tags
from api.models.streak import Streak
from api.models.room import Room, RoomMembership
from api.models.friend import Friendship

__all__ = [
    "User",
    "Task",
    "Tag",
    "task_tags",
    "Streak",
    "Room",
    "RoomMembership",
    "Friendship",
]
