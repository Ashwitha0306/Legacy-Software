"""
Shared Pydantic schemas for all agent inputs and outputs.

Every agent in the RAV pipeline communicates via structured JSON following
this canonical envelope format:

    {
      "projectId": "<str>",
      "agent": "<AgentName>",
      "status": "SUCCESS" | "FAILED" | "PARTIAL",
      "timestamp": "<ISO8601>",
      "data": { ... agent-specific payload ... }
    }

These schemas ensure:
  - Type safety across all inter-agent boundaries
  - Serializable, storable outputs (MongoDB-compatible)
  - Independent testability of each agent

NOTE: Schemas are intentionally strict. Agents MUST produce outputs
conforming to their declared schema — no untyped 'data' blobs.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel, Field, model_validator


# ── Enumerations ──────────────────────────────────────────────────────────────

class AgentStatus(str, Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
    SKIPPED = "SKIPPED"


class VerificationStatus(str, Enum):
    VERIFIED = "Verified"
    PARTIALLY_VERIFIED = "Partially Verified"
    UNSUPPORTED = "Unsupported"


class AblationMode(str, Enum):
    FULL_RAV = "full_rav"
    RAG_ONLY = "rag_only"
    PLAIN_LLM = "plain_llm"


class NodeType(str, Enum):
    CLASS = "Class"
    METHOD = "Method"
    PACKAGE = "Package"
    API = "API"
    CONFIGURATION = "Configuration"
    ENTITY = "Entity"
    REPOSITORY = "Repository"
    SERVICE = "Service"
    DATABASE_TABLE = "DatabaseTable"


class RelationshipType(str, Enum):
    CALLS = "CALLS"
    USES = "USES"
    DEPENDS_ON = "DEPENDS_ON"
    IMPLEMENTS = "IMPLEMENTS"
    EXTENDS = "EXTENDS"
    ANNOTATED_WITH = "ANNOTATED_WITH"
    MAPS_TO = "MAPS_TO"
    RETURNS = "RETURNS"


# ── Base agent envelope ───────────────────────────────────────────────────────

class AgentEnvelope(BaseModel):
    """
    Canonical JSON envelope for all inter-agent communication.
    The Orchestrator wraps every agent output in this format before
    passing it to the next agent or storing it in MongoDB.
    """
    projectId: str = Field(..., description="MongoDB ObjectId of the project")
    agent: str = Field(..., description="Name of the producing agent")
    status: AgentStatus
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    data: Dict[str, Any] = Field(default_factory=dict)
    error: Optional[str] = None


# ── SSKG Graph schemas ────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    """Represents a node in the Semantic Software Knowledge Graph."""
    node_id: str = Field(..., description="Unique node identifier (e.g., 'class:com.example.UserService')")
    node_type: NodeType
    name: str
    qualified_name: str = Field(..., description="Fully-qualified name (package.ClassName.methodName)")
    file_path: str
    start_line: int
    end_line: int
    metadata: Dict[str, Any] = Field(default_factory=dict)


class GraphEdge(BaseModel):
    """Represents a directed relationship (edge) in the SSKG."""
    source_id: str
    target_id: str
    relationship: RelationshipType
    metadata: Dict[str, Any] = Field(default_factory=dict)


class SSKGData(BaseModel):
    """Serialized Semantic Software Knowledge Graph."""
    nodes: List[GraphNode]
    edges: List[GraphEdge]
    node_count: int
    edge_count: int
    packages: List[str] = Field(default_factory=list)
    language: Optional[str] = None
    framework: Optional[str] = None
    framework_version: Optional[str] = None


# ── Agent-specific output schemas ─────────────────────────────────────────────

class PreprocessingOutput(BaseModel):
    extracted_path: str
    language: str = "unknown"
    framework: str = "unknown"
    framework_version: Optional[str] = None
    build_tool: Optional[str] = None
    tech_stack: str = "unknown"
    tech_confidence: float = 0.0
    source_files: List[str] = Field(default_factory=list)
    total_files: int = 0
    source_extensions: List[str] = Field(default_factory=list)
    excluded_files: List[str] = Field(default_factory=list)
    # Legacy compatibility aliases kept for backward compat
    java_files: List[str] = Field(default_factory=list)
    pom_xml_found: bool = False
    gradle_found: bool = False
    spring_boot_version: Optional[str] = None
    framework_detected: str = "unknown"


class ParsedClass(BaseModel):
    class_name: str
    qualified_name: str
    file_path: str
    start_line: int
    end_line: int
    package: str = ""
    language: str = "unknown"
    annotations: List[str] = Field(default_factory=list)
    implements: List[str] = Field(default_factory=list)
    extends: Optional[str] = None
    methods: List["ParsedMethod"] = Field(default_factory=list)
    fields: List["ParsedField"] = Field(default_factory=list)
    imports: List[str] = Field(default_factory=list)
    is_interface: bool = False
    is_abstract: bool = False
    is_enum: bool = False


class ParsedMethod(BaseModel):
    method_name: str
    qualified_name: str
    file_path: str
    start_line: int
    end_line: int
    return_type: str
    parameters: List[Dict[str, str]] = Field(default_factory=list)
    annotations: List[str] = Field(default_factory=list)
    modifiers: List[str] = Field(default_factory=list)
    calls: List[str] = Field(default_factory=list)
    is_endpoint: bool = False
    http_method: Optional[str] = None
    endpoint_path: Optional[str] = None


class ParsedField(BaseModel):
    field_name: str
    field_type: str
    annotations: List[str] = Field(default_factory=list)
    modifiers: List[str] = Field(default_factory=list)


class ParserOutput(BaseModel):
    classes: List[ParsedClass]
    total_classes: int
    total_methods: int
    total_endpoints: int
    total_packages: int
    packages: List[str]
    language: str = "unknown"
    framework: str = "unknown"
    ASTPerFile: List[Dict[str, Any]] = Field(default_factory=list)
    classIndex: List[Dict[str, Any]] = Field(default_factory=list)
    methodIndex: List[Dict[str, Any]] = Field(default_factory=list)
    annotationIndex: List[Dict[str, Any]] = Field(default_factory=list)


class RetrievalContext(BaseModel):
    """Retrieved subgraph context passed to the Reconstruction Agent."""
    query: str
    relevant_nodes: List[GraphNode]
    relevant_edges: List[GraphEdge]
    node_count: int
    edge_count: int
    retrieval_score: float = Field(ge=0.0, le=1.0)


class GeneratedStatement(BaseModel):
    """A single AI-generated claim before verification."""
    statement_id: str
    content: str
    statement_type: str  # e.g., 'architecture', 'api_doc', 'db_schema', 'module_doc'
    source_nodes: List[str] = Field(default_factory=list, description="Node IDs referenced")


class VerifiedStatement(BaseModel):
    """
    A verified AI-generated statement with evidence citations and confidence score.

    SCOPE CAVEAT: Verification checks consistency between generated output and
    the SSKG — it does NOT verify absolute semantic correctness of the underlying
    software. If the SSKG contains an extraction error, verification will confirm
    an internally consistent but externally wrong claim.
    """
    statement_id: str
    content: str
    statement_type: str
    verification_status: VerificationStatus
    # Deterministic confidence score — NOT LLM-generated
    # Formula: alpha * EvidenceMatch + beta * GraphConsistency + gamma * RetrievalCoverage
    confidence_score: float = Field(ge=0.0, le=1.0)
    # Evidence citations (mandatory for reproducibility)
    supporting_file: Optional[str] = None
    supporting_line_start: Optional[int] = None
    supporting_line_end: Optional[int] = None
    supporting_node_ids: List[str] = Field(default_factory=list)
    supporting_edge_ids: List[str] = Field(default_factory=list)


class EvaluationMetrics(BaseModel):
    """
    All evaluation metrics computed by the Evaluation Agent.
    Developer Trust Score is ingested from an external survey, not computed here.

    NOTE: These are design-goal metrics. Actual values are only valid after
    the system is tested on real labelled codebases across multiple tech stacks.
    """
    ablation_mode: AblationMode
    precision: Optional[float] = None
    recall: Optional[float] = None
    f1_score: Optional[float] = None
    hallucination_rate: Optional[float] = None
    evidence_citation_accuracy: Optional[float] = None
    verification_classification_accuracy: Optional[float] = None
    architecture_reconstruction_accuracy: Optional[float] = None
    api_detection_accuracy: Optional[float] = None
    software_knowledge_coverage: Optional[float] = None
    doc_drift_detection_accuracy: Optional[float] = None
    arch_drift_detection_accuracy: Optional[float] = None
    time_saved_minutes: Optional[float] = None
    # Developer Trust Score (from manual survey — ingested separately)
    developer_trust_score: Optional[float] = None
    raw_counts: Dict[str, int] = Field(default_factory=dict)
    ablation_table: List[Dict[str, Any]] = Field(default_factory=list)


# Forward reference resolution
ParsedClass.model_rebuild()
