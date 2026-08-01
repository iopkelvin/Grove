"""
Grove — Auth verification.

Verifies the Supabase-issued access token so routes can trust
`g.supabase_id` instead of a client-submitted value. Verification is
always local (an HMAC check or a cached JWKS lookup) — never a network
call per request, so this doesn't add latency.
"""

import os
import warnings
from functools import wraps

import jwt
from flask import g, jsonify, request
from jwt import PyJWKClient

_JWT_SECRET = os.environ.get("SUPABASE_JWT_SECRET")
_SUPABASE_URL = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
_jwks_client = PyJWKClient(f"{_SUPABASE_URL}/auth/v1/.well-known/jwks.json") if _SUPABASE_URL else None

if not _JWT_SECRET and not _jwks_client:
    warnings.warn(
        "Neither SUPABASE_JWT_SECRET nor SUPABASE_URL is set — every "
        "authenticated route will reject every request. Set one of them "
        "(see .env.example).",
        stacklevel=2,
    )


def verify_token(token):
    """Return the verified Supabase user id (the `sub` claim), or None if
    there's no token, it's expired, or it doesn't check out. Prefers the
    shared HS256 secret (older Supabase projects) when configured; falls
    back to the project's cached JWKS (newer, rotating-key projects)."""
    if not token:
        return None
    try:
        if _JWT_SECRET:
            payload = jwt.decode(token, _JWT_SECRET, algorithms=["HS256"], audience="authenticated")
        elif _jwks_client:
            signing_key = _jwks_client.get_signing_key_from_jwt(token)
            payload = jwt.decode(token, signing_key.key, algorithms=["RS256", "ES256"], audience="authenticated")
        else:
            return None
    except jwt.PyJWTError:
        return None
    return payload.get("sub")


def verify_request():
    """verify_token() applied to the current request's Authorization header."""
    auth_header = request.headers.get("Authorization", "")
    token = auth_header[len("Bearer "):] if auth_header.startswith("Bearer ") else None
    return verify_token(token)


def require_auth(view):
    """Reject the request with 401 unless it carries a valid Supabase
    access token. On success, sets g.supabase_id to the verified id — the
    one identity routes should trust, instead of any supabase_id the
    client also happens to send in the body/query/URL."""
    @wraps(view)
    def wrapped(*args, **kwargs):
        supabase_id = verify_request()
        if not supabase_id:
            return jsonify({"error": "Unauthorized"}), 401
        g.supabase_id = supabase_id
        return view(*args, **kwargs)

    return wrapped
