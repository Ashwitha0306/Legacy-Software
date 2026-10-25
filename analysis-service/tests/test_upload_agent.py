"""
Unit tests for Agent 1 — Project Upload Agent (Universal Language Support)
"""

import pytest
from pathlib import Path
from agents.upload_agent import run as run_upload
from core.tech_detector import detect as detect_tech_stack


@pytest.mark.asyncio
async def test_upload_agent_java_spring_boot(tmp_path):
    """Test upload agent correctly detects Java Spring Boot projects."""
    project_dir = tmp_path / "sample_spring_project"
    project_dir.mkdir()

    pom_xml = project_dir / "pom.xml"
    pom_xml.write_text(
        "<project><dependencies><dependency>"
        "<groupId>org.springframework.boot</groupId>"
        "<artifactId>spring-boot-starter-web</artifactId>"
        "</dependency></dependencies></project>",
        encoding="utf-8"
    )

    src_dir = project_dir / "src" / "main" / "java" / "com" / "example"
    src_dir.mkdir(parents=True)
    (src_dir / "Application.java").write_text(
        "package com.example;\n\n@SpringBootApplication\npublic class Application {}\n",
        encoding="utf-8"
    )

    doc_file = tmp_path / "api_spec.yaml"
    doc_file.write_text("openapi: 3.0.0\ninfo:\n  title: Test API\n", encoding="utf-8")

    input_data = {
        "source_type": "zip",
        "extracted_path": str(project_dir),
        "project_name": "Spring Boot Test Project",
        "snapshot_id": "snapshotA",
        "doc_files": [str(doc_file)],
    }

    result = await run_upload("proj-001", input_data)
    assert result.status.value == "SUCCESS"
    data = result.data
    assert data["projectId"] == "proj-001"
    assert data["snapshotId"] == "snapshotA"
    assert data["language"] == "java"
    assert "spring" in data["framework"]
    assert data["is_spring_boot"] is True
    assert len(data["docsAssetIds"]) == 1


@pytest.mark.asyncio
async def test_upload_agent_python_project(tmp_path):
    """Test upload agent correctly detects Python projects."""
    project_dir = tmp_path / "python_project"
    project_dir.mkdir()

    (project_dir / "requirements.txt").write_text("django>=4.2\ndjango-rest-framework\n", encoding="utf-8")
    (project_dir / "manage.py").write_text("#!/usr/bin/env python\nimport django\n", encoding="utf-8")

    input_data = {
        "source_type": "zip",
        "extracted_path": str(project_dir),
        "project_name": "Django Test Project",
        "snapshot_id": "snapshotA",
    }

    result = await run_upload("proj-002", input_data)
    assert result.status.value == "SUCCESS"
    data = result.data
    assert data["language"] == "python"
    assert data["framework"] == "django"
    assert data["is_spring_boot"] is False


@pytest.mark.asyncio
async def test_upload_agent_node_project(tmp_path):
    """Test upload agent correctly detects Node.js projects."""
    project_dir = tmp_path / "node_project"
    project_dir.mkdir()

    (project_dir / "package.json").write_text(
        '{"name":"myapp","dependencies":{"express":"^4.18.0"}}',
        encoding="utf-8"
    )

    input_data = {
        "source_type": "zip",
        "extracted_path": str(project_dir),
        "project_name": "Express Test Project",
        "snapshot_id": "snapshotA",
    }

    result = await run_upload("proj-003", input_data)
    assert result.status.value == "SUCCESS"
    data = result.data
    assert data["language"] == "javascript"
    assert data["framework"] == "express"


@pytest.mark.asyncio
async def test_upload_agent_second_snapshot(tmp_path):
    """Test upload agent supports snapshotB for drift analysis."""
    project_dir = tmp_path / "v2_project"
    project_dir.mkdir()
    (project_dir / "build.gradle").write_text(
        "dependencies { implementation 'org.springframework.boot:spring-boot-starter-web' }",
        encoding="utf-8"
    )

    input_data = {
        "source_type": "zip",
        "extracted_path": str(project_dir),
        "project_name": "Test Project V2",
        "snapshot_id": "snapshotB",
    }

    result = await run_upload("proj-004", input_data)
    assert result.status.value == "SUCCESS"
    assert result.data["snapshotId"] == "snapshotB"


def test_tech_detector_java(tmp_path):
    """Unit test tech_detector for Java Spring Boot."""
    (tmp_path / "pom.xml").write_text(
        "<project><dependencies>"
        "<groupId>org.springframework.boot</groupId>"
        "</dependencies></project>",
        encoding="utf-8"
    )
    info = detect_tech_stack(tmp_path)
    assert info.language == "java"
    assert "spring" in info.framework


def test_tech_detector_python(tmp_path):
    """Unit test tech_detector for Python Django."""
    (tmp_path / "requirements.txt").write_text("django==4.2.1\n", encoding="utf-8")
    info = detect_tech_stack(tmp_path)
    assert info.language == "python"
    assert info.framework == "django"


def test_tech_detector_node(tmp_path):
    """Unit test tech_detector for Node.js Express."""
    (tmp_path / "package.json").write_text(
        '{"name":"api","dependencies":{"express":"4.18"}}',
        encoding="utf-8"
    )
    info = detect_tech_stack(tmp_path)
    assert info.language == "javascript"
    assert info.framework == "express"


def test_tech_detector_go(tmp_path):
    """Unit test tech_detector for Go Gin."""
    (tmp_path / "go.mod").write_text(
        "module myapp\ngo 1.21\nrequire github.com/gin-gonic/gin v1.9.1\n",
        encoding="utf-8"
    )
    info = detect_tech_stack(tmp_path)
    assert info.language == "go"
    assert info.framework == "gin"


def test_tech_detector_unknown(tmp_path):
    """Tech detector returns unknown fallback for empty directories."""
    info = detect_tech_stack(tmp_path)
    assert info.language == "unknown"
