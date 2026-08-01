"""Grove — service layer.

Each module here owns the business rules for one model: who is allowed to do
what, what counts as valid, and what else has to happen as a consequence
(completing a task bumps a streak; joining a room enforces its capacity).

The routes in api/routes/ do three things and nothing else — parse the
request, call one of these functions, serialise the result — so the rules
live in one place, are reachable without an HTTP request, and are testable
on their own.

Two conventions hold throughout:

* Services raise `ApiError` subclasses; they never build a response. The
  error handlers registered in api/utils/errors.py turn those into JSON.
* Services take *objects* (a `User`), never raw identifiers lifted from a
  request. Authorisation is settled by the caller before a service is
  reached.
"""

from api.services import friend, room, streak, task, user

__all__ = ["friend", "room", "streak", "task", "user"]
