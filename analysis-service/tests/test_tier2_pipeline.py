"""
Unit and Integration Tests for Tier 2 Differentiator Agents (Agents 9 - 13)

Run with:
    cd analysis-service
    .\\venv\\Scripts\\activate
    pytest tests/test_tier2_pipeline.py -v
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.documentation_drift_agent import run as run_doc_drift
from agents.architecture_drift_agent import run as run_arch_drift
from agents.impact_analysis_agent import run as run_impact
from agents.architecture_health_agent import run as run_health, calculate_health_score
from agents.developer_memory_agent import run as run_memory
from core.schemas import AgentStatus


class TestTier2Pipeline:

    @pytest.mark.asyncio
    async def test_documentation_drift_agent(self):
        snap1 = [{"statement_id": "s1", "content": "Claim 1", "supporting_file": "src/Main.java"}]
        snap2 = [{"statement_id": "s2", "content": "Claim 2"}]
        res = await run_doc_drift(
            project_id="test-proj",
            input_data={
                "snapshot1_statements": snap1,
                "snapshot2_statements": snap2,
                "changed_files": ["src/Main.java"],
            },
        )
        assert res.status == AgentStatus.SUCCESS
        assert res.data["doc_drift_percentage"] > 0.0

    @pytest.mark.asyncio
    async def test_architecture_drift_agent(self):
        nodes1 = [{"node_id": "class:A"}, {"node_id": "class:B"}]
        nodes2 = [{"node_id": "class:A"}, {"node_id": "class:C"}]
        res = await run_arch_drift(
            project_id="test-proj",
            input_data={
                "snapshot1_nodes": nodes1,
                "snapshot2_nodes": nodes2,
            },
        )
        assert res.status == AgentStatus.SUCCESS
        assert res.data["arch_drift_percentage"] > 0.0
        assert len(res.data["added_nodes"]) == 1

    @pytest.mark.asyncio
    async def test_impact_analysis_agent(self):
        nodes = [
            {"node_id": "class:ServiceA", "node_type": "Service", "name": "ServiceA", "qualified_name": "ServiceA", "file_path": "A.java"},
            {"node_id": "class:ServiceB", "node_type": "Service", "name": "ServiceB", "qualified_name": "ServiceB", "file_path": "B.java"},
        ]
        edges = [{"source_id": "class:ServiceA", "target_id": "class:ServiceB", "relationship": "DEPENDS_ON"}]

        res = await run_impact(
            project_id="test-proj",
            input_data={"target_node_id": "class:ServiceB", "nodes": nodes, "edges": edges},
        )
        assert res.status == AgentStatus.SUCCESS
        assert res.data["blast_radius_count"] >= 1
        assert "risk_level" in res.data

    @pytest.mark.asyncio
    async def test_architecture_health_score_calculation(self):
        score = calculate_health_score(
            maintainability=0.8,
            coupling=0.2,
            cohesion=0.9,
            doc_coverage=0.85,
            drift_percentage=5.0,
            verification_confidence=0.9,
        )
        assert score > 70.0
        assert score <= 100.0

    @pytest.mark.asyncio
    async def test_developer_memory_agent_retrieve(self):
        res = await run_memory(
            project_id="test-proj",
            input_data={"action": "retrieve"},
        )
        assert res.status == AgentStatus.SUCCESS
        assert "memories_count" in res.data
