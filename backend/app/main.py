from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from starlette.middleware.base import BaseHTTPMiddleware

from .core.config import settings
from .core.limiter import limiter
from .core.logging import configure_logging, get_logger
from .models.schemas import HealthResponse
from .api.extract import router as extract_router
from .api.rules import router as rules_router
from .api.audit import router as audit_router
from .api.extractions import router as extractions_router

configure_logging()
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info("dome_document_intelligence_starting", version="1.0.0")
    yield
    logger.info("dome_document_intelligence_shutdown")


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.environment == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=63072000; includeSubDomains"
            )
        return response


app = FastAPI(
    title="Dome Document Intelligence",
    description="Governance-driven document extraction API. DOME Phase: Orchestrate & Model.",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware is applied last-registered-first (last added = outermost).
# CORSMiddleware must be outermost so CORS headers are present on all responses.
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(extract_router, prefix="/api")
app.include_router(rules_router, prefix="/api")
app.include_router(audit_router, prefix="/api")
app.include_router(extractions_router, prefix="/api")


@app.get("/api/health", response_model=HealthResponse, tags=["Health"])
async def health() -> HealthResponse:
    try:
        from .core.db import get_db
        db = get_db()
        db.table("governance_rules").select("id").limit(1).execute()
        return HealthResponse(status="ok")
    except Exception as e:
        logger.warning("health_check_db_fail", error=str(e))
        return HealthResponse(status="degraded")


@app.head("/api/health")
async def health_head() -> None:
    return None
