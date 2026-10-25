"""
Developer Memory Agent (Agent 13 in the REQUIRED AGENTS list)

PURPOSE:
  Store developer corrections, accepted outputs, and rejected outputs in MongoDB.
  Re-inject stored developer corrections as grounded retrieval context in future analyses.

RETRIEVAL-BASED ADAPTATION:
  This agent performs retrieval-based adaptation using stored developer memory —
  no LLM model weights are ever updated. This ensures 100% reproducibility and
  eliminates catastrophic forgetting risks.

INPUTS:
  {
    "action": "store" | "retrieve",
    "feedback_type": "accept" | "reject" | "correction",
    "statement_id": "stmt-001",
    "correction_text": "...",
    "original_content": "..."
  }

OUTPUTS (AgentEnvelope):
  {
    "memories_count": 3,
    "retrieved_memories": [...]
  }
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional
from core.schemas import AgentEnvelope, AgentStatus
from core.database import get_database
from core.logger import get_logger

logger = get_logger(__name__)


async def store_developer_memory(
    project_id: str,
    user_id: str,
    statement_id: str,
    feedback_type: str,
    original_content: str,
    correction_text: Optional[str] = None,
) -> Dict[str, Any]:
    """Store a developer feedback/correction record in MongoDB."""
    db = get_database()
    record = {
        "projectId": project_id,
        "userId": user_id,
        "statementId": statement_id,
        "feedbackType": feedback_type,
        "originalContent": original_content,
        "correctionText": correction_text or "",
        "createdAt": datetime.utcnow(),
    }
    res = await db.developer_memories.insert_one(record)
    record["_id"] = str(res.inserted_id)
    logger.info("Developer memory stored", project_id=project_id, statement_id=statement_id)
    return record


async def retrieve_developer_memories(project_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Retrieve past developer corrections for re-injection as retrieval context."""
    try:
        db = get_database()
        cursor = db.developer_memories.find({"projectId": project_id}).sort("createdAt", -1).limit(limit)
        memories = []
        async for doc in cursor:
            doc["_id"] = str(doc["_id"])
            memories.append(doc)
        return memories
    except Exception as exc:
        logger.warning("Could not retrieve developer memories from MongoDB", error=str(exc))
        return []


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Developer Memory Agent."""
    logger.info("DeveloperMemoryAgent started", project_id=project_id)

    action = input_data.get("action", "retrieve")

    if action == "store":
        user_id = input_data.get("user_id", "default_user")
        stmt_id = input_data.get("statement_id", "")
        fb_type = input_data.get("feedback_type", "accept")
        orig_content = input_data.get("original_content", "")
        corr_text = input_data.get("correction_text")

        record = await store_developer_memory(
            project_id=project_id,
            user_id=user_id,
            statement_id=stmt_id,
            feedback_type=fb_type,
            original_content=orig_content,
            correction_text=corr_text,
        )
        return AgentEnvelope(
            projectId=project_id,
            agent="DeveloperMemoryAgent",
            status=AgentStatus.SUCCESS,
            data={"stored_memory": record},
        )

    # Retrieve mode
    memories = await retrieve_developer_memories(project_id=project_id)
    logger.info("DeveloperMemoryAgent completed", project_id=project_id, retrieved_count=len(memories))

    return AgentEnvelope(
        projectId=project_id,
        agent="DeveloperMemoryAgent",
        status=AgentStatus.SUCCESS,
        data={
            "memories_count": len(memories),
            "retrieved_memories": memories,
        },
    )
