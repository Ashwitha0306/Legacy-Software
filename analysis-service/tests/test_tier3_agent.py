"""
Unit Test Suite for Agent 14 (Refactoring Simulation Agent)

Run with:
    cd analysis-service
    .\\venv\\Scripts\\activate
    pytest tests/test_tier3_agent.py -v
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.refactoring_simulation_agent import run as run_refactoring, _calculate_cbo, _calculate_lcom
from graph.sskg import SSKGManager
from core.schemas import AgentStatus, NodeType, RelationshipType


class TestTier3RefactoringAgent:

    @pytest.mark.asyncio
    async def test_refactoring_simulation_agent_run(self):
        nodes = [
            {"node_id": "class:UserService", "node_type": "Service", "name": "UserService", "qualified_name": "com.example.UserService", "file_path": "UserService.java"},
            {"node_id": "class:UserRepository", "node_type": "Repository", "name": "UserRepository", "qualified_name": "com.example.UserRepository", "file_path": "UserRepository.java"},
        ]
        edges = [
            {"source_id": "class:UserService", "target_id": "class:UserRepository", "relationship": "USES"}
        ]

        res = await run_refactoring(
            project_id="test-refactor-proj",
            input_data={
                "proposed_action": "extract_service",
                "target_class_name": "UserService",
                "nodes": nodes,
                "edges": edges,
            },
        )

        assert res.status == AgentStatus.SUCCESS
        assert "delta_cbo" in res.data
        assert "delta_lcom" in res.data
        assert res.data["recommendation"] in ("IMPROVES_QUALITY", "DEGRADES_QUALITY", "NEUTRAL")

    def test_cbo_and_lcom_calculation(self):
        manager = SSKGManager("test")
        manager.add_node("class:A", NodeType.CLASS, "A", "A", "A.java")
        manager.add_node("class:B", NodeType.CLASS, "B", "B", "B.java")
        manager.add_edge("class:A", "class:B", RelationshipType.USES)

        cbo = _calculate_cbo(manager)
        lcom = _calculate_lcom(manager)

        assert cbo >= 0.5
        assert lcom >= 0.0
