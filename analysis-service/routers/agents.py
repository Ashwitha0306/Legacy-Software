"""
Agents router — individual agent status listing and ad-hoc agent endpoints.

GET  /agents/list   — list all 17 registered agents
POST /agents/query  — trigger Conversational Query Agent on demand
"""

import traceback
from fastapi import APIRouter, HTTPException
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)

REGISTERED_AGENTS = [
    {"name": "ProjectUploadAgent",       "status": "active",  "step": 1,  "tier": 1},
    {"name": "PreprocessingAgent",       "status": "active",  "step": 2,  "tier": 1},
    {"name": "LegacyDocAgent",           "status": "active",  "step": 3,  "tier": 1},
    {"name": "ParserAgent",              "status": "active",  "step": 4,  "tier": 1},
    {"name": "SSKGConstructionAgent",    "status": "active",  "step": 5,  "tier": 1},
    {"name": "DiagramAgent",             "status": "active",  "step": 6,  "tier": 1},
    {"name": "RetrievalAgent",           "status": "active",  "step": 7,  "tier": 1},
    {"name": "ReconstructionAgent",       "status": "active",  "step": 8,  "tier": 1},
    {"name": "VerificationAgent",         "status": "active",  "step": 9,  "tier": 1},
    {"name": "ConversationalQueryAgent", "status": "active",  "step": 10, "tier": 1},
    {"name": "EvaluationAgent",           "status": "active",  "step": 11, "tier": 1},
    {"name": "DocDriftAgent",             "status": "active",  "step": 12, "tier": 2},
    {"name": "ArchDriftAgent",            "status": "active",  "step": 13, "tier": 2},
    {"name": "ImpactAnalysisAgent",       "status": "active",  "step": 14, "tier": 2},
    {"name": "HealthAgent",               "status": "active",  "step": 15, "tier": 2},
    {"name": "DeveloperMemoryAgent",      "status": "active",  "step": 16, "tier": 2},
    {"name": "RefactoringAgent",          "status": "active",  "step": 17, "tier": 3},
]


class QueryRequest(BaseModel):
    project_id: str
    query: str
    nodes: Optional[List[Dict[str, Any]]] = []
    edges: Optional[List[Dict[str, Any]]] = []
    classes: Optional[List[Dict[str, Any]]] = []
    source_files: Optional[List[str]] = []
    legacy_passages: Optional[List[Dict[str, Any]]] = []
    project_name: Optional[str] = None
    language: Optional[str] = None
    framework: Optional[str] = None
    tech_stack: Optional[str] = None
    api_key: Optional[str] = None
    provider: Optional[str] = None
    chat_history: Optional[List[Dict[str, Any]]] = []


@router.get("/list", response_class=ORJSONResponse)
async def list_agents() -> dict:
    """Return the list of all 17 registered agents."""
    return {"success": True, "data": {"agents": REGISTERED_AGENTS}}


@router.post("/query", response_class=ORJSONResponse)
async def run_conversational_query(req: QueryRequest) -> dict:
    """Execute Conversational Query Agent on demand."""
    try:
        from agents.conversational_query_agent import run as conv_query

        result = await conv_query(
            project_id=req.project_id,
            input_data={
                "query":           req.query,
                "nodes":           req.nodes,
                "edges":           req.edges,
                "classes":         req.classes,
                "source_files":    req.source_files,
                "legacy_passages": req.legacy_passages,
                "project_name":    req.project_name,
                "language":        req.language,
                "framework":       req.framework,
                "tech_stack":      req.tech_stack,
                "api_key":         req.api_key,
                "provider":        req.provider,
                "chat_history":    req.chat_history,
            },
        )

        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}

    except Exception as exc:
        logger.error(
            "ConversationalQueryAgent crashed",
            project_id=req.project_id,
            error=str(exc),
            traceback=traceback.format_exc(),
        )
        raise HTTPException(
            status_code=500,
            detail=f"Conversational query failed: {type(exc).__name__}: {exc}",
        )


class HealthRequest(BaseModel):
    project_id: str
    parse_data: Optional[Dict[str, Any]] = {}
    verification_data: Optional[Dict[str, Any]] = {}
    drift_data: Optional[Dict[str, Any]] = {}
    nodes: Optional[List[Dict[str, Any]]] = []
    edges: Optional[List[Dict[str, Any]]] = []


@router.post("/health", response_class=ORJSONResponse)
async def run_architecture_health(req: HealthRequest) -> dict:
    """Execute Architecture Health Agent on demand."""
    try:
        from agents.architecture_health_agent import run as health_run
        result = await health_run(
            project_id=req.project_id,
            input_data={
                "parse_data": req.parse_data,
                "verification_data": req.verification_data,
                "drift_data": req.drift_data,
                "nodes": req.nodes,
                "edges": req.edges,
            }
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("ArchitectureHealthAgent crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Health calculation failed: {exc}")


class ImpactRequest(BaseModel):
    project_id: str
    target_node_id: Optional[str] = None
    nodes: Optional[List[Dict[str, Any]]] = []
    edges: Optional[List[Dict[str, Any]]] = []


@router.post("/impact", response_class=ORJSONResponse)
async def run_impact_analysis(req: ImpactRequest) -> dict:
    """Execute Impact Analysis / Blast Radius Agent on demand."""
    try:
        from agents.impact_analysis_agent import run as impact_run
        result = await impact_run(
            project_id=req.project_id,
            input_data={
                "target_node_id": req.target_node_id,
                "nodes": req.nodes,
                "edges": req.edges,
            }
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("ImpactAnalysisAgent crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Impact analysis failed: {exc}")


class ArchDriftRequest(BaseModel):
    project_id: str
    snapshot1_nodes: Optional[List[Dict[str, Any]]] = []
    snapshot1_edges: Optional[List[Dict[str, Any]]] = []
    snapshot2_nodes: Optional[List[Dict[str, Any]]] = []
    snapshot2_edges: Optional[List[Dict[str, Any]]] = []


@router.post("/arch-drift", response_class=ORJSONResponse)
async def run_arch_drift(req: ArchDriftRequest) -> dict:
    """Execute Architecture Drift Agent on demand."""
    try:
        from agents.architecture_drift_agent import run as drift_run
        result = await drift_run(
            project_id=req.project_id,
            input_data={
                "snapshot1_nodes": req.snapshot1_nodes,
                "snapshot1_edges": req.snapshot1_edges,
                "snapshot2_nodes": req.snapshot2_nodes,
                "snapshot2_edges": req.snapshot2_edges,
            }
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("ArchitectureDriftAgent crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Architecture drift calculation failed: {exc}")


class DocDriftRequest(BaseModel):
    project_id: str
    snapshot1_statements: Optional[List[Dict[str, Any]]] = []
    snapshot2_statements: Optional[List[Dict[str, Any]]] = []
    changed_files: Optional[List[str]] = []


@router.post("/doc-drift", response_class=ORJSONResponse)
async def run_doc_drift(req: DocDriftRequest) -> dict:
    """Execute Documentation Drift Agent on demand."""
    try:
        from agents.documentation_drift_agent import run as doc_drift_run
        result = await doc_drift_run(
            project_id=req.project_id,
            input_data={
                "snapshot1_statements": req.snapshot1_statements,
                "snapshot2_statements": req.snapshot2_statements,
                "changed_files": req.changed_files,
            }
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("DocumentationDriftAgent crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Documentation drift calculation failed: {exc}")


class RefactoringRequest(BaseModel):
    project_id: str
    proposed_action: str = "extract_service"
    target_class_name: str = "UserService"
    nodes: Optional[List[Dict[str, Any]]] = []
    edges: Optional[List[Dict[str, Any]]] = []


@router.post("/refactoring", response_class=ORJSONResponse)
async def run_refactoring_simulation(req: RefactoringRequest) -> dict:
    """Execute Refactoring Simulation Agent on demand."""
    try:
        from agents.refactoring_simulation_agent import run as refact_run
        result = await refact_run(
            project_id=req.project_id,
            input_data={
                "proposed_action": req.proposed_action,
                "target_class_name": req.target_class_name,
                "nodes": req.nodes,
                "edges": req.edges,
            }
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("RefactoringSimulationAgent crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Refactoring simulation failed: {exc}")


class MemoryStoreRequest(BaseModel):
    project_id: str
    user_id: str = "developer"
    statement_id: str
    feedback_type: str
    original_content: str
    correction_text: Optional[str] = ""


@router.post("/memory/store", response_class=ORJSONResponse)
async def store_memory(req: MemoryStoreRequest) -> dict:
    """Store human developer feedback / correction in developer memory."""
    try:
        from agents.developer_memory_agent import run as memory_run
        result = await memory_run(
            project_id=req.project_id,
            input_data={
                "action": "store",
                "user_id": req.user_id,
                "statement_id": req.statement_id,
                "feedback_type": req.feedback_type,
                "original_content": req.original_content,
                "correction_text": req.correction_text,
            }
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("DeveloperMemoryAgent store crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Storing developer memory failed: {exc}")


@router.get("/memory/list/{project_id}", response_class=ORJSONResponse)
async def list_memories(project_id: str) -> dict:
    """Retrieve all stored developer memories for a project."""
    try:
        from agents.developer_memory_agent import run as memory_run
        result = await memory_run(
            project_id=project_id,
            input_data={"action": "retrieve"}
        )
        return {"success": True, "data": result.model_dump() if hasattr(result, "model_dump") else result}
    except Exception as exc:
        logger.error("DeveloperMemoryAgent retrieve crashed", error=str(exc), traceback=traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Retrieving developer memories failed: {exc}")
