"""
Documentation Drift Agent (Agent 9 in the REQUIRED AGENTS list)

PURPOSE:
  Compares documentation claims across two analysis runs (snapshot 1 vs snapshot 2).
  Flags stale documentation claims where underlying source code changed but the
  documentation was not updated.

INPUTS:
  {
    "snapshot1_statements": [...],
    "snapshot2_statements": [...],
    "changed_files": ["src/main/java/com/example/UserService.java", ...]
  }

OUTPUTS (AgentEnvelope):
  {
    "doc_drift_percentage": 15.4,
    "stale_claims": [...],
    "added_claims": [...],
    "removed_claims": [...]
  }
"""

from __future__ import annotations

from typing import Any, Dict, List, Set
from core.schemas import AgentEnvelope, AgentStatus
from core.logger import get_logger

logger = get_logger(__name__)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Documentation Drift Agent."""
    logger.info("DocumentationDriftAgent started", project_id=project_id)

    snap1_stmts = input_data.get("snapshot1_statements", [])
    snap2_stmts = input_data.get("snapshot2_statements", [])
    changed_files = set(input_data.get("changed_files", []))

    snap1_map = {s.get("content"): s for s in snap1_stmts if isinstance(s, dict)}
    snap2_map = {s.get("content"): s for s in snap2_stmts if isinstance(s, dict)}

    stale_claims: List[Dict[str, Any]] = []
    added_claims: List[Dict[str, Any]] = []
    removed_claims: List[Dict[str, Any]] = []

    # Check for removed claims or claims linked to modified files
    for content, stmt in snap1_map.items():
        if content not in snap2_map:
            removed_claims.append(stmt)
        else:
            # Check if supporting file was modified
            sup_file = stmt.get("supporting_file")
            if sup_file and any(c_file in sup_file for c_file in changed_files):
                stale_claims.append({
                    "statement_id": stmt.get("statement_id"),
                    "content": content,
                    "supporting_file": sup_file,
                    "reason": f"Source file '{sup_file}' was modified in snapshot 2, but documentation claim remains unchanged.",
                })

    for content, stmt in snap2_map.items():
        if content not in snap1_map:
            added_claims.append(stmt)

    total_claims = len(snap1_map) or 1
    doc_drift_percentage = round((len(stale_claims) + len(removed_claims)) / total_claims * 100, 2)

    logger.info(
        "DocumentationDriftAgent completed",
        project_id=project_id,
        stale_count=len(stale_claims),
        drift_percentage=doc_drift_percentage,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="DocDriftAgent",
        status=AgentStatus.SUCCESS,
        data={
            "doc_drift_percentage": doc_drift_percentage,
            "stale_claims": stale_claims,
            "added_claims": added_claims,
            "removed_claims": removed_claims,
            "total_snapshot1_claims": len(snap1_map),
            "total_snapshot2_claims": len(snap2_map),
        },
    )
