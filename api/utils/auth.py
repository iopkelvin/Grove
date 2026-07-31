"""Grove — authentication and identity.

THE PROBLEM THIS FIXES
----------------------
Every endpoint used to take the caller's identity straight from the request:

    user = User.query.filter_by(supabase_id=request.args.get("supabase_id")).first()

A supabase_id is not a secret. It is returned by the public profile
endpoints, embedded in URLs, and visible in the browser's network tab. So
"authentication" amounted to knowing a value anyone could read, and with it
you could list another user's tasks, edit their profile, delete their data,
or accept friend requests on their behalf. There was no authentication at
all — only the appearance of it.

THE FIX
-------
Supabase Auth already issues a signed JWT to the browser on login. The
frontend now sends it as `Authorization: Bearer <token>`, and this module
verifies the signature with the project's JWT secret before believing a
single claim in it. Identity comes from the verified `sub` claim; the
request body's opinion about who it is no longer matters.

THE ESCAPE HATCH
----------------
`SUPABASE_JWT_SECRET` is not something a teammate can be expected to have
configured before running the app locally, and a project that only runs for
people holding production secrets does not get worked on. So when the secret
is absent the app boots in *trusted-client mode*: it accepts the legacy
`supabase_id` parameter, logs a warning on every startup, and reports
`"auth": "trusted-client"` from /api/health.

ProductionConfig sets ALLOW_UNVERIFIED_IDENTITY = False, so that mode cannot
reach production — create_app() raises instead of starting.
"""

from __future__ import annotations

from dataclasses import dataclass
from functools import wraps

import jwt
from flask import current_app, g, request

from api.utils.errors import Unauthorized
from api.utils.logger import get_logger

logger = get_logger(__name__)

# Query/body keys accepted as the caller's own id in trusted-client mode.
# Several routes historically spelled this differently; all of them are
# honoured so an older frontend build keeps working against a dev backend.
_LEGACY_ID_KEYS = ("supabase_id", "requester_supabase_id", "viewer_supabase_id")


@dataclass(frozen=True)
class Identity:
    """Who the caller claims to be, and whether we checked."""

    supabase_id: str
    email: str | None = None
    verified: bool = False


class TokenError(Unauthorized):
    """A bearer token was supplied but could not be trusted."""

    code = "invalid_token"


def _bearer_token() -> str | None:
    header = request.headers.get("Authorization", "")
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer":
        return None
    return token.strip() or None


def decode_token(token: str, secret: str, audience: str) -> dict:
    """Verify and decode a Supabase access token.

    Raises TokenError (401) with a message the frontend can act on: an
    expired token means "refresh the session and retry", anything else
    means "send the user back to the login page".
    """
    try:
        return jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience=audience,
            options={"require": ["exp", "sub"]},
        )
    except jwt.ExpiredSignatureError as exc:
        raise TokenError("Your session has expired. Please log in again.") from exc
    except jwt.InvalidAudienceError as exc:
        raise TokenError("This token was not issued for this application.") from exc
    except jwt.InvalidTokenError as exc:
        # Covers a bad signature, a malformed token, and a missing required
        # claim. Deliberately vague to the client, specific in the logs.
        logger.warning("rejected bearer token: %s", exc)
        raise TokenError("Your session is not valid. Please log in again.") from exc


def _identity_from_token() -> Identity | None:
    token = _bearer_token()
    if not token:
        return None

    secret = current_app.config.get("SUPABASE_JWT_SECRET")
    if not secret:
        # A token was sent but the server cannot check it. Ignoring it and
        # falling through to trusted-client mode is the honest behaviour —
        # pretending it was verified would be a lie the /api/health output
        # already contradicts.
        return None

    claims = decode_token(token, secret, current_app.config["SUPABASE_JWT_AUDIENCE"])
    subject = str(claims.get("sub") or "").strip()
    if not subject:
        raise TokenError("Token is missing a subject claim.")

    return Identity(supabase_id=subject, email=claims.get("email"), verified=True)


def _identity_from_legacy_params() -> Identity | None:
    """Trusted-client fallback: read the id the caller claims to be."""
    if not current_app.config.get("ALLOW_UNVERIFIED_IDENTITY"):
        return None

    body = request.get_json(silent=True) if request.is_json else None
    body = body if isinstance(body, dict) else {}

    for key in _LEGACY_ID_KEYS:
        value = (body.get(key) or request.args.get(key) or "").strip()
        if value:
            return Identity(supabase_id=value, verified=False)

    return None


def resolve_identity() -> Identity | None:
    """The caller's identity, verified if at all possible.

    A valid bearer token always wins. The legacy parameter is only consulted
    when no token was supplied AND the app is configured to allow it.
    """
    identity = _identity_from_token()
    if identity is not None:
        return identity
    return _identity_from_legacy_params()


def current_identity() -> Identity | None:
    """The identity resolved for this request, or None."""
    return getattr(g, "identity", None)


def current_user():
    """The `User` row for this request's caller, or None.

    Only populated by @require_user / @optional_user, which are the
    decorators that go to the database.
    """
    return getattr(g, "current_user", None)


def require_identity(view):
    """Caller must present a usable identity; the User row need not exist.

    Used by /api/users/sync, which runs immediately after Supabase signup —
    at that moment there is a verified token but no Grove user yet.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        identity = resolve_identity()
        if identity is None:
            raise Unauthorized("Sign in to continue.")
        g.identity = identity
        return view(*args, **kwargs)

    return wrapper


def require_user(view):
    """Caller must present an identity that maps to an existing Grove user.

    Sets `g.current_user`. Every route that reads or writes user-owned data
    uses this, and then uses `current_user()` rather than any id from the
    request — which is precisely the bug this module exists to close.
    """

    @wraps(view)
    def wrapper(*args, **kwargs):
        # Imported here rather than at module scope: models import the db
        # object, which imports config, which would close an import cycle
        # back through this module's callers.
        from api.services import user as user_service

        identity = resolve_identity()
        if identity is None:
            raise Unauthorized("Sign in to continue.")

        account = user_service.find_by_supabase_id(identity.supabase_id)
        if account is None:
            raise Unauthorized(
                "Your account has not finished setting up. Try logging out and back in.",
                code="account_not_synced",
            )

        g.identity = identity
        g.current_user = account
        return view(*args, **kwargs)

    return wrapper


def optional_user(view):
    """Populate the caller if there is one, but let anonymous requests
    through. Used by the public profile endpoint, which shows more (the
    friendship status) when it knows who is looking."""

    @wraps(view)
    def wrapper(*args, **kwargs):
        from api.services import user as user_service

        try:
            identity = resolve_identity()
        except Unauthorized:
            # A bad token on an optional-auth route should degrade to
            # anonymous, not fail the whole read.
            identity = None

        g.identity = identity
        g.current_user = (
            user_service.find_by_supabase_id(identity.supabase_id) if identity else None
        )
        return view(*args, **kwargs)

    return wrapper


def auth_mode(app) -> str:
    """Human-readable auth posture, surfaced by /api/health."""
    return "jwt" if app.config.get("SUPABASE_JWT_SECRET") else "trusted-client"
