"""Grove — user and profile endpoints."""

from flask import Blueprint, jsonify, request

from api.services import friend as friend_service
from api.services import user as user_service
from api.utils.auth import (
    current_identity,
    current_user,
    optional_user,
    require_identity,
    require_user,
)
from api.utils.errors import Forbidden
from api.utils.validation import MISSING, json_body, query_int, validate

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.post("/sync")
@require_identity
def sync_user():
    """Create this Grove account, or return it if it already exists.

    Called by the frontend straight after Supabase signup. The supabase_id
    and email come from the verified token, never from the body — the body
    only supplies the display details Supabase does not know about.
    """
    identity = current_identity()
    body = json_body()

    fields = validate(body)
    first_name = fields.string("first_name", required=True, max_length=50, lower=True)
    last_name = fields.string("last_name", required=True, max_length=50, lower=True)
    username_seed = fields.string("username", max_length=100, default=None)
    body_email = fields.string("email", max_length=120, lower=True, default=None)
    fields.raise_if_invalid()

    account, created = user_service.sync_account(
        supabase_id=identity.supabase_id,
        # A verified token's email claim wins; the body is only a fallback
        # for trusted-client mode, where there is no token to read.
        email=identity.email or body_email,
        first_name=first_name,
        last_name=last_name,
        username_seed=username_seed,
    )

    return jsonify(account.to_dict(include_email=True)), (201 if created else 200)


@users_bp.get("/me")
@require_user
def get_me():
    """The signed-in user's own profile, including their email."""
    return jsonify(current_user().to_dict(include_email=True))


@users_bp.patch("/me")
@require_user
def update_me():
    account = current_user()
    changes = _parse_profile_changes(json_body())
    updated = user_service.update_profile(account, changes)
    return jsonify(updated.to_dict(include_email=True))


@users_bp.get("/search")
@require_user
def search_users():
    """Username / display-name search, for the Friends page."""
    term = request.args.get("q", "")
    limit = query_int("limit", default=20, minimum=1, maximum=50)

    me_id = current_user().id
    results = user_service.search(term, exclude_user_id=me_id, limit=limit)
    return jsonify(
        [
            {**account.to_summary(), "friendship_status": friend_service.status_between(me_id, account.id)}
            for account in results
        ]
    )


@users_bp.get("/by-username/<username>")
@optional_user
def get_user_by_username(username):
    """Public profile. Anyone may read it; nobody gets an email address.

    A signed-in viewer additionally gets `friendship_status`, so the profile
    can render "Friends" / "Requested" / "Add Friend" correctly on first
    paint rather than after a failed click.
    """
    account = user_service.require_by_username(username)
    data = account.to_dict(include_email=False)

    viewer = current_user()
    if viewer is not None and viewer.id != account.id:
        data["friendship_status"] = friend_service.status_between(viewer.id, account.id)
    if viewer is not None and viewer.id == account.id:
        data["email"] = account.email
        data["is_self"] = True

    return jsonify(data)


# ── Legacy id-in-the-path routes ────────────────────────────────────────
# These are what the previous frontend called. They are kept so a stale
# browser tab keeps working, but they now verify that the id in the path is
# the caller's own — which is exactly what was missing before, when knowing
# somebody's supabase_id was enough to read and rewrite their profile.


@users_bp.get("/<supabase_id>")
@require_user
def get_user(supabase_id):
    _assert_is_self(supabase_id)
    return jsonify(current_user().to_dict(include_email=True))


@users_bp.patch("/<supabase_id>")
@require_user
def update_user(supabase_id):
    _assert_is_self(supabase_id)
    changes = _parse_profile_changes(json_body())
    updated = user_service.update_profile(current_user(), changes)
    return jsonify(updated.to_dict(include_email=True))


# ── Helpers ─────────────────────────────────────────────────────────────


def _assert_is_self(supabase_id: str) -> None:
    if current_user().supabase_id != supabase_id:
        raise Forbidden("You can only access your own profile through this endpoint.")


def _parse_profile_changes(body: dict) -> dict:
    """Pull the editable profile fields out of a PATCH body.

    Absent keys are left out of the result entirely, so a PATCH touching one
    field cannot blank the others. Names are lower-cased on the way in
    because the UI capitalises them on the way out, and storing both
    "Kelvin" and "kelvin" makes search inconsistent.
    """
    fields = validate(body)

    parsed = {
        "first_name": fields.string("first_name", max_length=50, lower=True),
        "last_name": fields.string("last_name", max_length=50, lower=True),
        # These may legitimately be cleared, so an empty string is accepted
        # and stored as NULL rather than rejected.
        "display_name": fields.string("display_name", max_length=80, allow_empty=True),
        "bio": fields.string("bio", max_length=500, allow_empty=True),
        "avatar_url": fields.string("avatar_url", max_length=500, allow_empty=True),
        "banner_url": fields.string("banner_url", max_length=500, allow_empty=True),
        "show_online_status": fields.boolean("show_online_status"),
    }
    fields.raise_if_invalid()

    return {key: value for key, value in parsed.items() if value is not MISSING}
