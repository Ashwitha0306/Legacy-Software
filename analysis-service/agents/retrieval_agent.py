"""
Retrieval Agent (Agent 5 in the REQUIRED AGENTS list)

PURPOSE:
  Given a user query or target software component, traverse the SSKG to extract
  the relevant subgraph context (nodes and edges).
  This grounded retrieval context is passed directly to the Reconstruction Agent.

INPUTS (from Orchestrator / SSKGConstructionAgent):
  {
    "nodes": [...],
    "edges": [...],
    "user_query": "<optional query string>"
  }

OUTPUTS (AgentEnvelope with RetrievalContext in data):
  conforming to core/schemas.py RetrievalContext schema.
"""

from __future__ import annotations

from typing import Any, Dict, List, Set
from core.schemas import AgentEnvelope, AgentStatus, RetrievalContext, GraphNode, GraphEdge
from graph.sskg import SSKGManager
from core.logger import get_logger

logger = get_logger(__name__)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Retrieval Agent."""
    logger.info("RetrievalAgent started", project_id=project_id)

    raw_nodes = input_data.get("nodes", [])
    raw_edges = input_data.get("edges", [])
    user_query = input_data.get("user_query") or "architecture overview"

    # Reconstruct SSKG manager from SSKGData
    manager = SSKGManager(project_id=project_id)
    for idx, n in enumerate(raw_nodes):
        nid = n.get("node_id") or n.get("id") or f"node-{idx}"
        ntype = n.get("node_type") or n.get("type") or "Class"
        nname = n.get("name") or n.get("qualified_name") or f"Node-{idx}"
        manager.add_node(
            node_id=nid,
            node_type=ntype,
            name=nname,
            qualified_name=n.get("qualified_name") or nname,
            file_path=n.get("file_path", ""),
            start_line=n.get("start_line", 1),
            end_line=n.get("end_line", 1),
            metadata=n.get("metadata", {}),
        )

    for e in raw_edges:
        sid = e.get("source_id") or e.get("source")
        tid = e.get("target_id") or e.get("target")
        rel = e.get("relationship") or e.get("type") or "DEPENDS_ON"
        if sid and tid:
            manager.add_edge(
                source_id=sid,
                target_id=tid,
                relationship=rel,
                metadata=e.get("metadata", {}),
            )

    # Find candidate seed nodes based on search query
    seed_node_ids = manager.search_nodes(user_query)

    # Fallback: if no specific keyword match, select API, Service, and Entity nodes
    if not seed_node_ids:
        for nid, data in manager.graph.nodes(data=True):
            ntype = data.get("node_type")
            if ntype in ("API", "Service", "Entity", "Class"):
                seed_node_ids.append(nid)

    # Limit seeds to top 20 for efficient retrieval
    seed_node_ids = seed_node_ids[:20]

    # Extract 2-hop neighborhood subgraph around seeds
    subgraph_dict = manager.get_subgraph_around_nodes(seed_node_ids, radius=2)

    # Compute retrieval score based on coverage ratio
    total_nodes = len(raw_nodes) or 1
    retrieval_coverage = len(subgraph_dict["nodes"]) / total_nodes
    retrieval_score = round(min(1.0, max(0.2, retrieval_coverage * 1.5)), 4)

    context = RetrievalContext(
        query=user_query,
        relevant_nodes=[GraphNode(**n) for n in subgraph_dict["nodes"]],
        relevant_edges=[GraphEdge(**e) for e in subgraph_dict["edges"]],
        node_count=subgraph_dict["node_count"],
        edge_count=subgraph_dict["edge_count"],
        retrieval_score=retrieval_score,
    )

    logger.info(
        "RetrievalAgent completed",
        project_id=project_id,
        retrieved_nodes=context.node_count,
        retrieved_edges=context.edge_count,
        retrieval_score=context.retrieval_score,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="RetrievalAgent",
        status=AgentStatus.SUCCESS,
        data=context.model_dump(),
    )
