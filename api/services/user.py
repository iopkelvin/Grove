"""Grove — user service.

Account creation (mirroring a Supabase Auth user into our own `users`
table), profile reads and writes, presence, and username search.
"""

from __future__ import annotations

import re
import secrets
from datetime import timedelta, timezone

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError

from api.config.database import db
from api.models import User
from api.models.user import utcnow
from api.utils.errors import Conflict, NotFound, ValidationError
from api.utils.logger import get_logger
from api.utils.validation import escape_like

logger = get_logger(__name__)

# Usernames appear in URLs (/user/<username>) and get typed into a search
# box, so they are restricted to characters that survive both without
# escaping.
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,49}$")
_USERNAME_STRIP_RE = re.compile(r"[^a-z0-9._-]+")

MAX_USERNAME_ATTEMPTS = 25
SEARCH_MIN_LENGTH = 2
PRESENCE_WRITE_INTERVAL = timedelta(seconds=60)


# ── Lookups ─────────────────────────────────────────────────────────────


def find_by_supabase_id(supabase_id: str | None) -> User | None:
    if not supabase_id:
        return None
    return db.session.query(User).filter_by(supabase_id=supabase_id).first()


def find_by_username(username: str | None) -> User | None:
    """Case-insensitive: /user/Kelvin and /user/kelvin are the same person."""
    if not username:
        return None
    return (
        db.session.query(User)
        .filter(func.lower(User.username) == username.strip().lower())
        .first()
    )


def get_by_id(user_id: int) -> User:
    account = db.session.get(User, user_id)
    if account is None:
        raise NotFound("User not found.")
    return account


def require_by_username(username: str) -> User:
    account = find_by_username(username)
    if account is None:
        raise NotFound("User not found.")
    return account


# ── Usernames ───────────────────────────────────────────────────────────


def normalise_username_seed(raw: str | None) -> str:
    """Turn an arbitrary string — usually an email prefix — into something
    that could legally be a username.

    `john.doe+grove@berkeley.edu` yields `john.doe`, and a seed with nothing
    usable in it yields `grove`, so the caller always has a real base to
    append a suffix to instead of building the string "None2".
    """
    candidate = (raw or "").strip().lower()
    candidate = candidate.split("@", 1)[0]
    candidate = candidate.split("+", 1)[0]
    candidate = _USERNAME_STRIP_RE.sub("", candidate)
    candidate = candidate.strip("._-")
    if len(candidate) < 3:
        candidate = f"{candidate}grove" if candidate else "grove"
    return candidate[:40]


def generate_unique_username(seed: str | None) -> str:
    """A free username derived from `seed`.

    Two people can easily share an email prefix (john@gmail.com and
    john@yahoo.com), and username is a public handle with a unique
    constraint behind it, so collisions need a deterministic fallback rather
    than an IntegrityError at signup.
    """
    base = normalise_username_seed(seed)

    if find_by_username(base) is None:
        return base

    for suffix in range(2, MAX_USERNAME_ATTEMPTS):
        candidate = f"{base}{suffix}"[:50]
        if find_by_username(candidate) is None:
            return candidate

    # Sequential suffixes only run out if a popular prefix is heavily
    # contested; random ones keep the loop bounded in practice.
    while True:
        candidate = f"{base[:42]}{secrets.token_hex(3)}"
        if find_by_username(candidate) is None:
            return candidate


# ── Account creation ────────────────────────────────────────────────────


def sync_account(
    *,
    supabase_id: str,
    email: str | None,
    first_name: str,
    last_name: str,
    username_seed: str | None = None,
) -> tuple[User, bool]:
    """Get-or-create the Grove row for a Supabase user.

    Returns (user, created). Idempotent by design: the frontend calls this
    on every signup, and a retried or double-submitted signup must not
    produce a second row or an error.
    """
    existing = find_by_supabase_id(supabase_id)
    if existing is not None:
        return existing, False

    normalised_email = (email or "").strip().lower() or None
    if normalised_email:
        clash = db.session.query(User).filter(func.lower(User.email) == normalised_email).first()
        if clash is not None:
            # Same email, different Supabase id — the Supabase user was
            # deleted and recreated. Re-point the existing row instead of
            # orphaning all of its tasks and friendships behind an id
            # nobody can log in as any more.
            logger.warning(
                "re-linking existing account to a new supabase id",
                extra={"user_id": clash.id},
            )
            clash.supabase_id = supabase_id
            db.session.commit()
            return clash, False

    account = User(
        supabase_id=supabase_id,
        # The email column is NOT NULL and unique. A verified token without
        # an email claim (phone signup) still needs a value, and it has to
        # be unique per user — hence the supabase id in the placeholder.
        email=normalised_email or f"{supabase_id}@placeholder.invalid",
        username=generate_unique_username(username_seed or normalised_email),
        first_name=first_name,
        last_name=last_name,
        display_name=f"{first_name} {last_name}".strip().title() or None,
    )
    account.touch()
    db.session.add(account)

    try:
        db.session.commit()
    except IntegrityError:
        # Two concurrent signups for the same Supabase user raced past the
        # find_by_supabase_id check above. Whoever loses re-reads the
        # winner's row rather than surfacing a 500.
        db.session.rollback()
        winner = find_by_supabase_id(supabase_id)
        if winner is None:
            raise
        return winner, False

    logger.info("account created", extra={"user_id": account.id})
    return account, True


# ── Profile ─────────────────────────────────────────────────────────────

# Only these may be written through the profile endpoint. Email, username,
# supabase_id and every streak field are deliberately absent: they are
# either owned by Supabase or derived from user activity. An allow-list
# means a sensitive column added later cannot accidentally become writable.
EDITABLE_PROFILE_FIELDS = (
    "first_name",
    "last_name",
    "display_name",
    "bio",
    "avatar_url",
    "banner_url",
    "show_online_status",
)


def update_profile(account: User, changes: dict) -> User:
    unknown = set(changes) - set(EDITABLE_PROFILE_FIELDS)
    if unknown:
        raise ValidationError({field: "This field cannot be edited." for field in sorted(unknown)})

    for field, value in changes.items():
        setattr(account, field, value)

    db.session.commit()
    logger.info("profile updated", extra={"user_id": account.id, "fields": sorted(changes)})
    return account


def change_username(account: User, new_username: str) -> User:
    """Usernames are public handles, so they are validated strictly and
    checked for collisions before the unique constraint has to be."""
    candidate = new_username.strip().lower()

    if not USERNAME_RE.match(candidate):
        raise ValidationError(
            {
                "username": (
                    "Use 3-50 characters: lowercase letters, numbers, dots, "
                    "underscores or hyphens, starting with a letter or number."
                )
            }
        )

    if candidate != account.username and find_by_username(candidate) is not None:
        raise Conflict("That username is already taken.", code="username_taken")

    account.username = candidate
    db.session.commit()
    return account


# ── Presence ────────────────────────────────────────────────────────────


def touch_presence(account: User) -> None:
    """Record that the user is active right now.

    Called once per authenticated request. The write is skipped unless the
    stored timestamp is genuinely stale, so one page load costs a single
    UPDATE rather than one per API call it happens to make.
    """
    now = utcnow()
    last = account.last_seen_at
    if last is not None:
        if last.tzinfo is None:
            last = last.replace(tzinfo=timezone.utc)
        if now - last < PRESENCE_WRITE_INTERVAL:
            return

    account.last_seen_at = now
    db.session.commit()


# ── Search ──────────────────────────────────────────────────────────────


def search(term: str, *, exclude_user_id: int | None = None, limit: int = 20) -> list[User]:
    """Find users by username or display name.

    Wildcards in the term are escaped: without that, searching for "%"
    matched every row and turned the search box into a full user dump.
    A minimum length stops a single stray keystroke doing the same.
    """
    cleaned = (term or "").strip()
    if len(cleaned) < SEARCH_MIN_LENGTH:
        return []

    needle = escape_like(cleaned.lower())
    query = db.session.query(User).filter(
        db.or_(
            func.lower(User.username).like(f"%{needle}%", escape="\\"),
            func.lower(User.display_name).like(f"%{needle}%", escape="\\"),
        )
    )

    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)

    # Exact matches first, then prefix matches, then the rest — otherwise
    # searching a friend's exact username can bury them under everyone who
    # merely contains it as a substring.
    exact = func.lower(User.username) == cleaned.lower()
    prefix = func.lower(User.username).like(f"{needle}%", escape="\\")
    return query.order_by(exact.desc(), prefix.desc(), User.username.asc()).limit(limit).all()
