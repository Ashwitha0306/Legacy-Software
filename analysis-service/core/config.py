"""
Core Configuration — Pydantic Settings

All environment variables are declared here with types and defaults.
Settings are loaded once at startup and shared across all modules.

Usage:
    from core.config import settings
    print(settings.OLLAMA_BASE_URL)
"""

from typing import List, Optional
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import os


class Settings(BaseSettings):
    """
    Application-wide settings loaded from environment variables.
    The .env file at the monorepo root is resolved relative to this file.
    """

    model_config = SettingsConfigDict(
        # Walk up two levels from analysis-service/core/ to find root .env
        env_file=os.path.join(os.path.dirname(__file__), "..", "..", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    # ── Service ──────────────────────────────────────────────────────────────
    ENVIRONMENT: str = "development"
    ANALYSIS_SERVICE_PORT: int = 8000
    ANALYSIS_SERVICE_SECRET: str = "change_me"

    # ── MongoDB ──────────────────────────────────────────────────────────────
    MONGODB_URI: str = "mongodb://localhost:27017/legacy_intel"
    MONGODB_DB_NAME: str = "legacy_intel"

    # ── LLM Settings (OpenAI, Gemini, Groq, Anthropic, Ollama) ──────────────
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-4o-mini"

    GEMINI_API_KEY: Optional[str] = None
    GOOGLE_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-1.5-flash"

    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    ANTHROPIC_API_KEY: Optional[str] = None
    ANTHROPIC_MODEL: str = "claude-3-5-sonnet-20241022"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3"

    # ── File storage ─────────────────────────────────────────────────────────
    UPLOADS_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 500

    # ── CORS ─────────────────────────────────────────────────────────────────
    # Stored as a comma-separated string because pydantic-settings v2 attempts
    # JSON decoding before custom validators run on List fields.
    # Use the `parsed_origins` property wherever a List[str] is needed.
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000,http://localhost:5000"

    # ── Confidence score weights (RAV formula) ────────────────────────────────
    # Confidence = alpha * EvidenceMatch + beta * GraphConsistency + gamma * RetrievalCoverage
    CONFIDENCE_ALPHA: float = 0.5
    CONFIDENCE_BETA: float = 0.3
    CONFIDENCE_GAMMA: float = 0.2

    # ── Architecture Health Score weights ─────────────────────────────────────
    # HealthScore = w1*Maintainability + w2*(1-Coupling) + w3*Cohesion
    #             + w4*DocCoverage + w5*(1-DriftPercentage) + w6*VerificationConfidence
    HEALTH_W1: float = 0.20  # Maintainability
    HEALTH_W2: float = 0.15  # Coupling (inverted)
    HEALTH_W3: float = 0.15  # Cohesion
    HEALTH_W4: float = 0.15  # Documentation Coverage
    HEALTH_W5: float = 0.15  # Drift Percentage (inverted)
    HEALTH_W6: float = 0.20  # Verification Confidence

    # ── Logging ──────────────────────────────────────────────────────────────
    LOG_LEVEL: str = "DEBUG"

    @field_validator("CONFIDENCE_ALPHA", "CONFIDENCE_BETA", "CONFIDENCE_GAMMA")
    @classmethod
    def validate_confidence_weights(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("Confidence weight must be between 0 and 1")
        return v

    @field_validator("HEALTH_W1", "HEALTH_W2", "HEALTH_W3", "HEALTH_W4", "HEALTH_W5", "HEALTH_W6")
    @classmethod
    def validate_health_weights(cls, v: float) -> float:
        if not 0.0 <= v <= 1.0:
            raise ValueError("Health weight must be between 0 and 1")
        return v

    @property
    def parsed_origins(self) -> List[str]:
        """Return ALLOWED_ORIGINS as a parsed list of origin strings."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]

    @property
    def confidence_weights(self) -> dict:
        return {
            "alpha": self.CONFIDENCE_ALPHA,
            "beta":  self.CONFIDENCE_BETA,
            "gamma": self.CONFIDENCE_GAMMA,
        }

    @property
    def health_weights(self) -> dict:
        return {
            "w1": self.HEALTH_W1,
            "w2": self.HEALTH_W2,
            "w3": self.HEALTH_W3,
            "w4": self.HEALTH_W4,
            "w5": self.HEALTH_W5,
            "w6": self.HEALTH_W6,
        }


# Singleton instance — import this everywhere
settings = Settings()
