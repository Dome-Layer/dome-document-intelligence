from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from ..core.config import settings
from ..core.db import get_db
from ..core.logging import get_logger

logger = get_logger(__name__)

# auto_error=False so we can return a custom 401 and support dev_bypass_auth
_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> str:
    """Verify Supabase bearer token and return user_id.

    When DEV_BYPASS_AUTH=true in .env, skips validation entirely
    and returns a fixed dev user ID. Never set this in production.
    """
    if settings.dev_bypass_auth:
        return "00000000-0000-0000-0000-000000000000"

    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authorization header required")

    token = credentials.credentials
    try:
        db = get_db()
        response = db.auth.get_user(token)
        if not response or not response.user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
        return str(response.user.id)
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("auth_error", error=str(e))
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication failed")
