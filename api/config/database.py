# Kyle

"""
Grove — database config.

Defines the single SQLAlchemy `db` object the rest of the backend imports.
Deliberately does NOT attach to the Flask app here — app.py does that with
db.init_app(app). Keeping them separate avoids circular imports between
app.py and the model files.
"""

from flask_sqlalchemy import SQLAlchemy

# The one db object for the whole app. Models import this and don't make their own. 
db = SQLAlchemy()

# Where the database actually lives. SQLite for now = a single file (grove.db)
# in the project root, zero setup. When the group is ready to host on Postgres
# (Supabase or otherwise), only this string changes — nothing in the models.
SQLALCHEMY_DATABASE_URI = "sqlite:///grove.db"
