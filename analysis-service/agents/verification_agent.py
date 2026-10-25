"""
Verification Agent (Agent 7 in the REQUIRED AGENTS list)

PURPOSE:
  Cross-checks every AI-generated statement against the SSKG graph nodes/edges.
  Locates supporting source code evidence (file + line range).
  Calculates a deterministic confidence score (NOT LLM-generated).
  Classifies status into Verified / Partially Verified / Unsupported.

CONFIDENCE SCORE FORMULA (Deterministic consistency metric):
  Confidence = alpha * (Evidence Match) + beta * (Graph Consistency) + gamma * (Retrieval Coverage)
  Default weights: alpha = 0.5, beta = 0.3, gamma = 0.2 (alpha+beta+gamma = 1.0)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional
from core.schemas import (
    AgentEnvelope, AgentStatus, VerificationStatus, VerifiedStatement, GeneratedStatement
)
from core.config import settings
from graph.sskg import SSKGManager
from core.logger import get_logger

logger = get_logger(__name__)


def calculate_confidence_score(
    evidence_match: float,
    graph_consistency: float,
    retrieval_coverage: float,
    alpha: float = settings.CONFIDENCE_ALPHA,
    beta: float = settings.CONFIDENCE_BETA,
    gamma: float = settings.CONFIDENCE_GAMMA,
) -> float:
    """
    Deterministic confidence score calculation.

    Args:
        evidence_match: ratio of claimed nodes found in SSKG (0.0 to 1.0)
        graph_consistency: ratio of valid relationships supporting the claim (0.0 to 1.0)
        retrieval_coverage: ratio of retrieved graph nodes used (0.0 to 1.0)
        alpha, beta, gamma: formula weights (sum = 1.0)

    Returns:
        float score rounded to 4 decimal places (0.0 to 1.0)
    """
    score = (alpha * evidence_match) + (beta * graph_consistency) + (gamma * retrieval_coverage)
    return round(min(1.0, max(0.0, score)), 4)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Verification Agent with deterministic AST-grounded claim cross-checking."""
    logger.info("VerificationAgent started", project_id=project_id)

    statements_raw = input_data.get("statements", [])
    raw_nodes = input_data.get("relevant_nodes", [])
    raw_edges = input_data.get("relevant_edges", [])
    retrieval_score = float(input_data.get("retrieval_score", 0.82))

    # Build SSKG lookup graph
    manager = SSKGManager(project_id=project_id)
    for n in raw_nodes:
        manager.add_node(
            node_id=n["node_id"],
            node_type=n["node_type"],
            name=n["name"],
            qualified_name=n.get("qualified_name") or n.get("name", ""),
            file_path=n.get("file_path", ""),
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

    verified_statements: List[VerifiedStatement] = []

    for stmt_dict in statements_raw:
        stmt = GeneratedStatement(**stmt_dict) if isinstance(stmt_dict, dict) else stmt_dict

        matched_node_ids: List[str] = []
        matched_edge_ids: List[str] = []
        file_path: Optional[str] = None
        start_line: Optional[int] = None
        end_line: Optional[int] = None

        # Check evidence match in SSKG
        for nid in stmt.source_nodes:
            if nid in manager.graph:
                matched_node_ids.append(nid)
                node_attrs = manager.graph.nodes[nid]
                if not file_path and node_attrs.get("file_path"):
                    file_path = node_attrs.get("file_path")
                    start_line = node_attrs.get("start_line")
                    end_line = node_attrs.get("end_line")

        total_sources = max(1, len(stmt.source_nodes))
        evidence_match = len(matched_node_ids) / total_sources

        # Check graph relationship consistency
        if len(matched_node_ids) >= 2:
            edges_found = 0
            pairs_checked = 0
            for i in range(len(matched_node_ids)):
                for j in range(i + 1, len(matched_node_ids)):
                    pairs_checked += 1
                    u, v = matched_node_ids[i], matched_node_ids[j]
                    if manager.graph.has_edge(u, v) or manager.graph.has_edge(v, u):
                        edges_found += 1
                        matched_edge_ids.append(f"{u}->{v}")
            graph_consistency = (edges_found / max(1, pairs_checked)) if pairs_checked > 0 else 0.5
        elif len(matched_node_ids) == 1:
            graph_consistency = 0.95
        else:
            graph_consistency = 0.0

        # Adjust evidence if no direct file/line is cited
        has_file_evidence = bool(file_path and start_line)
        if not has_file_evidence:
            evidence_match = min(evidence_match, 0.60)

        retrieval_coverage = min(1.0, max(0.40, retrieval_score))

        # Calculate deterministic confidence score
        confidence = calculate_confidence_score(
            evidence_match=evidence_match,
            graph_consistency=graph_consistency,
            retrieval_coverage=retrieval_coverage,
        )

        # Strictly calibrated classification into Verified, Partially Verified, and Unsupported
        if confidence >= 0.82 and evidence_match >= 0.85 and has_file_evidence:
            status = VerificationStatus.VERIFIED
        elif confidence >= 0.50 and evidence_match >= 0.45:
            status = VerificationStatus.PARTIALLY_VERIFIED
        else:
            status = VerificationStatus.UNSUPPORTED

        verified_statements.append(
            VerifiedStatement(
                statement_id=stmt.statement_id,
                content=stmt.content,
                statement_type=stmt.statement_type,
                verification_status=status,
                confidence_score=confidence,
                supporting_file=file_path,
                supporting_line_start=start_line,
                supporting_line_end=end_line,
                supporting_node_ids=matched_node_ids,
                supporting_edge_ids=matched_edge_ids,
            )
        )

    verified_count = sum(1 for v in verified_statements if v.verification_status == VerificationStatus.VERIFIED)
    partial_count = sum(1 for v in verified_statements if v.verification_status == VerificationStatus.PARTIALLY_VERIFIED)
    unsupported_count = len(verified_statements) - verified_count - partial_count

    logger.info(
        "VerificationAgent completed",
        project_id=project_id,
        total=len(verified_statements),
        verified=verified_count,
        partial=partial_count,
        unsupported=unsupported_count,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="VerificationAgent",
        status=AgentStatus.SUCCESS,
        data={
            "verified_statements": [v.model_dump() for v in verified_statements],
            "verified_count": verified_count,
            "partially_verified_count": partial_count,
            "unsupported_count": unsupported_count,
            "total_statements": len(verified_statements),
        },
    )
