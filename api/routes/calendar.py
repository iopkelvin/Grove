"""Grove — calendar endpoints (not implemented).

CalDAV integration is out of scope for this milestone and is listed as a
stretch goal on the development plan. The route exists anyway, for one
reason: the previous stub was

    @app.route("/api/calendar/<user_id>", methods=["GET"])
    def get_calendar(user_id):
        pass

which returns None, which Flask reports as a 500 with a message about view
functions. A frontend cannot tell that apart from a real server fault.

A deliberate 501 with a machine-readable code says "this is planned, not
broken", which is both true and something the UI can render as a friendly
empty state.
"""

from flask import Blueprint

from api.utils.errors import NotImplementedYet

calendar_bp = Blueprint("calendar", __name__, url_prefix="/api/calendar")


@calendar_bp.get("")
@calendar_bp.get("/events")
def list_events():
    raise NotImplementedYet(
        "Calendar sync is not available yet.",
        details={"planned": "CalDAV integration is tracked as a stretch goal."},
    )
