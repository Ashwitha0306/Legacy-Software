"""
Impact Analysis Agent (Agent 11 in the REQUIRED AGENTS list)

PURPOSE:
  Blast-radius / dependency-impact simulation.
  Given a target software component (e.g. a class or method proposed for modification),
  traverses the SSKG to predict downstream and upstream dependency impact.

INPUTS:
  {
    "target_node_id": "class:com.example.UserService",
    "nodes": [...],
    "edges": [...]
  }

OUTPUTS (AgentEnvelope):
  {
    "target_node_id": "...",
    "blast_radius_count": 5,
    "risk_level": "HIGH" | "MEDIUM" | "LOW",
    "impacted_nodes": [...],
    "impacted_apis": [...]
  }
"""

from __future__ import annotations

from typing import Any, Dict, List, Set
from core.schemas import AgentEnvelope, AgentStatus
from graph.sskg import SSKGManager
from core.logger import get_logger

logger = get_logger(__name__)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Impact Analysis Agent."""
    logger.info("ImpactAnalysisAgent started", project_id=project_id)

    target_node_id = input_data.get("target_node_id")
    raw_nodes = input_data.get("nodes", [])
    raw_edges = input_data.get("edges", [])

    manager = SSKGManager(project_id=project_id)
    for n in raw_nodes:
        manager.add_node(
            node_id=n["node_id"],
            node_type=n["node_type"],
            name=n["name"],
            qualified_name=n["qualified_name"],
            file_path=n["file_path"],
            start_line=n.get("start_line", 1),
            end_line=n.get("end_line", 1),
            metadata=n.get("metadata", {}),
        )

    for e in raw_edges:
        manager.add_edge(
            source_id=e["source_id"],
            target_id=e["target_id"],
            relationship=e["relationship"],
            metadata=e.get("metadata", {}),
        )

    # If no explicit target provided, pick first Service or Class node as default simulation target
    if not target_node_id or target_node_id not in manager.graph:
        for nid, data in manager.graph.nodes(data=True):
            if data.get("node_type") in ("Service", "Class", "Entity"):
                target_node_id = nid
                break

    impacted_node_ids: Set[str] = set()
    impacted_apis: List[Dict[str, Any]] = []

    if target_node_id and target_node_id in manager.graph:
        impacted_node_ids.add(target_node_id)
        # Forward dependencies (nodes that call or use this target)
        predecessors = list(manager.graph.predecessors(target_node_id))
        successors = list(manager.graph.successors(target_node_id))

        impacted_node_ids.update(predecessors)
        impacted_node_ids.update(successors)

        # Check for affected APIs in 2-hop traversal
        subg_dict = manager.get_subgraph_around_nodes([target_node_id], radius=2)
        for n in subg_dict["nodes"]:
            if n.get("node_type") == "API":
                impacted_apis.append(n)

    blast_radius_count = len(impacted_node_ids)

    if blast_radius_count >= 8 or len(impacted_apis) >= 2:
        risk_level = "HIGH"
    elif blast_radius_count >= 4:
        risk_level = "MEDIUM"
    else:
        risk_level = "LOW"

    logger.info(
        "ImpactAnalysisAgent completed",
        project_id=project_id,
        target_node=target_node_id,
        blast_radius=blast_radius_count,
        risk_level=risk_level,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="ImpactAnalysisAgent",
        status=AgentStatus.SUCCESS,
        data={
            "target_node_id": target_node_id,
            "blast_radius_count": blast_radius_count,
            "risk_level": risk_level,
            "impacted_node_ids": list(impacted_node_ids),
            "impacted_apis": impacted_apis,
        },
    )
