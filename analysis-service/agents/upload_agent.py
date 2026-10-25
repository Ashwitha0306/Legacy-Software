"""
Agent 1 — Project Upload Agent

PURPOSE:
  Entry point for the Grounded Multi-Agent RAV pipeline.
  Validates and stores any legacy codebase (ZIP file or GitHub repository URL)
  in any programming language, supports optional secondary snapshots (snapshotB)
  for drift analysis, and handles optional legacy documentation files
  (PDF, DOCX, Markdown, TXT, OpenAPI/Swagger specs).

INPUT:
  {
    "project_id": "<MongoDB ObjectId>",
    "project_name": "My Legacy Service",
    "source_type": "zip" | "github",
    "extracted_path": "/path/to/zip/directory",   # for ZIP
    "github_url": "https://github.com/owner/repo", # for GitHub
    "github_ref": "main",                          # branch/tag/commit SHA
    "snapshot_id": "snapshotA" | "snapshotB",       # defaults to snapshotA
    "doc_files": ["/path/to/doc1.pdf", "/path/to/swagger.yaml"] # optional
  }

OUTPUT (AgentEnvelope):
  {
    "projectId": "<id>",
    "agent": "ProjectUploadAgent",
    "status": "SUCCESS",
    "data": {
      "projectId": "<id>",
      "workspacePath": "/path/to/workspace",
      "snapshotId": "snapshotA",
      "docsAssetIds": ["doc-001", "doc-002"],
      "status": "SUCCESS",
      "source_type": "zip" | "github",
      "language": "python",
      "framework": "django",
      "tech_stack": "python-django",
      "tech_confidence": 0.97,
      "validation_warnings": [],
      "file_count": 42
    }
  }
"""

from __future__ import annotations

import os
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Tuple

from core.config import settings
from core.logger import get_logger
from core.schemas import AgentEnvelope, AgentStatus
from core.tech_detector import detect as detect_tech_stack, resolve_project_root

logger = get_logger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────
GITHUB_URL_PATTERN = re.compile(
    r"^https?://github\.com/(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?(/.*)?$"
)



def _count_files(project_root: Path) -> int:
    """Count total non-hidden source files in workspace, skipping EXCLUDED_DIRS."""
    count = 0
    try:
        for root, dirs, files in os.walk(project_root, onerror=lambda e: None):
            dirs[:] = [
                d for d in dirs
                if d not in {"node_modules", ".git", "dist", "build", "target", "venv", ".venv", "__pycache__"}
                and not d.startswith(".")
                and "{" not in d
                and not any(c in d for c in '<>:"|?*')
            ]
            count += len(files)
    except Exception:
        pass
    return count


def _process_legacy_docs(project_id: str, doc_files: List[str]) -> List[str]:
    """Store legacy documentation files in legacy_docs asset folder and return docsAssetIds."""
    if not doc_files:
        return []

    docs_dir = Path(settings.UPLOADS_DIR) / "projects" / project_id / "legacy_docs"
    docs_dir.mkdir(parents=True, exist_ok=True)

    asset_ids: List[str] = []
    for idx, doc_path_str in enumerate(doc_files):
        src_path = Path(doc_path_str)
        if src_path.exists() and src_path.is_file():
            asset_id = f"doc-{idx+1:03d}_{src_path.name}"
            dest_path = docs_dir / src_path.name
            shutil.copy2(src_path, dest_path)
            asset_ids.append(asset_id)
            logger.info("Stored legacy doc asset", asset_id=asset_id, path=str(dest_path))

    return asset_ids


def _safe_remove_dir(p: Path) -> None:
    """Safely remove a directory, using Windows extended-length prefix if on Windows."""
    try:
        path_str = str(p.resolve())
        if os.name == "nt" and not path_str.startswith("\\\\?\\"):
            path_str = "\\\\?\\" + path_str
        shutil.rmtree(path_str, ignore_errors=True)
    except Exception:
        pass


def _clean_workspace(workspace: Path) -> None:
    """Safely remove leftover prune dirs or corrupted directories with Windows long path support."""
    prune_names = {"node_modules", ".git", "dist", "build", "target", "venv", ".venv", "__pycache__", ".next", "vendor"}
    try:
        for item in workspace.iterdir():
            try:
                name = item.name
                if "{" in name or "}" in name or any(c in name for c in '<>:"|?*'):
                    _safe_remove_dir(item)
                elif item.is_dir() and name.lower() in prune_names:
                    _safe_remove_dir(item)
            except Exception:
                continue
    except Exception:
        pass


async def _handle_zip(project_id: str, extracted_path: str, snapshot_id: str) -> Path:
    """Validate and return isolated workspace directory for extracted ZIP."""
    source_root = Path(extracted_path)
    if not source_root.exists() or not source_root.is_dir():
        # Check potential relative/absolute locations between backend and analysis-service
        candidates = [
            Path(extracted_path),
            Path(settings.UPLOADS_DIR) / "projects" / project_id / snapshot_id,
            Path("..") / "backend" / "uploads" / "projects" / project_id / snapshot_id,
            Path("backend") / "uploads" / "projects" / project_id / snapshot_id,
            Path.cwd().parent / "backend" / "uploads" / "projects" / project_id / snapshot_id,
        ]
        found = False
        for c in candidates:
            if c.exists() and c.is_dir():
                source_root = c
                found = True
                break
        if not found:
            raise ValueError(f"ProjectUploadAgent: extracted_path does not exist: {extracted_path}")

    # Resolve nested root folder (e.g. Smartpizza-main inside extracted_path)
    source_root = resolve_project_root(source_root)

    # Clean any unwanted/corrupted directories safely
    _clean_workspace(source_root)

    return source_root


async def _handle_github(project_id: str, github_url: str, github_ref: str, snapshot_id: str) -> Tuple[Path, str]:
    """Clone GitHub repository into isolated per-project workspace directory."""
    import git
    import stat

    match = GITHUB_URL_PATTERN.match(github_url)
    if not match:
        raise ValueError(f"ProjectUploadAgent: Invalid GitHub URL: {github_url}")

    workspace = Path(settings.UPLOADS_DIR) / "projects" / project_id / snapshot_id

    # ── Robust cleanup on Windows: .git objects are read-only ──────────────────
    def _force_remove_readonly(func, path, excinfo):
        """onerror handler: chmod to writable then retry removal."""
        try:
            os.chmod(path, stat.S_IWRITE)
            func(path)
        except Exception:
            pass  # best-effort

    if workspace.exists():
        shutil.rmtree(workspace, onerror=_force_remove_readonly)

    # Ensure the directory is gone before cloning
    if workspace.exists():
        # Last resort: rename the stale directory out of the way
        stale_path = workspace.parent / f"{snapshot_id}_stale_{int(datetime.utcnow().timestamp())}"
        try:
            workspace.rename(stale_path)
        except Exception:
            raise RuntimeError(
                f"ProjectUploadAgent: Cannot remove stale directory {workspace}. "
                "Please delete it manually and retry."
            )

    workspace.mkdir(parents=True, exist_ok=True)

    try:
        is_sha = bool(re.match(r"^[0-9a-f]{7,40}$", github_ref, re.IGNORECASE))
        depth = None if is_sha else 1

        repo = git.Repo.clone_from(
            github_url,
            str(workspace),
            depth=depth,
            no_single_branch=True,
        )

        if github_ref and github_ref != "main":
            repo.git.checkout(github_ref)

        commit_sha = repo.head.commit.hexsha
        return workspace, commit_sha

    except Exception as exc:
        shutil.rmtree(workspace, onerror=_force_remove_readonly, ignore_errors=True)
        raise RuntimeError(f"ProjectUploadAgent: Failed cloning {github_url}: {exc}") from exc




async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute Agent 1 — Project Upload Agent."""
    logger.info("ProjectUploadAgent started", project_id=project_id)

    source_type = input_data.get("source_type", "zip")
    snapshot_id = input_data.get("snapshot_id") or input_data.get("snapshot_label") or "snapshotA"
    project_name = input_data.get("project_name", "Unnamed Project")
    doc_files = input_data.get("doc_files", [])

    commit_sha = None

    if source_type == "zip":
        workspace_path = await _handle_zip(
            project_id=project_id,
            extracted_path=input_data.get("extracted_path", ""),
            snapshot_id=snapshot_id,
        )
    elif source_type == "github":
        workspace_path, commit_sha = await _handle_github(
            project_id=project_id,
            github_url=input_data.get("github_url", ""),
            github_ref=input_data.get("github_ref", "main"),
            snapshot_id=snapshot_id,
        )
    else:
        raise ValueError(f"ProjectUploadAgent: Unsupported source_type '{source_type}'")

    # Perform universal technology stack detection
    tech_info = detect_tech_stack(workspace_path)
    warnings = []
    if tech_info.tech_confidence < 0.5:
        warnings.append(
            f"Low confidence tech detection ({tech_info.tech_confidence:.0%}). "
            f"Detected: {tech_info.language}/{tech_info.framework}. "
            "Results may be less precise for unknown or mixed-language projects."
        )

    file_count = _count_files(workspace_path)

    # Process and isolate legacy documentation files if provided
    docs_asset_ids = _process_legacy_docs(project_id, doc_files)

    # Persist MongoDB project metadata record
    try:
        from core.database import get_database
        from bson import ObjectId

        db = get_database()
        await db.projects.update_one(
            {"_id": ObjectId(project_id)},
            {
                "$set": {
                    "name": project_name,
                    "status": "validated",
                    "latestSnapshotId": snapshot_id,
                    "updatedAt": datetime.utcnow().isoformat(),
                    "framework": tech_info.framework,
                    "techStack": tech_info.tech_stack,
                },
                "$addToSet": {
                    "snapshots": {
                        "label": snapshot_id,
                        "extractedPath": str(workspace_path),
                        "sourceType": source_type,
                        "githubCommitSha": commit_sha,
                        "fileCount": file_count,
                        "language": tech_info.language,
                        "framework": tech_info.framework,
                        "techStack": tech_info.tech_stack,
                    },
                    "docsAssetIds": {"$each": docs_asset_ids},
                },
            },
            upsert=True,
        )
    except Exception as db_err:
        logger.warning("Could not directly write project metadata to MongoDB", error=str(db_err))

    # Standardized output JSON structure as requested
    output_data = {
        "projectId": project_id,
        "workspacePath": str(workspace_path),
        "snapshotId": snapshot_id,
        "docsAssetIds": docs_asset_ids,
        "status": "SUCCESS",
        "source_type": source_type,
        "project_name": project_name,
        "github_commit_sha": commit_sha,
        "language": tech_info.language,
        "framework": tech_info.framework,
        "tech_stack": tech_info.tech_stack,
        "build_tool": tech_info.build_tool,
        "framework_version": tech_info.framework_version,
        "tech_confidence": tech_info.tech_confidence,
        "source_extensions": tech_info.source_extensions,
        "validation_warnings": warnings,
        "file_count": file_count,
        # Legacy compatibility
        "extracted_path": str(workspace_path),
        "is_spring_boot": tech_info.language == "java" and "spring" in tech_info.framework,
    }

    logger.info(
        "ProjectUploadAgent completed successfully",
        project_id=project_id,
        snapshotId=snapshot_id,
        language=tech_info.language,
        framework=tech_info.framework,
        tech_confidence=tech_info.tech_confidence,
        docsCount=len(docs_asset_ids),
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="ProjectUploadAgent",
        status=AgentStatus.SUCCESS,
        data=output_data,
    )
