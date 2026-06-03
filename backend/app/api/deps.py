from typing import Optional

from dome_core.auth import AuthError, make_supabase_fallback, verify_jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..core.config import settings
from ..core.db import get_db
from ..core.logging import get_logger

logger = get_logger(__name__)

# auto_error=False so we can return a custom 401 and support dev_bypass_auth
_bearer = HTTPBearer(auto_error=False)


def _supabase_for_fallback():
    """Supabase client for the network fallback, or None if auth is unconfigured."""
    try:
        return get_db()
    except RuntimeError:
        return None


# Validates a token via the legacy supabase.auth.get_user round-trip; used only
# when local JWKS verification can't reach a signing key (DA-005 resilience).
_network_fallback = make_supabase_fallback(_supabase_for_fallback)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    """Verify Supabase bearer token and return user_id.

    Verifies the JWT signature locally against Supabase's published JWKS
    (dome-core ``verify_jwt``), falling back to a live ``get_user`` call only on
    JWKS-infrastructure failure. When DEV_BYPASS_AUTH=true in .env, skips
    validation entirely and returns a fixed dev user ID. Never set in production.
    """
    if settings.dev_bypass_auth:
        return "00000000-0000-0000-0000-000000000000"

    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header required"
        )

    try:
        principal = verify_jwt(
            credentials.credentials,
            supabase_url=settings.supabase_url,
            network_fallback=_network_fallback,
        )
        return principal.user_id
    except AuthError as e:
        logger.warning("auth_error", error=str(e))
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed"
        )
