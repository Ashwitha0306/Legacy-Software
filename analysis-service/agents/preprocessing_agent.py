"""
Preprocessing Agent (Agent 2 in the REQUIRED AGENTS list)

PURPOSE:
  Detect the programming language and framework of the extracted project,
  enumerate all relevant source files based on detected language extensions,
  remove unsupported or irrelevant files, and prepare a clean source tree
  for the Parser Agent. Supports ANY programming language codebase.

INPUTS (from Orchestrator):
  {
    "extracted_path": "/path/to/extracted/project",
    "user_query": "<optional user query>",
    "language": "<optional override language>",
    "source_extensions": ["<optional override extensions>"]
  }

OUTPUTS (AgentEnvelope with PreprocessingOutput in data):
  {
    "projectId": "...",
    "agent": "PreprocessingAgent",
    "status": "SUCCESS",
    "data": {
      "extracted_path": "/path/to/cleaned/source",
      "language": "python",
      "framework": "django",
      "framework_version": "4.2.1",
      "build_tool": "pip",
      "tech_stack": "python-django",
      "tech_confidence": 0.97,
      "source_files": ["app/views.py", "app/models.py", ...],
      "total_files": 42,
      "source_extensions": [".py"],
      "excluded_files": ["venv/...", "*.pyc", ...],
      "java_files": [...],   // populated for Java projects (backward compat)
      "framework_detected": "django"
    }
  }
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

from core.schemas import AgentEnvelope, AgentStatus, PreprocessingOutput
from core.logger import get_logger
from core.tech_detector import detect as detect_tech_stack, find_source_files

logger = get_logger(__name__)


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """
    Execute the Preprocessing Agent.

    Args:
        project_id: MongoDB ObjectId of the project (for envelope metadata)
        input_data: dict with keys:
            - extracted_path (str): absolute path to the extracted project directory
            - user_query (str | None): optional query for downstream agents
            - language (str | None): optional language override
            - source_extensions (list | None): optional extension override

    Returns:
        AgentEnvelope containing PreprocessingOutput
    """
    logger.info("PreprocessingAgent started", project_id=project_id)

    extracted_path_str = input_data.get("extracted_path") or input_data.get("workspacePath")
    if not extracted_path_str:
        raise ValueError("PreprocessingAgent: 'extracted_path' is required in input_data")

    project_root = Path(extracted_path_str)
    if not project_root.exists() or not project_root.is_dir():
        raise ValueError(
            f"PreprocessingAgent: extracted_path does not exist or is not a directory: {extracted_path_str}"
        )

    # ── Step 1: Detect technology stack ───────────────────────────────────────
    # Allow override from upstream (upload_agent passes tech info forward)
    if input_data.get("language") and input_data["language"] != "unknown":
        # Fast path: tech already detected upstream, reconstruct info
        from core.tech_detector import TechStackInfo
        tech_info = TechStackInfo(
            language=input_data.get("language", "unknown"),
            framework=input_data.get("framework", "unknown"),
            build_tool=input_data.get("build_tool"),
            framework_version=input_data.get("framework_version"),
            source_extensions=input_data.get("source_extensions", [".py"]),
            tech_confidence=input_data.get("tech_confidence", 0.8),
            tech_stack=input_data.get("tech_stack", "unknown"),
        )
    else:
        tech_info = detect_tech_stack(project_root)

    logger.info(
        "Technology stack determined",
        project_id=project_id,
        language=tech_info.language,
        framework=tech_info.framework,
        confidence=tech_info.tech_confidence,
    )

    # ── Step 2: Enumerate source files by detected extensions ─────────────────
    source_files, excluded_files = find_source_files(project_root, tech_info.source_extensions)

    logger.info(
        "Preprocessing complete",
        project_id=project_id,
        language=tech_info.language,
        framework=tech_info.framework,
        source_files=len(source_files),
        excluded=len(excluded_files),
    )

    # ── Backward compatibility: populate java_files for Java projects ──────────
    java_files = [f for f in source_files if f.endswith(".java")] if tech_info.language in ("java", "kotlin") else []

    output = PreprocessingOutput(
        extracted_path=str(project_root),
        language=tech_info.language,
        framework=tech_info.framework,
        framework_version=tech_info.framework_version,
        build_tool=tech_info.build_tool,
        tech_stack=tech_info.tech_stack,
        tech_confidence=tech_info.tech_confidence,
        source_files=source_files,
        total_files=len(source_files),
        source_extensions=tech_info.source_extensions,
        excluded_files=excluded_files,
        # Legacy compat fields
        java_files=java_files,
        pom_xml_found=(project_root / "pom.xml").exists(),
        gradle_found=any((project_root / f).exists() for f in ("build.gradle", "build.gradle.kts")),
        spring_boot_version=tech_info.framework_version if "spring" in tech_info.framework else None,
        framework_detected=tech_info.framework,
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="PreprocessingAgent",
        status=AgentStatus.SUCCESS,
        data=output.model_dump(),
    )
