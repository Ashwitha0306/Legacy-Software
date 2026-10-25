"""
Agent 3 — Legacy Documentation Ingestion Agent (Two-Phase Implementation)

PURPOSE:
  Extract structured knowledge from human-authored legacy documentation files
  and ground it in the Semantic Software Knowledge Graph (SSKG).

TWO-PHASE WORKFLOW:

Phase A — Early Parsing (runs right after Preprocessing):
  Input: legacy_docs asset files from Agent 1 (PDF, DOCX, MD, TXT, OpenAPI/Swagger JSON/YAML).
  Processing:
    - PDF → page-by-page text extraction (via pypdf), tagged with location ("Page X").
    - DOCX → paragraph-by-paragraph text extraction (via python-docx), tagged with location ("Paragraph X").
    - MD / TXT → header-based section splitting (#, ##, ===, ---), tagged with location ("Lines X-Y").
    - OpenAPI / Swagger (JSON/YAML) → parse into structured endpoint items (path, method, params, description, summary), tagged with passage_type="openapi".
    - Chunk extracted text into passages, each tagged with sourceFile, sectionTitle, location, and passage_type.
  Output: { "passages": [ { passage_id, text, sourceFile, sectionTitle, location, passage_type, openapi_metadata } ] }

Phase B — Linking (runs after Agent 5, once the SSKG exists):
  Input: Phase A passages + completed SSKG nodes & edges.
  Processing:
    - Match passages against SSKG node names (classes, methods, APIs) via exact/substring string matching and token overlap.
    - Link matched passages to their SSKG node(s) as "documentation evidence".
    - For OpenAPI-derived endpoints specifically, cross-reference directly against API nodes found in code:
      * Flag 'documented_but_missing' (present in OpenAPI spec, absent in code AST).
      * Flag 'undocumented_but_present' (present in code AST, absent in OpenAPI spec).
  Output: { "linkedPassages": [...], "swagger_mismatches": { "documented_but_missing": [...], "undocumented_but_present": [...] } }
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import yaml

from core.logger import get_logger
from core.schemas import AgentEnvelope, AgentStatus

logger = get_logger(__name__)


# ── Phase A: Parsing Helper Functions ─────────────────────────────────────────

def parse_markdown_txt(file_path: Path, filename: str) -> List[Dict[str, Any]]:
    """Parse Markdown or TXT files into section passages with line location metadata."""
    passages: List[Dict[str, Any]] = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        lines = content.splitlines()
        
        sections: List[Tuple[str, int, int, List[str]]] = []
        current_title = "Document Overview"
        current_start = 1
        current_lines: List[str] = []

        for idx, line in enumerate(lines, start=1):
            if re.match(r"^#{1,4}\s+(.+)", line) or re.match(r"^===+|^---+", line):
                if current_lines:
                    sections.append((current_title, current_start, idx - 1, current_lines))
                current_title = line.lstrip("#= -").strip() or f"Section at line {idx}"
                current_start = idx
                current_lines = [line]
            else:
                current_lines.append(line)

        if current_lines:
            sections.append((current_title, current_start, len(lines), current_lines))

        for idx, (title, start_ln, end_ln, text_lines) in enumerate(sections, start=1):
            text_block = "\n".join(text_lines).strip()
            if text_block:
                passages.append({
                    "passage_id": f"{filename}_sec_{idx}",
                    "text": text_block[:2000],
                    "sourceFile": filename,
                    "file_path": str(file_path),
                    "sectionTitle": title,
                    "location": f"Lines {start_ln}-{end_ln}",
                    "passage_type": "text",
                    "source_type": "existing documentation",
                })
    except Exception as exc:
        logger.error("Failed parsing MD/TXT file", file=filename, error=str(exc))

    return passages


def parse_openapi_swagger(file_path: Path, filename: str) -> List[Dict[str, Any]]:
    """Parse OpenAPI / Swagger JSON or YAML specification into structured endpoint passages."""
    passages: List[Dict[str, Any]] = []
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
        suffix = file_path.suffix.lower()
        
        if suffix == ".json":
            data = json.loads(content)
        else:
            data = yaml.safe_load(content)

        if not isinstance(data, dict) or not ("openapi" in data or "swagger" in data or "paths" in data):
            return passages

        paths = data.get("paths", {})
        idx = 1
        for path_str, methods in paths.items():
            if not isinstance(methods, dict):
                continue
            for method_name, details in methods.items():
                if method_name.lower() in ["parameters", "summary", "description", "$ref"]:
                    continue
                
                if isinstance(details, dict):
                    summary = details.get("summary", "")
                    desc = details.get("description", "")
                    params_list = details.get("parameters", [])
                    param_names = [p.get("name", "") for p in params_list if isinstance(p, dict)]
                    
                    text_content = (
                        f"API Endpoint Specification:\n"
                        f"Method: {method_name.upper()}\n"
                        f"Path: {path_str}\n"
                        f"Summary: {summary}\n"
                        f"Description: {desc}\n"
                        f"Parameters: {', '.join(param_names) if param_names else 'None'}"
                    )

                    passages.append({
                        "passage_id": f"{filename}_endpoint_{idx}",
                        "text": text_content,
                        "sourceFile": filename,
                        "file_path": str(file_path),
                        "sectionTitle": f"API Endpoint: {method_name.upper()} {path_str}",
                        "location": f"Path: {path_str}",
                        "passage_type": "openapi",
                        "source_type": "existing documentation",
                        "openapi_metadata": {
                            "method": method_name.upper(),
                            "path": path_str,
                            "summary": summary,
                            "description": desc,
                            "parameters": param_names,
                        },
                    })
                    idx += 1
    except Exception as exc:
        logger.error("Failed parsing OpenAPI/Swagger specification", file=filename, error=str(exc))

    return passages


def parse_pdf(file_path: Path, filename: str) -> List[Dict[str, Any]]:
    """Parse PDF files page by page using pypdf."""
    passages: List[Dict[str, Any]] = []
    try:
        import pypdf
        reader = pypdf.PdfReader(str(file_path))
        for page_num, page in enumerate(reader.pages, start=1):
            text = (page.extract_text() or "").strip()
            if text:
                title = text.splitlines()[0][:60] if text.splitlines() else f"Page {page_num}"
                passages.append({
                    "passage_id": f"{filename}_page_{page_num}",
                    "text": text[:2000],
                    "sourceFile": filename,
                    "file_path": str(file_path),
                    "sectionTitle": title,
                    "location": f"Page {page_num}",
                    "passage_type": "text",
                    "source_type": "existing documentation",
                })
    except Exception as exc:
        logger.error("Failed parsing PDF file", file=filename, error=str(exc))

    return passages


def parse_docx(file_path: Path, filename: str) -> List[Dict[str, Any]]:
    """Parse DOCX files paragraph by paragraph using python-docx."""
    passages: List[Dict[str, Any]] = []
    try:
        import docx
        doc = docx.Document(str(file_path))
        paragraphs = [p.text.strip() for p in doc.paragraphs if p.text.strip()]
        
        current_chunk: List[str] = []
        chunk_idx = 1
        para_start = 1

        for idx, para in enumerate(paragraphs, start=1):
            current_chunk.append(para)
            if len("\n".join(current_chunk)) >= 1000 or idx == len(paragraphs):
                text_block = "\n".join(current_chunk)
                title = current_chunk[0][:60] if current_chunk else f"Paragraph {para_start}"
                passages.append({
                    "passage_id": f"{filename}_para_{chunk_idx}",
                    "text": text_block[:2000],
                    "sourceFile": filename,
                    "file_path": str(file_path),
                    "sectionTitle": title,
                    "location": f"Paragraphs {para_start}-{idx}",
                    "passage_type": "text",
                    "source_type": "existing documentation",
                })
                current_chunk = []
                chunk_idx += 1
                para_start = idx + 1
    except Exception as exc:
        logger.error("Failed parsing DOCX file", file=filename, error=str(exc))

    return passages


def parse_document_file(file_path: Path) -> List[Dict[str, Any]]:
    """Dispatch document file parsing based on file extension."""
    suffix = file_path.suffix.lower()
    filename = file_path.name

    if suffix in [".md", ".markdown", ".txt"]:
        return parse_markdown_txt(file_path, filename)
    elif suffix in [".json", ".yaml", ".yml"]:
        return parse_openapi_swagger(file_path, filename)
    elif suffix == ".pdf":
        return parse_pdf(file_path, filename)
    elif suffix == ".docx":
        return parse_docx(file_path, filename)
    
    return []


# ── Phase B: Linking & OpenAPI Mismatch Cross-Referencing ──────────────────────

def link_passages_and_cross_reference(
    passages: List[Dict[str, Any]],
    sskg_nodes: List[Dict[str, Any]]
) -> Tuple[List[Dict[str, Any]], Dict[str, List[Dict[str, Any]]]]:
    """
    Phase B Processing:
    1. Match passages against SSKG node names (classes, methods, APIs) via exact/substring string match & similarity.
    2. Cross-reference OpenAPI/Swagger endpoints against API nodes in code to find mismatches:
       - documented_but_missing (in Swagger, absent in code AST)
       - undocumented_but_present (in code AST, absent in Swagger)
    """
    linked_passages: List[Dict[str, Any]] = []

    # Map SSKG nodes for fast lookup
    node_map: Dict[str, Dict[str, Any]] = {}
    api_nodes_in_code: List[Dict[str, Any]] = []

    for node in sskg_nodes:
        nid = node.get("node_id", "")
        ntype = node.get("node_type", "")
        name = node.get("name", "")
        qname = node.get("qualified_name", "")
        node_map[nid] = node

        if ntype == "API":
            api_nodes_in_code.append(node)

    # 1. Match Passages to SSKG Nodes
    for p in passages:
        content_lower = p.get("text", "").lower()
        matched_node_ids: List[str] = []
        confidence_scores: List[float] = []

        for nid, node in node_map.items():
            name = node.get("name", "")
            qname = node.get("qualified_name", "")
            ntype = node.get("node_type", "")

            if not name or len(name) < 3:
                continue

            # Exact or Substring Matching
            if name.lower() in content_lower or (qname and qname.lower() in content_lower):
                matched_node_ids.append(nid)
                confidence_scores.append(0.95 if name.lower() == content_lower else 0.85)

        confidence = max(confidence_scores) if confidence_scores else 0.0

        linked_passages.append({
            "passageId": p.get("passage_id"),
            "text": p.get("text"),
            "sourceFile": p.get("sourceFile"),
            "sectionTitle": p.get("sectionTitle"),
            "location": p.get("location"),
            "passage_type": p.get("passage_type", "text"),
            "linkedNodeIds": matched_node_ids,
            "matchConfidence": round(confidence, 2),
            "openapi_metadata": p.get("openapi_metadata"),
        })

    # 2. Cross-Reference OpenAPI endpoints vs Code AST API nodes
    openapi_endpoints: List[Dict[str, Any]] = []
    for p in passages:
        if p.get("passage_type") == "openapi" and p.get("openapi_metadata"):
            openapi_endpoints.append(p["openapi_metadata"])

    documented_but_missing: List[Dict[str, Any]] = []
    undocumented_but_present: List[Dict[str, Any]] = []

    # Format code API nodes for comparison: (method, path)
    code_apis: Set[Tuple[str, str]] = set()
    for code_api in api_nodes_in_code:
        meta = code_api.get("metadata", {})
        method = meta.get("http_method", "GET").upper()
        path_str = meta.get("path", "").rstrip("/") or "/"
        code_apis.add((method, path_str))

    swagger_apis: Set[Tuple[str, str]] = set()
    for oapi in openapi_endpoints:
        method = oapi.get("method", "GET").upper()
        path_str = oapi.get("path", "").rstrip("/") or "/"
        swagger_apis.add((method, path_str))

    if openapi_endpoints:
        # Check Documented but Missing (in OpenAPI, not in Code)
        for (m, p_str) in swagger_apis:
            if (m, p_str) not in code_apis:
                documented_but_missing.append({
                    "method": m,
                    "path": p_str,
                    "issue": "Endpoint documented in OpenAPI specification but not found in codebase AST",
                })

        # Check Undocumented but Present (in Code, not in OpenAPI)
        for (m, p_str) in code_apis:
            if (m, p_str) not in swagger_apis:
                undocumented_but_present.append({
                    "method": m,
                    "path": p_str,
                    "issue": "Endpoint present in codebase AST but not documented in OpenAPI specification",
                })

    swagger_mismatches = {
        "documented_but_missing": documented_but_missing,
        "undocumented_but_present": undocumented_but_present,
    }

    return linked_passages, swagger_mismatches


# ── Agent Run Function ─────────────────────────────────────────────────────────

async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute Agent 3 — Legacy Documentation Ingestion Agent (Two-Phase)."""
    logger.info("LegacyDocAgent started", project_id=project_id)

    phase = input_data.get("phase", "parse")  # "parse" or "link"
    doc_paths = input_data.get("doc_paths", [])
    doc_dir = input_data.get("doc_directory")

    # Discover document files from explicit paths and project directory
    files_to_process: List[Path] = []
    seen_paths: Set[str] = set()

    for p in doc_paths:
        pp = Path(p)
        if pp.exists() and str(pp.resolve()) not in seen_paths:
            files_to_process.append(pp)
            seen_paths.add(str(pp.resolve()))

    if doc_dir and Path(doc_dir).exists():
        dpath = Path(doc_dir)
        for ext in ["*.md", "*.markdown", "*.txt", "*.json", "*.yaml", "*.yml", "*.pdf", "*.docx"]:
            for f in dpath.rglob(ext):
                # Avoid node_modules, .git, build, target
                if not any(part.startswith(".") or part in ("node_modules", "target", "build") for part in f.parts):
                    if str(f.resolve()) not in seen_paths:
                        files_to_process.append(f)
                        seen_paths.add(str(f.resolve()))

    passages: List[Dict[str, Any]] = input_data.get("existing_passages", [])

    # Phase A: Early Parsing
    if phase == "parse" or not passages:
        all_passages: List[Dict[str, Any]] = []
        for f in files_to_process:
            parsed = parse_document_file(f)
            all_passages.extend(parsed)
        passages = all_passages

    linked_passages: List[Dict[str, Any]] = []
    swagger_mismatches: Dict[str, List[Dict[str, Any]]] = {
        "documented_but_missing": [],
        "undocumented_but_present": [],
    }

    # Phase B: SSKG Linking & Swagger Mismatch Cross-Referencing
    if phase == "link" or input_data.get("sskg_nodes"):
        sskg_nodes = input_data.get("sskg_nodes", [])
        linked_passages, swagger_mismatches = link_passages_and_cross_reference(passages, sskg_nodes)

    output_data = {
        "passages": passages,
        "linkedPassages": linked_passages,
        "swagger_mismatches": swagger_mismatches,
        "total_passages": len(passages),
        "linked_count": sum(1 for lp in linked_passages if lp.get("linkedNodeIds")),
        "phase": phase,
    }

    logger.info(
        "LegacyDocAgent completed successfully",
        project_id=project_id,
        phase=phase,
        total_passages=len(passages),
        linked_count=output_data["linked_count"],
        documented_but_missing=len(swagger_mismatches["documented_but_missing"]),
        undocumented_but_present=len(swagger_mismatches["undocumented_but_present"]),
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="LegacyDocAgent",
        status=AgentStatus.SUCCESS,
        data=output_data,
    )
