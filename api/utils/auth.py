"""Working out who is making a request.

Supabase issues the access token; we verify it against the project's JWT
secret and take the caller's id from the `sub` claim, so the request body
no longer gets a say in who it is.

With SUPABASE_JWT_SECRET unset the API falls back to believing whatever id
the request names — how this backend has always worked. That keeps a fresh
clone runnable with no setup, and is not safe anywhere near real data.
"""

import os
from functools import wraps

import jwt
from flask import g, jsonify, request

from api.models.user import User


def jwt_secret():
    return (os.environ.get("SUPABASE_JWT_SECRET") or "").strip()


def trusted_client_mode():
    """No secret configured, so identity is taken on trust."""
    return not jwt_secret()


def verified_supabase_id():
    """The `sub` of a valid bearer token, or None."""
    secret = jwt_secret()
    if not secret:
        return None

    scheme, _, token = request.headers.get("Authorization", "").partition(" ")
    if scheme.lower() != "bearer" or not token:
        return None

    try:
        claims = jwt.decode(
            token, secret, algorithms=["HS256"], audience="authenticated"
        )
    except jwt.InvalidTokenError:
        return None
    return claims.get("sub")


def claimed_supabase_id(keys):
    body = request.get_json(silent=True) or {}
    for key in keys:
        value = request.args.get(key) or body.get(key)
        if value:
            return value
    return None


def resolve_supabase_id(keys=(), fallback=None):
    """Who this request is from, token first.

    `keys` are the request fields the frontend uses to name itself, and
    `fallback` a URL parameter carrying the same thing. Both only count in
    trusted-client mode.
    """
    supabase_id = verified_supabase_id()
    if not supabase_id and trusted_client_mode():
        supabase_id = claimed_supabase_id(keys or ("supabase_id",)) or fallback
    return supabase_id


def caller(*keys):
    """The signed-in user, or None. For routes where that is allowed."""
    supabase_id = resolve_supabase_id(keys)
    if not supabase_id:
        return None
    return User.query.filter_by(supabase_id=supabase_id).first()


def login_required(*keys):
    """Put the caller on `g.user`, or refuse the request."""

    def decorator(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            supabase_id = resolve_supabase_id(keys, kwargs.get("supabase_id"))
            if not supabase_id:
                return jsonify({"error": "Sign in to do that"}), 401

            user = User.query.filter_by(supabase_id=supabase_id).first()
            if not user:
                return jsonify({"error": "User not found"}), 404

            g.user = user
            return view(*args, **kwargs)

        return wrapper

    return decorator
