"""Grove — HTTP layer.

One blueprint per resource. Every route in here is deliberately short: parse
the request with api/utils/validation.py, call one function from
api/services/, serialise the result. Anything longer than that belongs in a
service, where it can be tested without an HTTP request.

The whole API used to live in a single 460-line app.py in which routing,
validation, authorisation, business rules and serialisation were interleaved
paragraph by paragraph.
"""

from flask import Flask

from api.routes.calendar import calendar_bp
from api.routes.friends import friends_bp
from api.routes.health import health_bp
from api.routes.rooms import rooms_bp
from api.routes.streaks import streaks_bp
from api.routes.tasks import tasks_bp
from api.routes.users import users_bp

BLUEPRINTS = (
    health_bp,
    users_bp,
    tasks_bp,
    friends_bp,
    rooms_bp,
    streaks_bp,
    calendar_bp,
)


def register_blueprints(app: Flask) -> None:
    for blueprint in BLUEPRINTS:
        app.register_blueprint(blueprint)


__all__ = ["BLUEPRINTS", "register_blueprints"]
