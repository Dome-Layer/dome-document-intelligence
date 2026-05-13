from fastapi import APIRouter, Request

from ..core.db import get_db

router = APIRouter()


@router.delete("/auth/session", status_code=204)
async def delete_session(req: Request):
    try:
        db = get_db()
    except RuntimeError:
        return  # no-op when Supabase not configured
    auth = req.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return
    token = auth.removeprefix("Bearer ").strip()
    try:
        resp = db.auth.get_user(token)
        if resp and resp.user:
            db.auth.admin.sign_out(token)
    except Exception:
        pass  # best-effort
