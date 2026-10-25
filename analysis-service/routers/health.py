"""
Health router for the Analysis Service.

GET /health         — liveness probe
GET /health/ready   — readiness probe (checks MongoDB connection)
"""

from datetime import datetime
from fastapi import APIRouter
from fastapi.responses import ORJSONResponse

from core.database import get_database
from core.config import settings
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


@router.get("/", response_class=ORJSONResponse)
async def liveness() -> dict:
    """Liveness probe — returns 200 if the FastAPI process is up."""
    return {
        "success": True,
        "service": "Legacy Intel Analysis Service",
        "status": "ok",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.ENVIRONMENT,
        "ollama_model": settings.OLLAMA_MODEL,
    }


@router.get("/ready", response_class=ORJSONResponse)
async def readiness() -> dict:
    """Readiness probe — checks that MongoDB is reachable."""
    checks: dict = {"mongodb": "unknown"}
    overall = "ok"

    try:
        db = get_database()
        await db.command("ping")
        checks["mongodb"] = "connected"
    except Exception as exc:
        checks["mongodb"] = f"error: {exc}"
        overall = "degraded"
        logger.warning("Readiness check: MongoDB ping failed", error=str(exc))

    status_code = 200 if overall == "ok" else 503
    return ORJSONResponse(
        status_code=status_code,
        content={
            "success": overall == "ok",
            "service": "Legacy Intel Analysis Service",
            "status": overall,
            "timestamp": datetime.utcnow().isoformat(),
            "checks": checks,
        },
    )
