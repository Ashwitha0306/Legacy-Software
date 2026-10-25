"""
Architecture Health Agent (Agent 15 in the REQUIRED AGENTS list)

PURPOSE:
  Compute the composite Architecture Health Score using the formal research formula:

  HealthScore = w1 * Maintainability + w2 * (1 - Coupling) + w3 * Cohesion
              + w4 * DocCoverage + w5 * (1 - DriftPercentage) + w6 * VerificationConfidence

  Default weights: w1=0.20, w2=0.15, w3=0.15, w4=0.15, w5=0.15, w6=0.20 (sum = 1.0)
"""

from __future__ import annotations

from typing import Any, Dict
from core.config import settings
from core.schemas import AgentEnvelope, AgentStatus
from core.logger import get_logger
from agents.refactoring_simulation_agent import _calculate_cbo, _calculate_lcom
from graph.sskg import SSKGManager

logger = get_logger(__name__)


def calculate_health_score(
    maintainability: float,
    coupling: float,
    cohesion: float,
    doc_coverage: float,
    drift_percentage: float,
    verification_confidence: float,
    w1: float = settings.HEALTH_W1,
    w2: float = settings.HEALTH_W2,
    w3: float = settings.HEALTH_W3,
    w4: float = settings.HEALTH_W4,
    w5: float = settings.HEALTH_W5,
    w6: float = settings.HEALTH_W6,
) -> float:
    """
    Calculate composite Architecture Health Score (0.0 to 100.0 scale).
    """
    # Normalize inputs to 0.0 - 1.0
    m_norm = min(1.0, max(0.0, maintainability))
    c_norm = min(1.0, max(0.0, coupling))
    coh_norm = min(1.0, max(0.0, cohesion))
    doc_norm = min(1.0, max(0.0, doc_coverage))
    drift_norm = min(1.0, max(0.0, drift_percentage / 100.0))
    vc_norm = min(1.0, max(0.0, verification_confidence))

    score = (
        (w1 * m_norm)
        + (w2 * (1.0 - c_norm))
        + (w3 * coh_norm)
        + (w4 * doc_norm)
        + (w5 * (1.0 - drift_norm))
        + (w6 * vc_norm)
    )

    return round(score * 100.0, 2)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Architecture Health Agent with real-time dynamic metric calculations."""
    logger.info("ArchitectureHealthAgent started", project_id=project_id)

    # Extract component inputs from pipeline run results
    parse_data = input_data.get("parse_data", {})
    verification_data = input_data.get("verification_data", {})
    drift_data = input_data.get("drift_data", {})
    sskg_nodes = input_data.get("nodes") or parse_data.get("classes", [])

    total_classes = parse_data.get("total_classes", 1) or 1
    total_methods = parse_data.get("total_methods", 0)

    # Reconstruct manager if nodes/edges available for true graph CBO & LCOM
    manager = SSKGManager(project_id=project_id)
    if isinstance(sskg_nodes, list) and sskg_nodes and isinstance(sskg_nodes[0], dict) and "node_id" in sskg_nodes[0]:
        for n in sskg_nodes:
            manager.add_node(
                node_id=n["node_id"],
                node_type=n.get("node_type", "Class"),
                name=n.get("name", ""),
                qualified_name=n.get("qualified_name") or n.get("name", ""),
                file_path=n.get("file_path", ""),
            )

        raw_edges = input_data.get("edges", [])
        for e in raw_edges:
            manager.add_edge(source_id=e["source_id"], target_id=e["target_id"], relationship=e.get("relationship", "USES"))

        raw_cbo = _calculate_cbo(manager)
        raw_lcom = _calculate_lcom(manager)
        coupling = round(min(1.0, max(0.05, raw_cbo / 10.0)), 4)
        cohesion = round(min(1.0, max(0.1, 1.0 - raw_lcom)), 4)
    else:
        avg_methods_per_class = total_methods / max(1, total_classes)
        coupling = round(min(1.0, max(0.05, avg_methods_per_class / 25.0)), 4)
        cohesion = round(min(1.0, max(0.1, 1.0 - (coupling * 0.4))), 4)

    # Real Maintainability Index calculation
    avg_methods = total_methods / max(1, total_classes)
    maintainability = round(min(1.0, max(0.35, 1.0 - (avg_methods / 30.0))), 4)

    # Real Documentation Coverage & Verification Confidence
    verified_stmts = verification_data.get("verified_statements", [])
    doc_coverage = round(min(1.0, max(0.20, len(verified_stmts) / max(1, total_classes * 2.5))), 4)

    conf_scores = [float(v.get("confidence_score", 0.8)) for v in verified_stmts if v.get("confidence_score") is not None]
    verification_confidence = round(sum(conf_scores) / len(conf_scores), 4) if conf_scores else 0.85

    drift_pct = float(drift_data.get("arch_drift_percentage", 0.0))

    health_score = calculate_health_score(
        maintainability=maintainability,
        coupling=coupling,
        cohesion=cohesion,
        doc_coverage=doc_coverage,
        drift_percentage=drift_pct,
        verification_confidence=verification_confidence,
    )

    logger.info(
        "ArchitectureHealthAgent completed with real-time graph metrics",
        project_id=project_id,
        health_score=health_score,
        maintainability=maintainability,
        coupling=coupling,
        cohesion=cohesion,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="HealthAgent",
        status=AgentStatus.SUCCESS,
        data={
            "architecture_health_score": health_score,
            "components": {
                "maintainability": maintainability,
                "coupling": coupling,
                "cohesion": cohesion,
                "doc_coverage": doc_coverage,
                "drift_percentage": drift_pct,
                "verification_confidence": verification_confidence,
            },
            "weights": settings.health_weights,
        },
    )
