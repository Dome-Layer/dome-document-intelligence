from typing import Optional

from dome_core.auth import AuthError, make_supabase_fallback, verify_jwt
from fastapi import Depends, Header, HTTPException, status
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
    x_service_key: Optional[str] = Header(default=None),
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[str]:
    """Authenticate the caller and return a user_id (or None for a trusted service).

    Accepts either a Supabase bearer token (verified locally against the published
    JWKS via dome-core ``verify_jwt``, with a live ``get_user`` fallback only on
    JWKS-infrastructure failure) OR an ``X-Service-Key`` matching
    AGENT_FLOW_SERVICE_KEY (the P5 agent-flow shim) — in which case there is no user
    and None is returned. When DEV_BYPASS_AUTH=true in .env, validation is skipped
    and a fixed dev user ID is returned. Never set in production.
    """
    if x_service_key:
        if settings.agent_flow_service_key and x_service_key == settings.agent_flow_service_key:
            return None
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid service key"
        )

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
