"""
MongoDB async connection management using Motor.

Provides get_database() for dependency injection in FastAPI endpoints.

Usage:
    from core.database import get_database
    db = await get_database()
    await db.users.find_one({"email": "..."})
"""

from typing import Optional
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from core.config import settings
from core.logger import get_logger

logger = get_logger(__name__)

_client: Optional[AsyncIOMotorClient] = None
_database: Optional[AsyncIOMotorDatabase] = None


async def connect_to_mongo() -> None:
    """Initialize the Motor client and connect to MongoDB Atlas (with local fallback)."""
    global _client, _database

    try:
        _client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            serverSelectionTimeoutMS=5000,
            socketTimeoutMS=45000,
        )
        _database = _client[settings.MONGODB_DB_NAME]
        await _database.command("ping")
        logger.info("MongoDB connection established", db=settings.MONGODB_DB_NAME)
    except Exception as exc:
        logger.warning("Primary MongoDB connection failed. Attempting fallback to local MongoDB...", error=str(exc))
        try:
            fallback_uri = "mongodb://127.0.0.1:27017"
            _client = AsyncIOMotorClient(fallback_uri, serverSelectionTimeoutMS=3000)
            _database = _client[settings.MONGODB_DB_NAME]
            await _database.command("ping")
            logger.info("[OK] Connected to local MongoDB fallback", db=settings.MONGODB_DB_NAME)
        except Exception as local_exc:
            logger.error("MongoDB connection failed: Could not connect to Atlas or local MongoDB.", error=str(local_exc))
            raise exc


async def close_mongo_connection() -> None:
    """Close the Motor client on application shutdown."""
    global _client, _database
    if _client:
        _client.close()
        _client = None
        _database = None
        logger.info("MongoDB connection closed")


def get_database() -> AsyncIOMotorDatabase:
    """
    Return the active database instance.
    Raises RuntimeError if called before connect_to_mongo().
    """
    if _database is None:
        raise RuntimeError(
            "Database not initialized. Ensure connect_to_mongo() was called during startup."
        )
    return _database
