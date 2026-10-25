"""
Agent 5 — SSKG Construction Agent

PURPOSE:
  Convert structured AST output from Agent 4 into the typed Semantic Software Knowledge Graph (SSKG).

INPUTS (from Orchestrator / ParserAgent):
  {
    "classes": [... list of ParsedClass objects or dicts ...],
    "total_classes": 10,
    "language": "python",
    "framework": "django"
  }

OUTPUTS (AgentEnvelope with SSKG payload):
  {
    "SSKG": { "nodes": [...], "edges": [...] },
    "nodeCount": N,
    "edgeCount": N,
    "nodes": [...],
    "edges": [...],
    "node_count": N,
    "edge_count": N,
    "packages": [...]
  }
"""

from __future__ import annotations

from typing import Any, Dict, List
from core.schemas import AgentEnvelope, AgentStatus, ParsedClass
from graph.sskg import SSKGManager
from core.logger import get_logger

logger = get_logger(__name__)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the SSKG Construction Agent."""
    logger.info("SSKGConstructionAgent started", project_id=project_id)

    raw_classes = input_data.get("classes", [])
    language = input_data.get("language", "unknown")
    framework = input_data.get("framework", "unknown")

    parsed_classes: List[ParsedClass] = []
    for c_item in raw_classes:
        if isinstance(c_item, ParsedClass):
            parsed_classes.append(c_item)
        elif isinstance(c_item, dict):
            parsed_classes.append(ParsedClass(**c_item))

    manager = SSKGManager(project_id=project_id)
    sskg_data = manager.build_from_parser_output(parsed_classes, language=language, framework=framework)

    node_dumps = [n.model_dump() for n in sskg_data.nodes]
    edge_dumps = [e.model_dump() for e in sskg_data.edges]

    output_payload = {
        "SSKG": {
            "nodes": node_dumps,
            "edges": edge_dumps,
        },
        "nodes": node_dumps,
        "edges": edge_dumps,
        "nodeCount": sskg_data.node_count,
        "edgeCount": sskg_data.edge_count,
        "node_count": sskg_data.node_count,
        "edge_count": sskg_data.edge_count,
        "packages": sskg_data.packages,
        "language": language,
        "framework": framework,
    }

    logger.info(
        "SSKGConstructionAgent completed successfully",
        project_id=project_id,
        node_count=sskg_data.node_count,
        edge_count=sskg_data.edge_count,
        packages=len(sskg_data.packages),
        language=language,
        framework=framework,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="SSKGConstructionAgent",
        status=AgentStatus.SUCCESS,
        data=output_payload,
    )
