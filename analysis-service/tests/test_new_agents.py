"""
Unit tests for Agent 3 (LegacyDocAgent), DiagramAgent, and ConversationalQueryAgent
"""

import pytest
from pathlib import Path
from agents.legacy_doc_agent import run as run_legacy_doc, parse_document_file, link_passages_and_cross_reference
from agents.diagram_agent import run as run_diagrams
from agents.conversational_query_agent import run as run_conv_query


@pytest.mark.asyncio
async def test_legacy_doc_agent_phase_a_and_b(tmp_path):
    # Create Markdown doc
    doc_file = tmp_path / "spec.md"
    doc_file.write_text("# Payment Service\nThis section describes PaymentService and OrderService.", encoding="utf-8")

    # Create OpenAPI spec file
    openapi_file = tmp_path / "swagger.yaml"
    openapi_file.write_text("""
openapi: 3.0.0
info:
  title: User API
paths:
  /api/v1/users:
    get:
      summary: List users
  /api/v1/users/{id}:
    delete:
      summary: Delete user
""", encoding="utf-8")

    # Phase A: Parsing
    parse_env = await run_legacy_doc(
        "proj-123",
        {
            "phase": "parse",
            "doc_paths": [str(doc_file), str(openapi_file)],
        }
    )

    assert parse_env.status.value == "SUCCESS"
    assert parse_env.data["total_passages"] == 3  # 1 section + 2 openapi endpoints

    passages = parse_env.data["passages"]

    # Phase B: Linking & OpenAPI mismatch cross-referencing
    nodes = [
        {"node_id": "Class:PaymentService", "name": "PaymentService", "node_type": "Class"},
        {
            "node_id": "API:GET/api/v1/users",
            "name": "GET /api/v1/users",
            "node_type": "API",
            "metadata": {"http_method": "GET", "path": "/api/v1/users"}
        },
        {
            "node_id": "API:POST/api/v1/orders",
            "name": "POST /api/v1/orders",
            "node_type": "API",
            "metadata": {"http_method": "POST", "path": "/api/v1/orders"}
        },
    ]

    link_env = await run_legacy_doc(
        "proj-123",
        {
            "phase": "link",
            "existing_passages": passages,
            "sskg_nodes": nodes,
        }
    )

    assert link_env.status.value == "SUCCESS"
    assert link_env.data["linked_count"] >= 1

    mismatches = link_env.data["swagger_mismatches"]
    assert len(mismatches["documented_but_missing"]) >= 1  # DELETE /api/v1/users/{id} in Swagger, not in code
    assert len(mismatches["undocumented_but_present"]) >= 1  # POST /api/v1/orders in code, not in Swagger


@pytest.mark.asyncio
async def test_diagram_agent():
    nodes = [
        {"node_id": "Class:OrderService", "name": "OrderService", "node_type": "Class"},
        {"node_id": "Class:PaymentService", "name": "PaymentService", "node_type": "Class"},
    ]
    edges = [
        {"source_id": "Class:OrderService", "target_id": "Class:PaymentService", "relationship": "CALLS"},
    ]

    diag_env = await run_diagrams("proj-123", {"nodes": nodes, "edges": edges})
    assert diag_env.status.value == "SUCCESS"
    assert "class_diagram" in diag_env.data["diagrams"]
    assert "sequence_diagram" in diag_env.data["diagrams"]


@pytest.mark.asyncio
async def test_conversational_query_agent():
    nodes = [
        {"node_id": "Class:PaymentService", "name": "PaymentService", "node_type": "Class", "file_path": "com/app/PaymentService.java"},
    ]
    edges = []

    query_env = await run_conv_query(
        "proj-123",
        {
            "query": "PaymentService details",
            "nodes": nodes,
            "edges": edges,
        }
    )

    assert query_env.status.value == "SUCCESS"
    assert query_env.data["relevant_files"] == ["com/app/PaymentService.java"]
