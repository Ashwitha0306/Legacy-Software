"""
Agent 6 — Diagram Generation & Export Agent

PURPOSE:
  Deterministically render the Semantic Software Knowledge Graph (SSKG) and AST into
  standard UML diagrams without LLM hallucination:
    1. UML Class Diagram (Mermaid classDiagram with fields, methods, inheritance & associations)
    2. UML Execution Sequence Diagram (Client -> Controller -> Service -> Repository -> Database)
    3. UML Component / Package Architecture Diagram (flowchart TB)
    4. UML Entity-Relationship Diagram (erDiagram with primary keys and entity relations)

OUTPUT:
  - Editable source files saved to disk (.mmd, .puml)
  - Rendered standalone SVG image files saved to disk (.svg)
  - Full Mermaid source strings passed to frontend for interactive dynamic rendering
"""

from __future__ import annotations

import html
import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple, Union

from core.logger import get_logger
from core.schemas import AgentEnvelope, AgentStatus, ParsedClass, ParsedField, ParsedMethod
from core.config import settings
from core.uml_generator import (
    generate_class_diagram as _gen_class_diagram,
    generate_class_svg as _gen_class_svg,
    generate_sequence_diagram as _gen_sequence_diagram,
    generate_sequence_svg as _gen_sequence_svg,
    generate_component_diagram as _gen_component_diagram,
    generate_component_svg as _gen_component_svg,
    generate_er_diagram as _gen_er_diagram,
    generate_use_case_diagram as _gen_use_case_diagram,
    generate_use_case_svg as _gen_use_case_svg,
    generate_activity_diagram as _gen_activity_diagram,
    generate_activity_svg as _gen_activity_svg,
    generate_collaboration_diagram as _gen_collaboration_diagram,
    generate_collaboration_svg as _gen_collaboration_svg,
    generate_deployment_diagram as _gen_deployment_diagram,
    generate_deployment_svg as _gen_deployment_svg,
    generate_package_diagram as _gen_package_diagram,
    generate_package_svg as _gen_package_svg,
    generate_all_uml_diagrams as _gen_all_uml_diagrams,
)

logger = get_logger(__name__)


def _clean_node_type(raw: str) -> str:
    """Normalize SSKG node_type strings like 'NodeType.CLASS' -> 'Class'."""
    if not raw:
        return "Class"
    # Strip 'NodeType.' prefix if present
    s = str(raw)
    if "." in s:
        s = s.rsplit(".", 1)[-1]
    # Map common values to Spring stereotype names
    mapping = {
        "CLASS": "Class",
        "SERVICE": "Service",
        "CONTROLLER": "Controller",
        "REPOSITORY": "Repository",
        "ENTITY": "Entity",
        "CONFIGURATION": "Configuration",
        "API": "API",
        "INTERFACE": "Interface",
        "ENUM": "Enum",
        # Already-clean values pass through
        "Class": "Class",
        "Service": "Service",
        "Controller": "Controller",
        "Repository": "Repository",
        "Entity": "Entity",
        "Configuration": "Configuration",
    }
    return mapping.get(s, "Class")


def _is_annotation_node(name: str) -> bool:
    """Return True if the node represents a Java annotation, not a real class."""
    if not name:
        return False
    # Java annotation nodes always start with '@' or contain '(' (parameterized)
    return name.startswith("@") or "(" in name or name.startswith("RelationshipType.")


def _normalize_classes(nodes_or_classes: Any) -> List[ParsedClass]:
    """
    Convert input list (either ParsedClass objects or SSKG node dicts) to ParsedClass list.

    Filters:
      - Annotation nodes (@Entity, @Table(name=...) etc.)
      - RelationshipType pseudo-nodes
      - Nodes whose names are not valid Java class identifiers
    """
    classes: List[ParsedClass] = []
    if not isinstance(nodes_or_classes, list):
        return classes

    for item in nodes_or_classes:
        if isinstance(item, ParsedClass):
            classes.append(item)
            continue

        if not isinstance(item, dict):
            continue

        # Branch 1: Already a serialized ParsedClass dict (has class_name key)
        if "class_name" in item:
            cname = item.get("class_name", "")
            if _is_annotation_node(cname):
                continue
            classes.append(
                ParsedClass(
                    class_name=cname or "Component",
                    qualified_name=item.get("qualified_name", cname or "Component"),
                    file_path=item.get("file_path", ""),
                    start_line=item.get("start_line", 1),
                    end_line=item.get("end_line", 1),
                    annotations=item.get("annotations", []),
                    methods=[ParsedMethod(**m) if isinstance(m, dict) else m for m in item.get("methods", [])],
                    fields=[ParsedField(**f) if isinstance(f, dict) else f for f in item.get("fields", [])],
                    extends=item.get("extends"),
                    implements=item.get("implements", []),
                )
            )
            continue

        # Branch 2: SSKG node dict (has name / node_type keys)
        raw_name = item.get("name", item.get("qualified_name", ""))
        # Strip SSKG node_id prefixes like "Class:OrderService"
        raw_name = re.sub(r'^(Class|API|Service|Entity|Repository|Configuration):', '', str(raw_name)).strip()

        if not raw_name or _is_annotation_node(raw_name):
            continue  # Skip annotation nodes entirely

        # Normalize node_type from Python enum repr to plain string
        raw_type = item.get("node_type", "Class")
        node_type_clean = _clean_node_type(str(raw_type))

        # Map SSKG node type to Spring annotation so uml_generator picks the right stereotype
        stereotype_annotation = {
            "Controller": "RestController",
            "Service": "Service",
            "Repository": "Repository",
            "Entity": "Entity",
            "Configuration": "Configuration",
        }.get(node_type_clean, "")

        classes.append(
            ParsedClass(
                class_name=raw_name,
                qualified_name=item.get("qualified_name", raw_name),
                file_path=item.get("file_path", ""),
                start_line=item.get("start_line", 1),
                end_line=item.get("end_line", 1),
                annotations=[stereotype_annotation] if stereotype_annotation else [],
                methods=[],
                fields=[],
            )
        )

    return classes



# Backwards-compatibility wrapper functions
def generate_mermaid_class_diagram(nodes_or_classes: Any, edges: Optional[List[Dict[str, Any]]] = None) -> str:
    parsed = _normalize_classes(nodes_or_classes)
    return _gen_class_diagram(parsed)


def generate_mermaid_sequence_diagram(nodes_or_classes: Any, edges: Optional[List[Dict[str, Any]]] = None, workflow_target: str = "") -> str:
    parsed = _normalize_classes(nodes_or_classes)
    return _gen_sequence_diagram(parsed)


def generate_package_dependency_diagram(nodes_or_classes: Any, edges: Optional[List[Dict[str, Any]]] = None) -> str:
    parsed = _normalize_classes(nodes_or_classes)
    return _gen_component_diagram(parsed)


def generate_plantuml_component_diagram(nodes_or_classes: Any, edges: Optional[List[Dict[str, Any]]] = None) -> str:
    parsed = _normalize_classes(nodes_or_classes)
    return _gen_component_diagram(parsed)


def generate_svg_representation(diagram_title: str, source_code: str) -> str:
    """Generate a standalone SVG vector visualization for the diagram."""
    lines_count = len(source_code.split("\n"))
    height = max(450, lines_count * 22 + 120)
    width = 850

    escaped_title = html.escape(diagram_title)
    escaped_content = html.escape(source_code[:1500])

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="100%" height="100%" style="background-color: #0f172a; font-family: sans-serif;">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="#1e1b4b" stop-opacity="0.6"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#grad)" rx="12"/>
  <rect x="20" y="20" width="{width-40}" height="50" fill="#1e293b" rx="8" stroke="#334155" stroke-width="1"/>
  <text x="40" y="52" fill="#38bdf8" font-size="20" font-weight="bold">{escaped_title}</text>
  <rect x="20" y="85" width="{width-40}" height="{height-110}" fill="#090d16" rx="8" stroke="#334155" stroke-width="1"/>
  <foreignObject x="35" y="100" width="{width-70}" height="{height-140}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color: #cbd5e1; font-family: monospace; font-size: 13px; white-space: pre-wrap; word-break: break-all;">
      {escaped_content}
    </div>
  </foreignObject>
</svg>"""
    return svg


async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute Diagram Generation & Export Agent."""
    logger.info("DiagramAgent started", project_id=project_id)

    raw_classes = input_data.get("classes", [])
    nodes = input_data.get("nodes", [])
    project_name = input_data.get("project_name", "System")

    # Normalize parsed classes from either classes list or nodes list
    parsed_classes = _normalize_classes(raw_classes) if raw_classes else _normalize_classes(nodes)

    # 1. Generate standard UML Diagrams (source & SVG)
    mermaid_usecase = _gen_use_case_diagram(parsed_classes, project_name=project_name)
    svg_usecase = _gen_use_case_svg(parsed_classes, project_name=project_name)

    mermaid_activity = _gen_activity_diagram(parsed_classes)
    svg_activity = _gen_activity_svg(parsed_classes, project_name=project_name)

    mermaid_seq = _gen_sequence_diagram(parsed_classes, project_name=project_name)
    svg_seq = _gen_sequence_svg(parsed_classes, project_name=project_name)

    mermaid_collab = _gen_collaboration_diagram(parsed_classes, project_name=project_name)
    svg_collab = _gen_collaboration_svg(parsed_classes, project_name=project_name)

    mermaid_class = _gen_class_diagram(parsed_classes, project_name=project_name)
    svg_class = _gen_class_svg(parsed_classes, project_name=project_name)

    mermaid_comp = _gen_component_diagram(parsed_classes)
    svg_comp = _gen_component_svg(parsed_classes, project_name=project_name)

    mermaid_deploy = _gen_deployment_diagram(parsed_classes)
    svg_deploy = _gen_deployment_svg(parsed_classes, project_name=project_name)

    mermaid_pkg = _gen_package_diagram(parsed_classes)
    svg_pkg = _gen_package_svg(parsed_classes, project_name=project_name)

    mermaid_er = _gen_er_diagram(parsed_classes)
    svg_er = generate_svg_representation("UML Entity-Relationship Diagram", mermaid_er)

    # 2. Save files to disk under project workspace / diagrams /
    diagrams_dir = Path(settings.UPLOADS_DIR) / "projects" / project_id / "diagrams"
    diagrams_dir.mkdir(parents=True, exist_ok=True)

    file_mappings = [
        ("use_case_diagram.mmd", mermaid_usecase),
        ("use_case_diagram.svg", svg_usecase),
        ("activity_diagram.mmd", mermaid_activity),
        ("activity_diagram.svg", svg_activity),
        ("sequence_diagram.mmd", mermaid_seq),
        ("sequence_diagram.svg", svg_seq),
        ("collaboration_diagram.mmd", mermaid_collab),
        ("collaboration_diagram.svg", svg_collab),
        ("class_diagram.mmd", mermaid_class),
        ("class_diagram.svg", svg_class),
        ("component_diagram.mmd", mermaid_comp),
        ("component_diagram.svg", svg_comp),
        ("deployment_diagram.mmd", mermaid_deploy),
        ("deployment_diagram.svg", svg_deploy),
        ("package_diagram.mmd", mermaid_pkg),
        ("package_diagram.svg", svg_pkg),
        ("er_diagram.mmd", mermaid_er),
        ("er_diagram.svg", svg_er),
    ]

    for fname, content in file_mappings:
        try:
            (diagrams_dir / fname).write_text(content, encoding="utf-8")
        except Exception as err:
            logger.warning(f"Could not save diagram file {fname}", error=str(err))

    diagrams_list = [
        {
            "type": "use_case_diagram",
            "title": "UML Use Case Diagram",
            "sourceFile": "use_case_diagram.mmd",
            "renderedFile": "use_case_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/use_case_diagram.svg",
        },
        {
            "type": "activity_diagram",
            "title": "UML Activity Diagram",
            "sourceFile": "activity_diagram.mmd",
            "renderedFile": "activity_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/activity_diagram.svg",
        },
        {
            "type": "sequence_diagram",
            "title": "UML Sequence Diagram",
            "sourceFile": "sequence_diagram.mmd",
            "renderedFile": "sequence_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/sequence_diagram.svg",
        },
        {
            "type": "collaboration_diagram",
            "title": "UML Collaboration Diagram",
            "sourceFile": "collaboration_diagram.mmd",
            "renderedFile": "collaboration_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/collaboration_diagram.svg",
        },
        {
            "type": "class_diagram",
            "title": "UML Class Diagram",
            "sourceFile": "class_diagram.mmd",
            "renderedFile": "class_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/class_diagram.svg",
        },
        {
            "type": "component_diagram",
            "title": "UML Component Diagram",
            "sourceFile": "component_diagram.mmd",
            "renderedFile": "component_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/component_diagram.svg",
        },
        {
            "type": "deployment_diagram",
            "title": "UML Deployment Diagram",
            "sourceFile": "deployment_diagram.mmd",
            "renderedFile": "deployment_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/deployment_diagram.svg",
        },
        {
            "type": "package_diagram",
            "title": "Package Dependency Diagram",
            "sourceFile": "package_diagram.mmd",
            "renderedFile": "package_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/package_diagram.svg",
        },
        {
            "type": "er_diagram",
            "title": "UML Entity-Relationship Diagram",
            "sourceFile": "er_diagram.mmd",
            "renderedFile": "er_diagram.svg",
            "downloadUrl": f"/uploads/projects/{project_id}/diagrams/er_diagram.svg",
        },
    ]

    diagrams_dict = {
        "use_case_diagram": {
            "title": "UML Use Case Diagram",
            "mermaid": mermaid_usecase,
            "svg": svg_usecase,
        },
        "activity_diagram": {
            "title": "UML Activity Diagram",
            "mermaid": mermaid_activity,
            "svg": svg_activity,
        },
        "sequence_diagram": {
            "title": "UML Sequence Diagram",
            "mermaid": mermaid_seq,
            "svg": svg_seq,
        },
        "collaboration_diagram": {
            "title": "UML Collaboration Diagram",
            "mermaid": mermaid_collab,
            "svg": svg_collab,
        },
        "class_diagram": {
            "title": "UML Class Diagram",
            "mermaid": mermaid_class,
            "svg": svg_class,
        },
        "component_diagram": {
            "title": "UML Component Diagram",
            "mermaid": mermaid_comp,
            "svg": svg_comp,
        },
        "deployment_diagram": {
            "title": "UML Deployment Diagram",
            "mermaid": mermaid_deploy,
            "svg": svg_deploy,
        },
        "package_diagram": {
            "title": "Package Dependency Diagram",
            "mermaid": mermaid_pkg,
            "svg": svg_pkg,
        },
        "er_diagram": {
            "title": "UML Entity-Relationship Diagram",
            "mermaid": mermaid_er,
            "svg": svg_er,
        },
    }

    logger.info("DiagramAgent completed successfully", project_id=project_id, diagrams_count=len(diagrams_list))

    return AgentEnvelope(
        projectId=project_id,
        agent="DiagramAgent",
        status=AgentStatus.SUCCESS,
        data={
            "diagrams": diagrams_dict,
            "diagrams_list": diagrams_list,
            "use_case_diagram": mermaid_usecase,
            "activity_diagram": mermaid_activity,
            "class_diagram": mermaid_class,
            "sequence_diagram": mermaid_seq,
            "collaboration_diagram": mermaid_collab,
            "component_diagram": mermaid_comp,
            "deployment_diagram": mermaid_deploy,
            "package_diagram": mermaid_pkg,
            "er_diagram": mermaid_er,
            "export_formats": ["svg", "mermaid", "plantuml"],
        },
    )
