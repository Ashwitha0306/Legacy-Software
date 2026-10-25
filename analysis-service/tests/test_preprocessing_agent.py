"""
Unit tests for the Preprocessing Agent — Universal Language Support.

Tests run without MongoDB or Ollama — only file-system operations
and technology stack detection logic.

Run with:
    cd analysis-service
    venv\\Scripts\\activate
    pytest tests/test_preprocessing_agent.py -v
"""

import os
import pytest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from agents.preprocessing_agent import run
from core.schemas import AgentStatus
from core.tech_detector import detect as detect_tech_stack, find_source_files


@pytest.fixture
def spring_boot_project(tmp_path):
    """Create a minimal fake Spring Boot Maven project for testing."""
    pom = tmp_path / "pom.xml"
    pom.write_text("""
<project>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.2.1</version>
  </parent>
  <groupId>com.example</groupId>
  <artifactId>demo</artifactId>
</project>
""")

    src = tmp_path / "src" / "main" / "java" / "com" / "example"
    src.mkdir(parents=True)
    (src / "Application.java").write_text("@SpringBootApplication public class Application {}")
    (src / "UserService.java").write_text("@Service public class UserService {}")

    test_src = tmp_path / "src" / "test" / "java" / "com" / "example"
    test_src.mkdir(parents=True)
    (test_src / "ApplicationTest.java").write_text("public class ApplicationTest {}")

    target = tmp_path / "target"
    target.mkdir()
    (target / "demo.jar").write_bytes(b"PK\x03\x04")

    return tmp_path


@pytest.fixture
def python_project(tmp_path):
    """Create a minimal fake Python Django project for testing."""
    (tmp_path / "requirements.txt").write_text("django>=4.2\ndjango-rest-framework\n")
    (tmp_path / "manage.py").write_text("#!/usr/bin/env python\nimport django\n")
    app_dir = tmp_path / "myapp"
    app_dir.mkdir()
    (app_dir / "views.py").write_text("from django.views import View\n\nclass UserView(View):\n    pass\n")
    (app_dir / "models.py").write_text("from django.db import models\n\nclass User(models.Model):\n    name = models.CharField(max_length=100)\n")
    return tmp_path


@pytest.fixture
def node_project(tmp_path):
    """Create a minimal fake Node.js Express project for testing."""
    (tmp_path / "package.json").write_text('{"name":"api","dependencies":{"express":"^4.18.0"}}')
    src = tmp_path / "src"
    src.mkdir()
    (src / "app.js").write_text("const express = require('express');\nconst app = express();\napp.get('/users', (req, res) => res.json([]));\n")
    return tmp_path


class TestTechDetector:
    def test_detects_spring_boot(self, spring_boot_project):
        info = detect_tech_stack(spring_boot_project)
        assert info.language == "java"
        assert "spring" in info.framework
        assert info.tech_confidence >= 0.9

    def test_detects_python_django(self, python_project):
        info = detect_tech_stack(python_project)
        assert info.language == "python"
        assert info.framework == "django"
        assert ".py" in info.source_extensions

    def test_detects_nodejs_express(self, node_project):
        info = detect_tech_stack(node_project)
        assert info.language == "javascript"
        assert info.framework == "express"

    def test_unknown_fallback(self, tmp_path):
        info = detect_tech_stack(tmp_path)
        assert info.language == "unknown"
        assert info.tech_confidence <= 0.5


class TestFindSourceFiles:
    def test_finds_java_files(self, spring_boot_project):
        source_files, excluded = find_source_files(spring_boot_project, [".java"])
        java_names = [Path(f).name for f in source_files]
        assert "Application.java" in java_names
        assert "UserService.java" in java_names

    def test_excludes_compiled_artifacts(self, spring_boot_project):
        (spring_boot_project / "compiled_artifact.jar").write_bytes(b"PK\x03\x04")
        _, excluded = find_source_files(spring_boot_project, [".java"])
        excluded_names = [Path(f).name for f in excluded]
        assert "compiled_artifact.jar" in excluded_names

    def test_finds_python_files(self, python_project):
        source_files, _ = find_source_files(python_project, [".py"])
        py_names = [Path(f).name for f in source_files]
        assert "views.py" in py_names
        assert "models.py" in py_names

    def test_returns_sorted_list(self, spring_boot_project):
        source_files, _ = find_source_files(spring_boot_project, [".java"])
        assert source_files == sorted(source_files)


class TestPreprocessingAgentRun:
    @pytest.mark.asyncio
    async def test_spring_boot_run(self, spring_boot_project):
        result = await run(
            project_id="test-project-001",
            input_data={"extracted_path": str(spring_boot_project)},
        )
        assert result.status == AgentStatus.SUCCESS
        assert result.agent == "PreprocessingAgent"
        data = result.data
        assert data["language"] == "java"
        assert "spring" in data["framework"]
        assert data["pom_xml_found"] is True
        assert data["total_files"] >= 2
        assert len(data["source_files"]) >= 2

    @pytest.mark.asyncio
    async def test_python_django_run(self, python_project):
        result = await run(
            project_id="test-project-002",
            input_data={"extracted_path": str(python_project)},
        )
        assert result.status == AgentStatus.SUCCESS
        data = result.data
        assert data["language"] == "python"
        assert data["framework"] == "django"
        assert any(f.endswith(".py") for f in data["source_files"])

    @pytest.mark.asyncio
    async def test_node_express_run(self, node_project):
        result = await run(
            project_id="test-project-003",
            input_data={"extracted_path": str(node_project)},
        )
        assert result.status == AgentStatus.SUCCESS
        data = result.data
        assert data["language"] == "javascript"
        assert data["framework"] == "express"

    @pytest.mark.asyncio
    async def test_missing_path_raises_error(self):
        with pytest.raises(ValueError, match="extracted_path"):
            await run(project_id="test", input_data={})

    @pytest.mark.asyncio
    async def test_nonexistent_path_raises_error(self):
        with pytest.raises(ValueError):
            await run(
                project_id="test",
                input_data={"extracted_path": "/nonexistent/path/does/not/exist"},
            )
