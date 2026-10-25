"""
Agent Orchestrator — Grounded Multi-Agent RAV Pipeline (11-Agent Specification)

Coordinates the canonical 11 pipeline agents:

  Agent 1:  ProjectUploadAgent       — ZIP / GitHub ingestion & tech detection
  Agent 2:  PreprocessingAgent       — source file enumeration & tech stack info
  Agent 3A: LegacyDocAgent (parse)   — PDF/DOCX/MD documentation text extraction
  Agent 4:  ParserAgent              — Tree-sitter multi-language AST extraction
  Agent 5:  SSKGConstructionAgent    — NetworkX SSKG from parsed AST
  Agent 3B: LegacyDocAgent (link)    — link doc passages to SSKG nodes
  Agent 6:  DiagramAgent             — deterministic Mermaid/PlantUML/SVG rendering
  Agent 7:  RetrievalAgent           — SSKG subgraph retrieval for query/user context
  Agent 8:  ReconstructionAgent      — LLM grounded generation from retrieved context
  Agent 9:  VerificationAgent        — deterministic confidence score + evidence citations
  Agent 10: ConversationalQueryAgent — scoped Q&A (conditional: only when user_query set)
  Agent 11: EvaluationAgent          — ablation study metrics (precision/recall/F1/hallucination)

Orchestrator = coordinator, not an agent. It has no analysis logic of its own.
"""

from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any, Dict, List, Optional

from core.config import settings
from core.logger import get_logger
from core.schemas import AgentEnvelope, AgentStatus, AblationMode

logger = get_logger(__name__)

MAX_RETRIES = 2
RETRY_DELAY_SECONDS = 1.5


class OrchestratorError(Exception):
    """Raised when the orchestrator cannot recover from an agent failure."""
    pass


class Orchestrator:
    """
    Agent Orchestrator — coordinates the 11-agent RAV pipeline.

    Design principles:
    - Each agent is invoked via _invoke_agent() which handles retries and logging.
    - Agents communicate strictly via AgentEnvelope; no shared mutable state.
    - Results are persisted to MongoDB at the end of each successful run via
      _update_database_records().
    """

    def __init__(
        self,
        project_id: str,
        run_id: str,
        ablation_mode: AblationMode = AblationMode.FULL_RAV,
    ):
        self.project_id = project_id
        self.run_id = run_id
        self.ablation_mode = ablation_mode
        self.execution_log: List[Dict[str, Any]] = []
        self.results: Dict[str, Any] = {}

    def _log(self, agent: str, event: str, detail: Any = None) -> None:
        entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "agent": agent,
            "event": event,
            "detail": detail,
        }
        self.execution_log.append(entry)
        logger.info(
            f"[Orchestrator] {agent} -> {event}",
            detail=str(detail)[:200] if detail else None,
        )

    async def _invoke_agent(
        self,
        agent_fn,
        agent_name: str,
        input_data: Dict[str, Any],
        retries: int = MAX_RETRIES,
    ) -> AgentEnvelope:
        self._log(agent_name, "STARTED", {"input_keys": list(input_data.keys())})

        for attempt in range(retries + 1):
            try:
                result: AgentEnvelope = await agent_fn(self.project_id, input_data)
                self._log(
                    agent_name,
                    "COMPLETED",
                    {"status": result.status, "attempt": attempt + 1},
                )
                return result
            except Exception as exc:
                if attempt < retries:
                    self._log(
                        agent_name,
                        "RETRYING",
                        {"attempt": attempt + 1, "error": str(exc)},
                    )
                    logger.warning(
                        f"[Orchestrator] {agent_name} failed (attempt {attempt + 1}), retrying...",
                        error=str(exc),
                    )
                    await asyncio.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                else:
                    self._log(
                        agent_name,
                        "FAILED",
                        {"error": str(exc), "attempts": attempt + 1},
                    )
                    logger.error(
                        f"[Orchestrator] {agent_name} failed after {attempt + 1} attempts",
                        error=str(exc),
                    )
                    raise OrchestratorError(f"{agent_name} failed: {exc}") from exc

    # ─────────────────────────────────────────────────────────────────────────

    async def run(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Execute the full 11-agent RAV pipeline sequentially.

        Returns a complete output payload dict that is also persisted to MongoDB.
        On agent failure the orchestrator logs the error and returns status='failed'
        with all results collected so far.
        """
        start_time = datetime.utcnow()
        mode_val = (
            self.ablation_mode.value
            if isinstance(self.ablation_mode, AblationMode)
            else self.ablation_mode
        )

        self._log(
            "Orchestrator",
            "PIPELINE_STARTED",
            {"ablation_mode": mode_val, "project_id": self.project_id},
        )

        try:
            # ── Agent 1: Project Upload ────────────────────────────────────────
            from agents.upload_agent import run as upload

            upload_res = await self._invoke_agent(
                upload, "ProjectUploadAgent", input_data
            )
            self.results["upload"] = upload_res

            # ── Agent 2: Preprocessing ────────────────────────────────────────
            from agents.preprocessing_agent import run as preprocess

            preprocess_res = await self._invoke_agent(
                preprocess,
                "PreprocessingAgent",
                {
                    "extracted_path": (
                        upload_res.data.get("extracted_path")
                        or upload_res.data.get("workspacePath")
                    ),
                    "user_query": input_data.get("user_query"),
                    "language": upload_res.data.get("language"),
                    "framework": upload_res.data.get("framework"),
                    "tech_stack": upload_res.data.get("tech_stack"),
                    "build_tool": upload_res.data.get("build_tool"),
                    "framework_version": upload_res.data.get("framework_version"),
                    "tech_confidence": upload_res.data.get("tech_confidence"),
                    "source_extensions": upload_res.data.get("source_extensions"),
                },
            )
            self.results["preprocessing"] = preprocess_res

            # ── Agent 3A: Legacy Documentation Ingestion — Phase 1 (Parse) ───
            from agents.legacy_doc_agent import run as legacy_doc

            doc_parse_res = await self._invoke_agent(
                legacy_doc,
                "LegacyDocAgent_Parse",
                {
                    "phase": "parse",
                    "doc_paths": input_data.get("doc_files", []),
                    "doc_directory": upload_res.data.get("extracted_path"),
                },
            )
            self.results["legacyDocParse"] = doc_parse_res

            # ── Agent 4: Parser (multi-language Tree-sitter router) ───────────
            from agents.parser_agent import run as parse

            parse_res = await self._invoke_agent(
                parse,
                "ParserAgent",
                {
                    "extracted_path": preprocess_res.data.get("extracted_path"),
                    "source_files": preprocess_res.data.get("source_files", []),
                    "java_files": preprocess_res.data.get("java_files", []),
                    "language": preprocess_res.data.get("language", "java"),
                    "framework": preprocess_res.data.get("framework", "unknown"),
                },
            )
            self.results["parsing"] = parse_res

            # ── Agent 5: SSKG Construction ────────────────────────────────────
            from agents.sskg_construction_agent import run as construct_sskg

            sskg_res = await self._invoke_agent(
                construct_sskg,
                "SSKGConstructionAgent",
                {
                    "classes": parse_res.data.get("classes", []),
                    "total_classes": parse_res.data.get("total_classes", 0),
                    "language": parse_res.data.get(
                        "language", preprocess_res.data.get("language", "java")
                    ),
                    "framework": parse_res.data.get(
                        "framework", preprocess_res.data.get("framework", "unknown")
                    ),
                },
            )
            self.results["graphConstruction"] = sskg_res

            # ── Agent 3B: Legacy Documentation Ingestion — Phase 2 (Link) ────
            doc_link_res = await self._invoke_agent(
                legacy_doc,
                "LegacyDocAgent_Link",
                {
                    "phase": "link",
                    "existing_passages": doc_parse_res.data.get("passages", []),
                    "sskg_nodes": sskg_res.data.get("nodes", []),
                },
            )
            self.results["legacyDocLink"] = doc_link_res

            # ── Agent 6: Diagram Generation & Export ─────────────────────────
            from agents.diagram_agent import run as generate_diagrams

            diagram_res = await self._invoke_agent(
                generate_diagrams,
                "DiagramAgent",
                {
                    "nodes": sskg_res.data.get("nodes", []),
                    "edges": sskg_res.data.get("edges", []),
                    "classes": parse_res.data.get("classes", []),
                    "project_name": input_data.get("project_name", "System"),
                },
            )
            self.results["diagrams"] = diagram_res

            # ── Agent 7: Retrieval ────────────────────────────────────────────
            from agents.retrieval_agent import run as retrieve

            retrieval_res = await self._invoke_agent(
                retrieve,
                "RetrievalAgent",
                {
                    "nodes": sskg_res.data.get("nodes", []),
                    "edges": sskg_res.data.get("edges", []),
                    "user_query": input_data.get("user_query"),
                },
            )
            self.results["retrieval"] = retrieval_res

            # ── Agent 8: Reconstruction ───────────────────────────────────────
            from agents.reconstruction_agent import run as reconstruct

            reconstruct_res = await self._invoke_agent(
                reconstruct,
                "ReconstructionAgent",
                {
                    "relevant_nodes": retrieval_res.data.get("relevant_nodes", []),
                    "relevant_edges": retrieval_res.data.get("relevant_edges", []),
                    "ablation_mode": mode_val,
                },
            )
            self.results["reconstruction"] = reconstruct_res

            # ── Agent 9: Verification ─────────────────────────────────────────
            if mode_val == AblationMode.PLAIN_LLM.value:
                # plain_llm baseline: skip verification — no SSKG grounding
                self._log(
                    "VerificationAgent",
                    "SKIPPED",
                    {"reason": "plain_llm ablation mode — no SSKG grounding"},
                )
                verification_data: Dict[str, Any] = {
                    "verified_statements": reconstruct_res.data.get("statements", []),
                    "counts": {
                        "verified": 0,
                        "partially_verified": 0,
                        "unsupported": len(
                            reconstruct_res.data.get("statements", [])
                        ),
                    },
                }
            else:
                from agents.verification_agent import run as verify

                verify_res = await self._invoke_agent(
                    verify,
                    "VerificationAgent",
                    {
                        "statements": reconstruct_res.data.get("statements", []),
                        "relevant_nodes": retrieval_res.data.get("relevant_nodes", []),
                        "relevant_edges": retrieval_res.data.get("relevant_edges", []),
                        "retrieval_score": retrieval_res.data.get(
                            "retrieval_score", 0.8
                        ),
                    },
                )
                self.results["verification"] = verify_res
                verification_data = verify_res.data

            # ── Agent 10: Conversational Query (conditional) ──────────────────
            if input_data.get("user_query"):
                from agents.conversational_query_agent import run as conv_query

                conv_res = await self._invoke_agent(
                    conv_query,
                    "ConversationalQueryAgent",
                    {
                        "query": input_data.get("user_query"),
                        "nodes": sskg_res.data.get("nodes", []),
                        "edges": sskg_res.data.get("edges", []),
                        "classes": parse_res.data.get("classes", []),
                        "source_files": preprocess_res.data.get("source_files", []),
                        "legacy_passages": doc_link_res.data.get("passages", []),
                        "language": preprocess_res.data.get("language", "java"),
                        "framework": preprocess_res.data.get("framework", "unknown"),
                        "project_name": input_data.get("project_name") or "Application",
                    },
                )
                self.results["conversationalQuery"] = conv_res

            # ── Agent 11: Evaluation ──────────────────────────────────────────
            from agents.evaluation_agent import run as evaluate

            eval_res = await self._invoke_agent(
                evaluate,
                "EvaluationAgent",
                {
                    "ablation_mode": mode_val,
                    "verification_data": verification_data,
                    # Pass parse stats so EvaluationAgent can compute richer metrics
                    "total_classes":   parse_res.data.get("total_classes", 0),
                    "total_methods":   parse_res.data.get("total_methods", 0),
                    "total_endpoints": parse_res.data.get("total_endpoints", 0),
                    "node_count":      sskg_res.data.get("node_count", 0),
                    "edge_count":      sskg_res.data.get("edge_count", 0),
                },
            )
            self.results["evaluation"] = eval_res

            # ─────────────────────────────────────────────────────────────────
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)

            self._log(
                "Orchestrator",
                "PIPELINE_COMPLETED",
                {
                    "duration_ms": duration_ms,
                    "stages_completed": list(self.results.keys()),
                    "node_count": sskg_res.data.get("node_count", 0),
                    "edge_count": sskg_res.data.get("edge_count", 0),
                },
            )

            output_payload = {
                "projectId": self.project_id,
                "runId": self.run_id,
                "ablationMode": mode_val,
                "status": "completed",
                "startedAt": start_time.isoformat(),
                "completedAt": end_time.isoformat(),
                "durationMs": duration_ms,
                "results": {
                    k: (v.model_dump() if hasattr(v, "model_dump") else v)
                    for k, v in self.results.items()
                },
                "executionLog": self.execution_log,
            }

            await self._update_database_records(
                output_payload, parse_res.data, sskg_res.data, eval_res.data
            )

            return output_payload

        except OrchestratorError as exc:
            end_time = datetime.utcnow()
            duration_ms = int((end_time - start_time).total_seconds() * 1000)
            self._log("Orchestrator", "PIPELINE_FAILED", {"error": str(exc)})

            # Persist partial failure state to DB so the dashboard shows "failed"
            try:
                from core.database import get_database
                from bson import ObjectId

                db = get_database()
                await db.analysisruns.update_one(
                    {"_id": ObjectId(self.run_id)},
                    {
                        "$set": {
                            "status": "failed",
                            "completedAt": datetime.utcnow(),
                            "durationMs": duration_ms,
                            "errorMessage": str(exc),
                        }
                    },
                )
                await db.projects.update_one(
                    {"_id": ObjectId(self.project_id)},
                    {"$set": {"status": "error", "errorMessage": str(exc)}},
                )
            except Exception as db_err:
                logger.warning(
                    "Could not persist failure state to MongoDB",
                    error=str(db_err),
                )

            return {
                "projectId": self.project_id,
                "runId": self.run_id,
                "ablationMode": mode_val,
                "status": "failed",
                "startedAt": start_time.isoformat(),
                "completedAt": end_time.isoformat(),
                "durationMs": duration_ms,
                "results": {
                    k: (v.model_dump() if hasattr(v, "model_dump") else v)
                    for k, v in self.results.items()
                },
                "executionLog": self.execution_log,
                "errorMessage": str(exc),
            }

    # ─────────────────────────────────────────────────────────────────────────

    async def _update_database_records(
        self,
        payload: Dict[str, Any],
        parse_data: Dict[str, Any],
        sskg_data: Dict[str, Any],
        eval_data: Dict[str, Any],
    ) -> None:
        """
        Persist completed pipeline results to MongoDB.

        Wraps each AgentEnvelope.model_dump() → {status, output} to match
        the Mongoose agentResultSchema in AnalysisRun.js.
        """
        try:
            from core.database import get_database
            from bson import ObjectId

            db = get_database()
            run_oid = ObjectId(self.run_id)
            proj_oid = ObjectId(self.project_id)

            def _wrap(agent_key: str) -> Optional[Dict[str, Any]]:
                """
                AgentEnvelope shape:  {projectId, agent, status, timestamp, data, error}
                Mongoose target shape: {status, output}
                """
                raw = payload["results"].get(agent_key)
                if raw is None:
                    return None
                if isinstance(raw, dict):
                    raw_st = raw.get("status", "SUCCESS")
                    is_ok = (
                        raw_st == AgentStatus.SUCCESS
                        or str(raw_st).upper().endswith("SUCCESS")
                        or str(raw_st).lower() in ("success", "completed", "ok")
                    )
                    return {
                        "status": "success" if is_ok else "failed",
                        "output": raw.get("data", raw),
                    }
                return None

            await db.analysisruns.update_one(
                {"_id": run_oid},
                {
                    "$set": {
                        "status": "completed",
                        "completedAt": datetime.utcnow(),
                        "durationMs": payload["durationMs"],
                        # 11 core agent results
                        "preprocessing":       _wrap("preprocessing"),
                        "parsing":             _wrap("parsing"),
                        "graphConstruction":   _wrap("graphConstruction"),
                        "diagrams":            _wrap("diagrams"),
                        "legacyDoc":           _wrap("legacyDocLink"),
                        "retrieval":           _wrap("retrieval"),
                        "reconstruction":      _wrap("reconstruction"),
                        "verification":        _wrap("verification"),
                        "conversationalQuery": _wrap("conversationalQuery"),
                        "evaluation":          _wrap("evaluation"),
                        # Denormalized for fast dashboard stat cards
                        "metrics":             eval_data,
                        "executionLog":        payload["executionLog"],
                    }
                },
            )

            await db.projects.update_one(
                {"_id": proj_oid},
                {
                    "$set": {
                        "status": "completed",
                        "language": parse_data.get("language", "unknown"),
                        "framework": parse_data.get("framework", "unknown"),
                        "techStack": (
                            f"{parse_data.get('language', 'unknown')}"
                            f"-{parse_data.get('framework', 'unknown')}"
                        ),
                        "stats": {
                            "totalClasses":   parse_data.get("total_classes", 0),
                            "totalMethods":   parse_data.get("total_methods", 0),
                            "totalEndpoints": parse_data.get("total_endpoints", 0),
                            "totalPackages":  parse_data.get("total_packages", 0),
                            "graphNodeCount": (
                                sskg_data.get("node_count")
                                or sskg_data.get("nodeCount", 0)
                            ),
                            "graphEdgeCount": (
                                sskg_data.get("edge_count")
                                or sskg_data.get("edgeCount", 0)
                            ),
                            "citationAccuracy": eval_data.get("evidence_citation_accuracy"),
                        },
                        "metrics": eval_data,
                    }
                },
            )
            logger.info(
                "MongoDB records updated successfully",
                run_id=self.run_id,
                project_id=self.project_id,
            )
        except Exception as exc:
            logger.warning(
                "Could not update MongoDB records",
                error=str(exc),
                run_id=self.run_id,
            )


