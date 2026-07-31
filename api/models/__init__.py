"""Grove — models package.

Importing every model here (1) registers each table so `db.create_all()` and
Alembic autogenerate see all of them, and (2) lets other code write
`from api.models import User`.

Calendar is intentionally absent: it is out of scope for this milestone.
"""

from api.models.friend import (
    FRIENDSHIP_STATUSES,
    STATUS_ACCEPTED,
    STATUS_DECLINED,
    STATUS_PENDING,
    Friendship,
)
from api.models.room import (
    DEFAULT_ROOM_THEME,
    GLOBAL_ROOM_NAME,
    MAX_ROOM_CAPACITY,
    ROOM_THEMES,
    Room,
    RoomMembership,
)
from api.models.streak import Streak, StreakDay
from api.models.task import Tag, Task, task_tags
from api.models.user import ONLINE_WINDOW, User

__all__ = [
    "DEFAULT_ROOM_THEME",
    "FRIENDSHIP_STATUSES",
    "GLOBAL_ROOM_NAME",
    "MAX_ROOM_CAPACITY",
    "ONLINE_WINDOW",
    "ROOM_THEMES",
    "STATUS_ACCEPTED",
    "STATUS_DECLINED",
    "STATUS_PENDING",
    "Friendship",
    "Room",
    "RoomMembership",
    "Streak",
    "StreakDay",
    "Tag",
    "Task",
    "User",
    "task_tags",
]
