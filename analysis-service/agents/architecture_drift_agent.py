"""
Architecture Drift Agent (Agent 10 in the REQUIRED AGENTS list)

PURPOSE:
  Compares two SSKG snapshots (snapshot 1 vs snapshot 2) to detect structural pattern shift.
  Computes structural drift percentage and categorizes structural changes.

INPUTS:
  {
    "snapshot1_nodes": [...],
    "snapshot1_edges": [...],
    "snapshot2_nodes": [...],
    "snapshot2_edges": [...]
  }

OUTPUTS (AgentEnvelope):
  {
    "arch_drift_percentage": 12.5,
    "added_nodes": [...],
    "removed_nodes": [...],
    "added_edges": [...],
    "removed_edges": [...]
  }
"""

from __future__ import annotations

from typing import Any, Dict, List, Set
from core.schemas import AgentEnvelope, AgentStatus
from core.logger import get_logger

logger = get_logger(__name__)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Architecture Drift Agent."""
    logger.info("ArchitectureDriftAgent started", project_id=project_id)

    nodes1 = {n.get("node_id"): n for n in input_data.get("snapshot1_nodes", []) if isinstance(n, dict)}
    nodes2 = {n.get("node_id"): n for n in input_data.get("snapshot2_nodes", []) if isinstance(n, dict)}

    edges1 = {(e.get("source_id"), e.get("target_id"), e.get("relationship")): e for e in input_data.get("snapshot1_edges", []) if isinstance(e, dict)}
    edges2 = {(e.get("source_id"), e.get("target_id"), e.get("relationship")): e for e in input_data.get("snapshot2_edges", []) if isinstance(e, dict)}

    added_node_ids = set(nodes2.keys()) - set(nodes1.keys())
    removed_node_ids = set(nodes1.keys()) - set(nodes2.keys())

    added_edges = [e for k, e in edges2.items() if k not in edges1]
    removed_edges = [e for k, e in edges1.items() if k not in edges2]

    total_elements = len(nodes1) + len(edges1) or 1
    total_diffs = len(added_node_ids) + len(removed_node_ids) + len(added_edges) + len(removed_edges)

    arch_drift_percentage = round(min(100.0, (total_diffs / total_elements) * 100), 2)

    logger.info(
        "ArchitectureDriftAgent completed",
        project_id=project_id,
        drift_percentage=arch_drift_percentage,
        added_nodes_count=len(added_node_ids),
        removed_nodes_count=len(removed_node_ids),
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="ArchDriftAgent",
        status=AgentStatus.SUCCESS,
        data={
            "arch_drift_percentage": arch_drift_percentage,
            "added_nodes": [nodes2[nid] for nid in added_node_ids if nid in nodes2],
            "removed_nodes": [nodes1[nid] for nid in removed_node_ids if nid in nodes1],
            "added_edges": added_edges,
            "removed_edges": removed_edges,
            "total_snapshot1_nodes": len(nodes1),
            "total_snapshot2_nodes": len(nodes2),
        },
    )
