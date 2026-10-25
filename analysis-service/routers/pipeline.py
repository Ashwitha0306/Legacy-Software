"""
Pipeline router — triggers and monitors analysis runs.

POST /pipeline/run      — start a new analysis run
GET  /pipeline/run/{id} — get run status/results
"""

from fastapi import APIRouter
from fastapi.responses import ORJSONResponse
from pydantic import BaseModel
from typing import Optional
from core.logger import get_logger

router = APIRouter()
logger = get_logger(__name__)


class RunRequest(BaseModel):
    project_id: str
    run_id: str
    # Source configuration (passed to ProjectUploadAgent)
    source_type: str = "zip"          # "zip" | "github"
    extracted_path: Optional[str] = None  # for zip — already extracted on disk
    github_url: Optional[str] = None  # for github
    github_ref: Optional[str] = "main"
    project_name: Optional[str] = None
    # Pipeline configuration
    ablation_mode: str = "full_rav"
    user_query: Optional[str] = None
    snapshot_label: Optional[str] = "snapshot1"
    doc_files: Optional[list] = None


@router.post("/run", response_class=ORJSONResponse)
async def trigger_run(req: RunRequest) -> dict:
    """
    Trigger the RAV pipeline for a given project.

    The Orchestrator is invoked with the full input payload.
    Agent 1 (ProjectUploadAgent) handles both ZIP and GitHub cases.
    """
    from core.orchestrator import Orchestrator
    from core.schemas import AblationMode

    try:
        mode = AblationMode(req.ablation_mode)
    except ValueError:
        return ORJSONResponse(
            status_code=422,
            content={"success": False, "message": f"Invalid ablation_mode: {req.ablation_mode}"},
        )

    orchestrator = Orchestrator(
        project_id=req.project_id,
        run_id=req.run_id,
        ablation_mode=mode,
    )

    # Build the unified input for Agent 1 (ProjectUploadAgent)
    pipeline_input = {
        "source_type":    req.source_type,
        "extracted_path": req.extracted_path,
        "github_url":     req.github_url,
        "github_ref":     req.github_ref or "main",
        "project_name":   req.project_name or "",
        "user_query":     req.user_query,
        "snapshot_label": req.snapshot_label or "snapshot1",
        "doc_files":      req.doc_files or [],
    }

    result = await orchestrator.run(pipeline_input)

    return {"success": True, "data": result}
