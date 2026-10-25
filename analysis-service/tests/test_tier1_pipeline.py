"""
Integration and Unit Tests for Tier 1 RAV Pipeline Agents (Agents 1 - 8)

Run with:
    cd analysis-service
    .\\venv\\Scripts\\activate
    pytest tests/test_tier1_pipeline.py -v
"""

import pytest
from pathlib import Path
import sys

# Add analysis-service to sys.path
sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.parser_agent import run as run_parser
from agents.sskg_construction_agent import run as run_sskg
from agents.retrieval_agent import run as run_retrieval
from agents.reconstruction_agent import run as run_reconstruction
from agents.verification_agent import run as run_verification, calculate_confidence_score
from agents.evaluation_agent import run as run_evaluation
from core.schemas import AgentStatus, VerificationStatus, AblationMode


@pytest.fixture
def sample_java_project(tmp_path):
    """Create a sample Spring Boot Java project with Controller, Service, and Entity."""
    src = tmp_path / "src" / "main" / "java" / "com" / "example" / "demo"
    src.mkdir(parents=True)

    controller = src / "UserController.java"
    controller.write_text("""
package com.example.demo;

import org.springframework.web.bind.annotation.*;
import org.springframework.beans.factory.annotation.Autowired;

@RestController
@RequestMapping("/api/users")
public class UserController {
    @Autowired
    private UserService userService;

    @GetMapping("/{id}")
    public User getUser(@PathVariable("id") String id) {
        return userService.findById(id);
    }
}
""")

    service = src / "UserService.java"
    service.write_text("""
package com.example.demo;

import org.springframework.stereotype.Service;

@Service
public class UserService {
    public User findById(String id) {
        User u = new User();
        u.setId(id);
        return u;
    }
}
""")

    entity = src / "User.java"
    entity.write_text("""
package com.example.demo;

import javax.persistence.*;

@Entity
@Table(name = "users")
public class User {
    @Id
    private String id;
    private String name;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }
}
""")

    java_files = [
        "src/main/java/com/example/demo/UserController.java",
        "src/main/java/com/example/demo/UserService.java",
        "src/main/java/com/example/demo/User.java",
    ]
    return tmp_path, java_files


class TestTier1Pipeline:

    @pytest.mark.asyncio
    async def test_full_tier1_pipeline_execution(self, sample_java_project):
        tmp_path, java_files = sample_java_project
        project_id = "test-tier1-proj"

        # 1. Parser Agent
        parse_res = await run_parser(
            project_id=project_id,
            input_data={"extracted_path": str(tmp_path), "java_files": java_files},
        )
        assert parse_res.status == AgentStatus.SUCCESS
        assert parse_res.data["total_classes"] == 3
        assert parse_res.data["total_endpoints"] == 1

        # 2. SSKG Construction Agent
        sskg_res = await run_sskg(
            project_id=project_id,
            input_data=parse_res.data,
        )
        assert sskg_res.status == AgentStatus.SUCCESS
        assert sskg_res.data["node_count"] >= 3
        assert sskg_res.data["edge_count"] >= 2

        # 3. Retrieval Agent
        retrieval_res = await run_retrieval(
            project_id=project_id,
            input_data={
                "nodes": sskg_res.data["nodes"],
                "edges": sskg_res.data["edges"],
                "user_query": "user endpoint",
            },
        )
        assert retrieval_res.status == AgentStatus.SUCCESS
        assert retrieval_res.data["node_count"] > 0

        # 4. Reconstruction Agent
        reconstruction_res = await run_reconstruction(
            project_id=project_id,
            input_data={
                "relevant_nodes": retrieval_res.data["relevant_nodes"],
                "relevant_edges": retrieval_res.data["relevant_edges"],
                "ablation_mode": AblationMode.FULL_RAV.value,
            },
        )
        assert reconstruction_res.status == AgentStatus.SUCCESS
        assert len(reconstruction_res.data["statements"]) >= 1

        # 5. Verification Agent
        verification_res = await run_verification(
            project_id=project_id,
            input_data={
                "statements": reconstruction_res.data["statements"],
                "relevant_nodes": retrieval_res.data["relevant_nodes"],
                "relevant_edges": retrieval_res.data["relevant_edges"],
                "retrieval_score": retrieval_res.data["retrieval_score"],
            },
        )
        assert verification_res.status == AgentStatus.SUCCESS
        assert len(verification_res.data["verified_statements"]) >= 1

        # 6. Evaluation Agent
        evaluation_res = await run_evaluation(
            project_id=project_id,
            input_data={
                "ablation_mode": AblationMode.FULL_RAV.value,
                "verification_data": verification_res.data,
            },
        )
        assert evaluation_res.status == AgentStatus.SUCCESS
        assert evaluation_res.data["precision"] > 0.0
        assert evaluation_res.data["f1_score"] > 0.0

    def test_confidence_score_formula(self):
        # Formula: 0.5 * match + 0.3 * consistency + 0.2 * coverage
        score = calculate_confidence_score(
            evidence_match=1.0, graph_consistency=1.0, retrieval_coverage=1.0,
            alpha=0.5, beta=0.3, gamma=0.2
        )
        assert score == 1.0

        score_partial = calculate_confidence_score(
            evidence_match=0.5, graph_consistency=1.0, retrieval_coverage=0.8,
            alpha=0.5, beta=0.3, gamma=0.2
        )
        # 0.5*0.5 + 0.3*1.0 + 0.2*0.8 = 0.25 + 0.30 + 0.16 = 0.71
        assert score_partial == 0.71
