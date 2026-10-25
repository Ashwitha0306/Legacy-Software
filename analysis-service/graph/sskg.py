"""
Semantic Software Knowledge Graph (SSKG) Data Model & Construction Engine

Uses NetworkX to maintain a multi-relational directed graph representing:
  - Node Types: Class, Method, Package, API, Configuration, Entity, Repository, Service, DatabaseTable
  - Relationship Types: CALLS, USES, DEPENDS_ON, IMPLEMENTS, EXTENDS, ANNOTATED_WITH, MAPS_TO, RETURNS

Supports ANY programming language codebase (Java, Python, JS/TS, Go, C#, Ruby, PHP, Rust, etc.).
Includes in-memory NetworkX operations + disk serialization (JSON & GraphML).
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple
import networkx as nx

from core.schemas import (
    GraphNode, GraphEdge, SSKGData, NodeType, RelationshipType, ParsedClass, ParsedMethod
)
from core.logger import get_logger
from core.config import settings

logger = get_logger(__name__)

# Stereotype classification patterns for universal multi-language support
SERVICE_PATTERNS = re.compile(r"(Service|UseCase|Handler|Manager|Logic|Processor)\b", re.IGNORECASE)
REPO_PATTERNS = re.compile(r"(Repository|DAO|Store|ModelManager|Query)\b", re.IGNORECASE)
ENTITY_PATTERNS = re.compile(r"(Entity|Model|Schema|Record|DTO)\b", re.IGNORECASE)
CONFIG_PATTERNS = re.compile(r"(Configuration|Config|Settings|AppConfig)\b", re.IGNORECASE)


def derive_node_type(cls: ParsedClass) -> NodeType:
    """Derive richer node type based on stereotype annotations, decorators, or class names."""
    annotations_str = " ".join(cls.annotations).lower()
    name = cls.class_name

    # 1. Annotations / Decorators matching
    if any(a in annotations_str for a in ["service", "injectable", "component"]):
        return NodeType.SERVICE
    elif any(a in annotations_str for a in ["repository", "dao"]):
        return NodeType.REPOSITORY
    elif any(a in annotations_str for a in ["entity", "table", "model", "schema"]):
        return NodeType.ENTITY
    elif any(a in annotations_str for a in ["configuration", "config", "settings"]):
        return NodeType.CONFIGURATION
    elif any(a in annotations_str for a in ["restcontroller", "controller", "api"]):
        return NodeType.CLASS

    # 2. Class name convention fallback
    if SERVICE_PATTERNS.search(name):
        return NodeType.SERVICE
    elif REPO_PATTERNS.search(name) or (cls.extends and "repository" in cls.extends.lower()):
        return NodeType.REPOSITORY
    elif ENTITY_PATTERNS.search(name):
        return NodeType.ENTITY
    elif CONFIG_PATTERNS.search(name):
        return NodeType.CONFIGURATION

    return NodeType.CLASS


class SSKGManager:
    """Manager class for building, querying, and serializing the SSKG graph."""

    def __init__(self, project_id: str):
        self.project_id = project_id
        self.graph = nx.DiGraph()

    def add_node(
        self,
        node_id: str,
        node_type: NodeType,
        name: str,
        qualified_name: str,
        file_path: str,
        start_line: int = 1,
        end_line: int = 1,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add or update a node in the SSKG graph."""
        self.graph.add_node(
            node_id,
            node_type=node_type.value if isinstance(node_type, NodeType) else node_type,
            name=name,
            qualified_name=qualified_name,
            file_path=file_path,
            start_line=start_line,
            end_line=end_line,
            metadata=metadata or {},
        )

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        relationship: RelationshipType,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> None:
        """Add a directed edge representing a relationship in the SSKG graph."""
        if source_id in self.graph and target_id in self.graph:
            rel_val = relationship.value if isinstance(relationship, RelationshipType) else relationship
            self.graph.add_edge(source_id, target_id, relationship=rel_val, metadata=metadata or {})

    def build_from_parser_output(
        self,
        parsed_classes: List[ParsedClass],
        language: str = "unknown",
        framework: str = "unknown",
    ) -> SSKGData:
        """
        Build the typed SSKG graph from ParserAgent's classes & methods output.
        """
        class_map: Dict[str, ParsedClass] = {c.qualified_name: c for c in parsed_classes}
        simple_name_map: Dict[str, str] = {c.class_name: c.qualified_name for c in parsed_classes}

        # ── Step 1: Create Package, Class, Entity/Table, Method, and API nodes ────
        for cls in parsed_classes:
            pkg_name = cls.package or (Path(cls.file_path).parent.as_posix() if cls.file_path else "default")
            pkg_id = f"pkg:{pkg_name}"
            if pkg_id not in self.graph:
                self.add_node(
                    node_id=pkg_id,
                    node_type=NodeType.PACKAGE,
                    name=pkg_name,
                    qualified_name=pkg_name,
                    file_path=cls.file_path,
                )

            # Derive node type (Class, Service, Repository, Entity, Configuration)
            cls_type = derive_node_type(cls)
            class_node_id = f"class:{cls.qualified_name}"
            self.add_node(
                node_id=class_node_id,
                node_type=cls_type,
                name=cls.class_name,
                qualified_name=cls.qualified_name,
                file_path=cls.file_path,
                start_line=cls.start_line,
                end_line=cls.end_line,
                metadata={
                    "package": cls.package,
                    "annotations": cls.annotations,
                    "is_interface": cls.is_interface,
                    "is_abstract": cls.is_abstract,
                    "language": cls.language or language,
                    "framework": framework,
                },
            )

            # Package DEPENDS_ON Class
            self.add_edge(pkg_id, class_node_id, RelationshipType.DEPENDS_ON)

            # ANNOTATED_WITH edges for Class annotations
            for ann in cls.annotations:
                ann_id = f"ann:{ann.lstrip('@')}"
                if ann_id not in self.graph:
                    self.add_node(
                        node_id=ann_id,
                        node_type=NodeType.CONFIGURATION,
                        name=ann,
                        qualified_name=ann,
                        file_path=cls.file_path,
                    )
                self.add_edge(class_node_id, ann_id, RelationshipType.ANNOTATED_WITH)

            # If Entity or Repository, infer DatabaseTable node & MAPS_TO edge
            if cls_type in (NodeType.ENTITY, NodeType.REPOSITORY):
                table_name = f"{cls.class_name.lower()}s"
                tbl_id = f"dbtable:{table_name}"
                if tbl_id not in self.graph:
                    self.add_node(
                        node_id=tbl_id,
                        node_type=NodeType.DATABASE_TABLE,
                        name=table_name,
                        qualified_name=table_name,
                        file_path=cls.file_path,
                        metadata={"mapped_entity": cls.class_name},
                    )
                self.add_edge(class_node_id, tbl_id, RelationshipType.MAPS_TO)

            # Methods and Endpoints
            for m in cls.methods:
                m_id = f"method:{m.qualified_name}"
                self.add_node(
                    node_id=m_id,
                    node_type=NodeType.METHOD,
                    name=m.method_name,
                    qualified_name=m.qualified_name,
                    file_path=m.file_path,
                    start_line=m.start_line,
                    end_line=m.end_line,
                    metadata={
                        "return_type": m.return_type,
                        "parameters": m.parameters,
                        "annotations": m.annotations,
                        "modifiers": m.modifiers,
                        "is_endpoint": m.is_endpoint,
                        "http_method": m.http_method,
                        "endpoint_path": m.endpoint_path,
                        "language": cls.language or language,
                    },
                )
                # Class DEPENDS_ON Method (ownership)
                self.add_edge(class_node_id, m_id, RelationshipType.DEPENDS_ON)

                # Method RETURNS ReturnType
                if m.return_type and m.return_type not in ("void", "None", "any", "Object"):
                    ret_qname = simple_name_map.get(m.return_type, m.return_type)
                    ret_target_id = f"class:{ret_qname}"
                    if ret_target_id in self.graph:
                        self.add_edge(m_id, ret_target_id, RelationshipType.RETURNS)

                # API Node & CALLS Edge
                if m.is_endpoint and m.endpoint_path:
                    http_verb = m.http_method or "GET"
                    api_id = f"api:{http_verb}:{m.endpoint_path}"
                    if api_id not in self.graph:
                        self.add_node(
                            node_id=api_id,
                            node_type=NodeType.API,
                            name=f"{http_verb} {m.endpoint_path}",
                            qualified_name=f"{http_verb} {m.endpoint_path}",
                            file_path=m.file_path,
                            start_line=m.start_line,
                            end_line=m.end_line,
                            metadata={
                                "http_method": http_verb,
                                "path": m.endpoint_path,
                                "handler_method": m.qualified_name,
                                "parameters": m.parameters,
                            },
                        )
                    self.add_edge(api_id, m_id, RelationshipType.CALLS)

        # ── Step 2: Resolve Inheritance, Dependencies, and Method Calls ────────
        all_methods_map: Dict[str, str] = {}
        for cls in parsed_classes:
            for m in cls.methods:
                all_methods_map[m.method_name] = m.qualified_name

        for cls in parsed_classes:
            class_node_id = f"class:{cls.qualified_name}"

            # EXTENDS relationship
            if cls.extends:
                parent_qname = simple_name_map.get(cls.extends, cls.extends)
                parent_id = f"class:{parent_qname}"
                if parent_id in self.graph:
                    self.add_edge(class_node_id, parent_id, RelationshipType.EXTENDS)

            # IMPLEMENTS relationship
            for iface in cls.implements:
                iface_qname = simple_name_map.get(iface, iface)
                iface_id = f"class:{iface_qname}"
                if iface_id in self.graph:
                    self.add_edge(class_node_id, iface_id, RelationshipType.IMPLEMENTS)

            # Field USES / DEPENDS_ON relationship
            for f in cls.fields:
                f_type_qname = simple_name_map.get(f.field_type, f.field_type)
                f_target_id = f"class:{f_type_qname}"
                if f_target_id in self.graph:
                    self.add_edge(class_node_id, f_target_id, RelationshipType.USES)

            # Method CALLS method relationships
            for m in cls.methods:
                m_id = f"method:{m.qualified_name}"
                for call_name in m.calls:
                    if call_name in all_methods_map:
                        target_qname = all_methods_map[call_name]
                        if target_qname != m.qualified_name:
                            target_m_id = f"method:{target_qname}"
                            if target_m_id in self.graph:
                                self.add_edge(m_id, target_m_id, RelationshipType.CALLS)

        # ── Step 3: Serialize and Save Graph to Disk ───────────────────────────
        self.serialize_and_save()

        return self.to_schema_data()

    def serialize_and_save(self) -> None:
        """Persist graph to disk in JSON and GraphML format for storage & visualization."""
        try:
            output_dir = Path(settings.UPLOADS_DIR) / "projects" / self.project_id
            output_dir.mkdir(parents=True, exist_ok=True)

            # 1. Save node-link JSON data
            json_path = output_dir / "sskg_graph.json"
            graph_json_data = nx.node_link_data(self.graph)
            json_path.write_text(json.dumps(graph_json_data, indent=2), encoding="utf-8")

            # 2. Save GraphML file (for Cytoscape / Gephi / NetworkX loading)
            graphml_path = output_dir / "sskg_graph.graphml"
            # Prepare graph copy with clean string attributes for GraphML compatibility
            g_copy = self.graph.copy()
            for n, d in g_copy.nodes(data=True):
                if "metadata" in d and isinstance(d["metadata"], dict):
                    d["metadata"] = json.dumps(d["metadata"])
            for u, v, d in g_copy.edges(data=True):
                if "metadata" in d and isinstance(d["metadata"], dict):
                    d["metadata"] = json.dumps(d["metadata"])
            nx.write_graphml(g_copy, str(graphml_path))

            logger.info("Persisted SSKG graph to disk", project_id=self.project_id, json_path=str(json_path))
        except Exception as exc:
            logger.warning("Failed serializing SSKG graph to disk", error=str(exc))

    def get_subgraph_around_nodes(self, center_node_ids: List[str], radius: int = 2) -> Dict[str, Any]:
        """Extract k-hop neighborhood subgraph around specific center nodes."""
        sub_nodes: Set[str] = set()
        for nid in center_node_ids:
            if nid in self.graph:
                sub_nodes.add(nid)
                ego = nx.single_source_shortest_path_length(self.graph.to_undirected(), nid, cutoff=radius)
                sub_nodes.update(ego.keys())

        subg = self.graph.subgraph(sub_nodes)
        return self._subgraph_to_dict(subg)

    def search_nodes(self, query: str) -> List[str]:
        """Search node IDs by matching name or qualified_name."""
        q_lower = query.lower()
        matches = []
        for nid, data in self.graph.nodes(data=True):
            if q_lower in data.get("name", "").lower() or q_lower in data.get("qualified_name", "").lower():
                matches.append(nid)
        return matches

    def _subgraph_to_dict(self, subg: nx.DiGraph) -> Dict[str, Any]:
        nodes_list = []
        edges_list = []

        for nid, attrs in subg.nodes(data=True):
            nodes_list.append(
                GraphNode(
                    node_id=nid,
                    node_type=NodeType(attrs.get("node_type", NodeType.CLASS.value)),
                    name=attrs.get("name", ""),
                    qualified_name=attrs.get("qualified_name", ""),
                    file_path=attrs.get("file_path", ""),
                    start_line=attrs.get("start_line", 1),
                    end_line=attrs.get("end_line", 1),
                    metadata=attrs.get("metadata", {}),
                )
            )

        for u, v, attrs in subg.edges(data=True):
            edges_list.append(
                GraphEdge(
                    source_id=u,
                    target_id=v,
                    relationship=RelationshipType(attrs.get("relationship", RelationshipType.DEPENDS_ON.value)),
                    metadata=attrs.get("metadata", {}),
                )
            )

        return {
            "nodes": [n.model_dump() for n in nodes_list],
            "edges": [e.model_dump() for e in edges_list],
            "node_count": len(nodes_list),
            "edge_count": len(edges_list),
        }

    def to_schema_data(self) -> SSKGData:
        """Export full graph as Pydantic SSKGData schema."""
        d = self._subgraph_to_dict(self.graph)
        pkgs = [data["name"] for _, data in self.graph.nodes(data=True) if data.get("node_type") == NodeType.PACKAGE.value]
        return SSKGData(
            nodes=[GraphNode(**n) for n in d["nodes"]],
            edges=[GraphEdge(**e) for e in d["edges"]],
            node_count=d["node_count"],
            edge_count=d["edge_count"],
            packages=sorted(list(set(pkgs))),
        )
