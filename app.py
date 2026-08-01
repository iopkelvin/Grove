"""Grove — WSGI entry point.

This file used to be the whole backend: 460 lines in which routing,
validation, authorisation, business rules and serialisation were interleaved
paragraph by paragraph. All of it now lives in the `api` package — see
api/__init__.py for the boot sequence.

What remains is the object gunicorn and the flask CLI need to find:

    gunicorn app:app
    flask --app app db upgrade
    python app.py            # local development server
"""

import os

from api import create_app

app = create_app()

if __name__ == "__main__":
    # Host, port and debug come from the environment so running this
    # directly behaves the same way as running it anywhere else, rather
    # than hard-coding development settings into the entry point.
    app.run(
        host=os.environ.get("HOST", "127.0.0.1"),
        port=int(os.environ.get("PORT", "5000")),
        debug=app.config.get("DEBUG", False),
    )
