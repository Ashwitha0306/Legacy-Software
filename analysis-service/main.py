"""
Analysis Service — FastAPI Application Entry Point

This service houses all multi-agent AI components of the RAV pipeline:
  - Preprocessing Agent
  - Parser Agent (Tree-sitter)
  - SSKG Construction Agent (NetworkX)
  - Retrieval Agent
  - Reconstruction Agent (LangChain + Llama 3)
  - Verification Agent
  - Evaluation Agent
  - (Tier 2 agents added progressively)

The Orchestrator in core/orchestrator.py coordinates all agents.
The backend (Node.js) calls this service via HTTP.
"""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from core.config import settings
from core.database import connect_to_mongo, close_mongo_connection
from core.logger import get_logger
from routers import health, pipeline, agents

logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    """Application lifespan handler — runs on startup and shutdown."""
    logger.info("Analysis Service starting up...")
    logger.info(f"   Environment : {settings.ENVIRONMENT}")
    logger.info(f"   Ollama model: {settings.OLLAMA_MODEL}")
    logger.info(f"   MongoDB URI : {settings.MONGODB_URI[:40]}...")

    await connect_to_mongo()
    logger.info("MongoDB connection established")

    yield  # Application runs here

    logger.info("Analysis Service shutting down...")
    await close_mongo_connection()


app = FastAPI(
    title="Legacy Software Intelligence — Analysis Service",
    description=(
        "FastAPI service that runs the Grounded Multi-Agent RAV pipeline "
        "for Java Spring Boot legacy codebase analysis."
    ),
    version="1.0.0",
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ────────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.parsed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────────────────────
app.include_router(health.router, prefix="/health", tags=["Health"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["Pipeline"])
app.include_router(agents.router, prefix="/agents", tags=["Agents"])
