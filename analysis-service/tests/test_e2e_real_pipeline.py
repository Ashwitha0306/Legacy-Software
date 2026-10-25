"""
End-to-End Integration Test for Grounded Multi-Agent RAV Pipeline (11-Agent Specification)

Validates the full pipeline sequentially on a realistic Java Spring Boot legacy codebase:
  1. ProjectUploadAgent (ZIP / pom.xml / OpenAPI docs / Markdown)
  2. PreprocessingAgent (Source file discovery & tech stack detection)
  3. LegacyDocAgent Phase A (OpenAPI + Markdown text extraction)
  4. ParserAgent (Tree-sitter AST extraction: Classes, Methods, Annotations, Endpoints)
  5. SSKGConstructionAgent (NetworkX typed graph construction)
  6. LegacyDocAgent Phase B (Passage-to-SSKG node linking & Swagger mismatch detection)
  7. DiagramAgent (Deterministic Mermaid & SVG diagram generation)
  8. RetrievalAgent (SSKG subgraph retrieval for user query)
  9. ReconstructionAgent (LLM Grounded Generation from SSKG context)
  10. VerificationAgent (Deterministic confidence scores + line citations)
  11. ConversationalQueryAgent (Scoped Q&A with workflow explanation & citations)
  12. EvaluationAgent (Ablation study metrics & ground truth evaluation)
"""

import pytest
from pathlib import Path
import sys

from core.orchestrator import Orchestrator
from core.schemas import AblationMode


@pytest.fixture
def real_spring_boot_project(tmp_path):
    """
    Constructs a complete multi-tier Java Spring Boot legacy project
    with Controllers, Services, Repositories, Entities, and OpenAPI specs.
    """
    proj_dir = tmp_path / "legacy_spring_project"
    proj_dir.mkdir()

    # 1. pom.xml
    (proj_dir / "pom.xml").write_text("""<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.legacy.enterprise</groupId>
    <artifactId>account-management-service</artifactId>
    <version>2.4.1</version>
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-data-jpa</artifactId>
        </dependency>
    </dependencies>
</project>""", encoding="utf-8")

    # 2. Legacy Documentation
    doc_dir = proj_dir / "docs"
    doc_dir.mkdir()
    (doc_dir / "architecture.md").write_text("""# Account Management Service Architecture
This service manages enterprise user profiles and financial ledger transactions.
The `UserController` handles REST requests and delegates to `UserService`.
The `AccountService` processes debit and credit transfers with transactional locking.
Entities are mapped to PostgreSQL tables `tbl_users` and `tbl_accounts`.
""", encoding="utf-8")

    (doc_dir / "openapi.yaml").write_text("""openapi: 3.0.0
info:
  title: Account Management API
  version: 2.4.1
paths:
  /api/v1/users/{id}:
    get:
      summary: Retrieve user by ID
      parameters:
        - name: id
          in: path
          required: true
  /api/v1/users:
    post:
      summary: Register a new enterprise user
  /api/v1/legacy/export:
    get:
      summary: Documented in spec but deprecated/missing in source code
""", encoding="utf-8")

    # 3. Java Source Code Files
    src_dir = proj_dir / "src" / "main" / "java" / "com" / "legacy" / "enterprise"
    src_dir.mkdir(parents=True)

    # User Entity
    (src_dir / "User.java").write_text("""package com.legacy.enterprise;

import javax.persistence.Entity;
import javax.persistence.Table;
import javax.persistence.Id;
import javax.persistence.Column;

@Entity
@Table(name = "tbl_users")
public class User {
    @Id
    private Long id;
    
    @Column(name = "username", nullable = false)
    private String username;
    
    @Column(name = "email")
    private String email;

    public Long getId() { return id; }
    public String getUsername() { return username; }
}
""", encoding="utf-8")

    # User Repository
    (src_dir / "UserRepository.java").write_text("""package com.legacy.enterprise;

import org.springframework.stereotype.Repository;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
}
""", encoding="utf-8")

    # User Service
    (src_dir / "UserService.java").write_text("""package com.legacy.enterprise;

import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Autowired;
import java.util.Optional;

@Service
public class UserService {
    @Autowired
    private UserRepository userRepository;

    public User getUserById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    public User createUser(User user) {
        return userRepository.save(user);
    }
}
""", encoding="utf-8")

    # User Controller
    (src_dir / "UserController.java").write_text("""package com.legacy.enterprise;

import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public User getUser(@PathVariable("id") Long id) {
        return userService.getUserById(id);
    }

    @PostMapping("")
    public User createUser(@RequestBody User user) {
        return userService.createUser(user);
    }

    @GetMapping("/active")
    public String getActiveUsers() {
        return "active";
    }
}
""", encoding="utf-8")

    return {
        "project_dir": proj_dir,
        "doc_files": [str(doc_dir / "architecture.md"), str(doc_dir / "openapi.yaml")],
    }


@pytest.mark.asyncio
async def test_full_11_agent_e2e_pipeline_execution(real_spring_boot_project, monkeypatch):
    """
    Executes the full 11-agent pipeline end-to-end and validates every agent's output.
    """
    # Prevent direct DB writes during unit/e2e test run if MongoDB is not mocked
    async def mock_update_db(self, payload, parse_data, sskg_data, eval_data):
        pass
    monkeypatch.setattr(Orchestrator, "_update_database_records", mock_update_db)

    project_id = "test-project-spring-boot-001"
    run_id = "test-run-e2e-001"

    orchestrator = Orchestrator(
        project_id=project_id,
        run_id=run_id,
        ablation_mode=AblationMode.FULL_RAV,
    )

    input_data = {
        "source_type": "zip",
        "extracted_path": str(real_spring_boot_project["project_dir"]),
        "project_name": "Account Management Service",
        "snapshot_id": "snap-initial",
        "doc_files": real_spring_boot_project["doc_files"],
        "user_query": "How does user creation work and what database table is affected?",
    }

    result = await orchestrator.run(input_data)

    # ── 1. Pipeline Top-Level Validation ──────────────────────────────────────
    assert result["status"] == "completed"
    assert result["projectId"] == project_id
    assert result["runId"] == run_id
    assert result["ablationMode"] == "full_rav"
    assert result["durationMs"] > 0
    assert len(result["executionLog"]) >= 10

    results = result["results"]

    # ── 2. Agent 1: ProjectUploadAgent ────────────────────────────────────────
    upload_res = results["upload"]
    assert upload_res["status"] == "SUCCESS"
    upload_data = upload_res["data"]
    assert upload_data["language"] == "java"
    assert "spring" in upload_data["framework"].lower()
    assert upload_data["is_spring_boot"] is True
    assert len(upload_data["docsAssetIds"]) >= 1

    # ── 3. Agent 2: PreprocessingAgent ────────────────────────────────────────
    preprocess_res = results["preprocessing"]
    assert preprocess_res["status"] == "SUCCESS"
    prep_data = preprocess_res["data"]
    assert len(prep_data["source_files"]) >= 4
    # Ensure all Java files are identified
    file_names = [Path(f).name for f in prep_data["source_files"]]
    assert "UserController.java" in file_names
    assert "UserService.java" in file_names
    assert "UserRepository.java" in file_names
    assert "User.java" in file_names

    # ── 4. Agent 3A: LegacyDocAgent (Parse) ────────────────────────────────────
    doc_parse_res = results["legacyDocParse"]
    assert doc_parse_res["status"] == "SUCCESS"
    passages = doc_parse_res["data"]["passages"]
    assert len(passages) >= 2
    # Check that OpenAPI endpoints were parsed into structured passages
    openapi_passages = [p for p in passages if "API Endpoint" in p.get("sectionTitle", "")]
    assert len(openapi_passages) >= 2

    # ── 5. Agent 4: ParserAgent (Tree-sitter AST) ─────────────────────────────
    parse_res = results["parsing"]
    assert parse_res["status"] == "SUCCESS"
    parse_data = parse_res["data"]
    assert parse_data["total_classes"] >= 4
    assert parse_data["total_methods"] >= 4
    assert parse_data["total_endpoints"] >= 3  # /api/v1/users/{id}, /api/v1/users, /api/v1/users/active

    class_names = [c["class_name"] for c in parse_data["classes"]]
    assert "UserController" in class_names
    assert "UserService" in class_names
    assert "UserRepository" in class_names
    assert "User" in class_names

    # ── 6. Agent 5: SSKGConstructionAgent ─────────────────────────────────────
    sskg_res = results["graphConstruction"]
    assert sskg_res["status"] == "SUCCESS"
    sskg_data = sskg_res["data"]
    assert sskg_data["node_count"] >= 4
    assert sskg_data["edge_count"] >= 3

    node_types = {n["node_type"] for n in sskg_data["nodes"]}
    assert "Class" in node_types or "Service" in node_types or "API" in node_types

    edge_rels = {e["relationship"] for e in sskg_data["edges"]}
    assert len(edge_rels) >= 1

    # ── 7. Agent 3B: LegacyDocAgent (Link) ────────────────────────────────────
    doc_link_res = results["legacyDocLink"]
    assert doc_link_res["status"] == "SUCCESS"
    linked_passages = doc_link_res["data"]["passages"]
    assert len(linked_passages) >= 1
    # Check Swagger mismatch detection bonus signal
    mismatches = doc_link_res["data"].get("swagger_mismatches", {})
    # /api/v1/legacy/export was in yaml but not in java code
    documented_but_missing = [m["path"] for m in mismatches.get("documented_but_missing", [])]
    assert any("/api/v1/legacy/export" in p for p in documented_but_missing)
    # /api/v1/users/active was in java code but not in openapi yaml
    undocumented = [u["path"] for u in mismatches.get("undocumented_but_present", [])]
    assert any("active" in p for p in undocumented)

    # ── 8. Agent 6: DiagramAgent ──────────────────────────────────────────────
    diagram_res = results["diagrams"]
    assert diagram_res["status"] == "SUCCESS"
    diagrams = diagram_res["data"]["diagrams"]
    assert "class_diagram" in diagrams
    assert "package_diagram" in diagrams
    assert "sequence_diagram" in diagrams
    assert "<svg" in diagrams["class_diagram"]["svg"]
    assert "classDiagram" in diagrams["class_diagram"]["mermaid"]

    # ── 9. Agent 7: RetrievalAgent ────────────────────────────────────────────
    retrieval_res = results["retrieval"]
    assert retrieval_res["status"] == "SUCCESS"
    retrieval_data = retrieval_res["data"]
    assert len(retrieval_data["relevant_nodes"]) >= 1
    assert retrieval_data["retrieval_score"] > 0.0

    # ── 10. Agent 8: ReconstructionAgent ──────────────────────────────────────
    reconstruct_res = results["reconstruction"]
    assert reconstruct_res["status"] == "SUCCESS"
    statements = reconstruct_res["data"]["statements"]
    assert len(statements) >= 1
    stmt_types = {s["statement_type"] for s in statements}
    assert "architecture" in stmt_types or "api_doc" in stmt_types

    # ── 11. Agent 9: VerificationAgent ────────────────────────────────────────
    verify_res = results["verification"]
    assert verify_res["status"] == "SUCCESS"
    verified_stmts = verify_res["data"]["verified_statements"]
    assert len(verified_stmts) == len(statements)
    for v in verified_stmts:
        # Confidence score must be computed deterministically between 0.0 and 1.0
        assert 0.0 <= v["confidence_score"] <= 1.0
        status_val = v["verification_status"].value if hasattr(v["verification_status"], "value") else str(v["verification_status"])
        assert status_val in ("Verified", "Partially Verified", "Unsupported", "VERIFIED", "PARTIALLY_VERIFIED", "UNSUPPORTED")

    # ── 12. Agent 10: ConversationalQueryAgent ────────────────────────────────
    assert "conversationalQuery" in results
    conv_res = results["conversationalQuery"]
    assert conv_res["status"] == "SUCCESS"
    conv_data = conv_res["data"]
    assert conv_data["query"] == input_data["user_query"]
    assert len(conv_data["workflow_explanation"]) > 20
    assert len(conv_data["relevant_files"]) >= 1

    # ── 13. Agent 11: EvaluationAgent ─────────────────────────────────────────
    eval_res = results["evaluation"]
    assert eval_res["status"] == "SUCCESS"
    eval_data = eval_res["data"]
    assert 0.0 <= eval_data["precision"] <= 1.0
    assert 0.0 <= eval_data["recall"] <= 1.0
    assert 0.0 <= eval_data["f1_score"] <= 1.0
    assert 0.0 <= eval_data["hallucination_rate"] <= 1.0
    assert eval_data["ablation_mode"] == "full_rav"
    assert eval_data["time_saved_minutes"] > 0
