"""
Grove — User service.

Data layer for users: lookups, signup sync, profile updates, and search.
"""

from api.config.database import db
from api.models.user import User


def find_by_supabase_id(supabase_id):
    return User.query.filter_by(supabase_id=supabase_id).first()


def find_by_username(username):
    return User.query.filter(db.func.lower(User.username) == username.lower()).first()


def find_for_streaks(user_id):
    """The streaks route accepts the Supabase UUID used by the frontend, but
    also accepts the internal numeric id for convenience in local testing."""
    user = find_by_supabase_id(user_id)
    if not user and str(user_id).isdigit():
        user = db.session.get(User, int(user_id))
    return user


def generate_unique_username(base):
    """base is the email prefix picked at signup; two people can easily
    share one (john@gmail.com vs john@yahoo.com), and username is now a
    public, searchable handle, so collisions need a fallback instead of
    tripping the DB's unique constraint."""
    username = base
    suffix = 1
    while User.query.filter_by(username=username).first():
        suffix += 1
        username = f"{base}{suffix}"
    return username


def get_or_create(supabase_id, email, first_name, last_name, username):
    """Supabase Auth handles actual login/signup/session; this creates our
    own `users` row after Supabase signs someone up (or returns the existing
    one if this supabase_id has already been synced). Returns (user_dict,
    created) so the route can pick 201 vs 200."""
    existing = find_by_supabase_id(supabase_id)
    if existing:
        return existing.to_dict(), False

    user = User(
        supabase_id=supabase_id,
        email=email,
        username=generate_unique_username(username),
        first_name=first_name,
        last_name=last_name,
        display_name=f"{first_name} {last_name}",
    )
    db.session.add(user)
    db.session.commit()
    return user.to_dict(), True


def update_profile(user, data):
    """Partial update. Only first_name, last_name, display_name, bio,
    avatar_url, and banner_url are editable here — email and streak are
    intentionally never read from the body. Returns (user_dict, error);
    error is set (and nothing is saved) if a required field was cleared."""
    if "first_name" in data:
        first_name = (data.get("first_name") or "").strip().lower()
        if not first_name:
            return None, "first_name cannot be empty"
        user.first_name = first_name
    if "last_name" in data:
        last_name = (data.get("last_name") or "").strip().lower()
        if not last_name:
            return None, "last_name cannot be empty"
        user.last_name = last_name
    if "display_name" in data:
        user.display_name = (data.get("display_name") or "").strip() or None
    if "bio" in data:
        user.bio = (data.get("bio") or "").strip() or None
    if "avatar_url" in data:
        user.avatar_url = (data.get("avatar_url") or "").strip() or None
    if "banner_url" in data:
        user.banner_url = (data.get("banner_url") or "").strip() or None

    db.session.commit()
    return user.to_dict(), None


def search(query, exclude_supabase_id=None, limit=20):
    """Matches username, first name, or last name — the public, searchable
    fields (unlike supabase_id, an opaque UUID nobody would type in a search
    box, or email, which is never exposed to other users)."""
    like = f"%{query}%"
    results = User.query.filter(
        db.or_(
            User.username.ilike(like),
            User.first_name.ilike(like),
            User.last_name.ilike(like),
        )
    )
    if exclude_supabase_id:
        results = results.filter(User.supabase_id != exclude_supabase_id)
    return results.limit(limit).all()
