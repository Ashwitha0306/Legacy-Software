"""
Unit tests for UML Diagram Generator (Class, Sequence, Component, ER diagrams)

Run with:
    cd analysis-service
    .\\venv\\Scripts\\activate
    pytest tests/test_uml_generator.py -v
"""

import pytest
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))

from core.schemas import ParsedClass, ParsedMethod, ParsedField
from core.uml_generator import (
    generate_class_diagram,
    generate_class_svg,
    generate_sequence_diagram,
    generate_sequence_svg,
    generate_component_diagram,
    generate_component_svg,
    generate_er_diagram,
    generate_use_case_diagram,
    generate_use_case_svg,
    generate_activity_diagram,
    generate_activity_svg,
    generate_deployment_diagram,
    generate_deployment_svg,
    generate_package_diagram,
    generate_package_svg,
    generate_all_uml_diagrams,
)


@pytest.fixture
def sample_parsed_classes():
    return [
        ParsedClass(
            class_name="UserController",
            qualified_name="com.example.demo.UserController",
            file_path="src/main/java/com/example/demo/UserController.java",
            start_line=1,
            end_line=20,
            annotations=["RestController", "RequestMapping(\"/api/users\")"],
            methods=[
                ParsedMethod(
                    method_name="getUser",
                    qualified_name="com.example.demo.UserController.getUser",
                    file_path="src/main/java/com/example/demo/UserController.java",
                    start_line=10,
                    end_line=15,
                    return_type="User",
                    parameters=[{"name": "id", "type": "String"}],
                    modifiers=["public"],
                    annotations=["GetMapping(\"/{id}\")"],
                    is_endpoint=True,
                    http_method="GET",
                    endpoint_path="/api/users/{id}",
                )
            ],
            fields=[
                ParsedField(
                    field_name="userService",
                    field_type="UserService",
                    annotations=["Autowired"],
                    modifiers=["private"],
                )
            ],
        ),
        ParsedClass(
            class_name="UserService",
            qualified_name="com.example.demo.UserService",
            file_path="src/main/java/com/example/demo/UserService.java",
            start_line=1,
            end_line=25,
            annotations=["Service"],
            methods=[
                ParsedMethod(
                    method_name="getUser",
                    qualified_name="com.example.demo.UserService.getUser",
                    file_path="src/main/java/com/example/demo/UserService.java",
                    start_line=8,
                    end_line=12,
                    return_type="User",
                    parameters=[{"name": "id", "type": "String"}],
                    modifiers=["public"],
                    annotations=[],
                )
            ],
            fields=[
                ParsedField(
                    field_name="userRepository",
                    field_type="UserRepository",
                    annotations=["Autowired"],
                    modifiers=["private"],
                )
            ],
        ),
        ParsedClass(
            class_name="User",
            qualified_name="com.example.demo.User",
            file_path="src/main/java/com/example/demo/User.java",
            start_line=1,
            end_line=30,
            annotations=["Entity", "Table(name=\"users\")"],
            methods=[],
            fields=[
                ParsedField(
                    field_name="id",
                    field_type="String",
                    annotations=["Id"],
                    modifiers=["private"],
                ),
                ParsedField(
                    field_name="name",
                    field_type="String",
                    annotations=[],
                    modifiers=["private"],
                ),
            ],
        ),
    ]


def test_generate_class_diagram(sample_parsed_classes):
    cd = generate_class_diagram(sample_parsed_classes)
    assert "classDiagram" in cd
    assert "UserController" in cd
    assert "UserService" in cd
    assert "User" in cd
    assert "+getUser(id) User" in cd or "+getUser(id)" in cd


def test_generate_sequence_diagram(sample_parsed_classes):
    sd = generate_sequence_diagram(sample_parsed_classes)
    assert "sequenceDiagram" in sd
    assert "Client" in sd
    assert "Controller" in sd
    assert "Service" in sd
    assert "Repository" in sd
    assert "Database" in sd
    assert "GET /api/users/{id}" in sd


def test_generate_component_diagram(sample_parsed_classes):
    comp = generate_component_diagram(sample_parsed_classes)
    assert "flowchart TB" in comp
    assert "Presentation Layer" in comp
    assert "Business Logic Layer" in comp
    assert "Persistence Layer" in comp
    assert "UserController" in comp
    assert "UserService" in comp

    svg = generate_component_svg(sample_parsed_classes, project_name="OnlineStore")
    assert "<svg" in svg
    assert "OnlineStore" in svg
    assert "&lt;&lt;Component&gt;&gt;" in svg
    assert "&lt;&lt;delegate&gt;&gt;" in svg
    assert "fill=\"#b36b1d\"" in svg


def test_generate_sequence_svg_structure(sample_parsed_classes):
    svg = generate_sequence_svg(sample_parsed_classes, project_name="EmotionLearning")
    assert "<svg" in svg
    assert "User" in svg
    assert "Database" in svg
    assert "fill=\"#d9f2d9\"" in svg
    assert "1:" in svg
    assert "2:" in svg
    assert "10:" in svg


def test_generate_er_diagram(sample_parsed_classes):
    er = generate_er_diagram(sample_parsed_classes)
    assert "erDiagram" in er
    assert "User" in er
    assert "String id PK" in er or "id" in er


def test_generate_all_uml_diagrams(sample_parsed_classes):
    diagrams = generate_all_uml_diagrams(sample_parsed_classes)
    assert "use_case_diagram" in diagrams
    assert "activity_diagram" in diagrams
    assert "class_diagram" in diagrams
    assert "sequence_diagram" in diagrams
    assert "component_diagram" in diagrams
    assert "deployment_diagram" in diagrams
    assert "package_diagram" in diagrams
    assert "er_diagram" in diagrams


def test_generate_use_case_svg(sample_parsed_classes):
    svg = generate_use_case_svg(sample_parsed_classes, project_name="Restaurant")
    assert "<svg" in svg
    assert "uc Restaurant Use Cases" in svg
    assert "System Boundary" in svg
    assert "peachGrad" in svg
    assert "openArrow" in svg
    assert "&lt;&lt;extend&gt;&gt;" in svg or "<<extend>>" in svg
    # Stick figure elements
    assert "<circle" in svg
    assert "<line" in svg
    assert "<ellipse" in svg


def test_generate_use_case_diagram(sample_parsed_classes):
    uc = generate_use_case_diagram(sample_parsed_classes, project_name="Restaurant")
    assert "flowchart LR" in uc
    assert "System_Boundary" in uc
    assert "<<extend>>" in uc


def test_generate_activity_diagram(sample_parsed_classes):
    act = generate_activity_diagram(sample_parsed_classes)
    assert "flowchart TD" in act
    assert "Start" in act
    assert "Fork" in act
    assert "Join" in act

    svg = generate_activity_svg(sample_parsed_classes)
    assert "<svg" in svg
    assert "Request" in svg or "Action" in svg or "Completed" in svg or "Receive Order" in svg

    svg_resume = generate_activity_svg(sample_parsed_classes, project_name="ResumePlatform")
    assert "<svg" in svg_resume
    assert "Resume" in svg_resume or "Candidate" in svg_resume or "Dossier" in svg_resume

def test_generate_deployment_diagram(sample_parsed_classes):
    dep = generate_deployment_diagram(sample_parsed_classes)
    assert "flowchart TB" in dep
    assert "Client" in dep
    assert "App" in dep

    svg = generate_deployment_svg(sample_parsed_classes)
    assert "<svg" in svg
    assert "Caching Server" in svg or "Internet" in svg


def test_generate_package_diagram(sample_parsed_classes):
    pkg = generate_package_diagram(sample_parsed_classes)
    assert "flowchart TB" in pkg
    assert "package" in pkg

    svg = generate_package_svg(sample_parsed_classes)
    assert "<svg" in svg
    assert "Package Diagram" in svg


def test_sparse_evidence_diagrams():
    """Verify all 7 generators handle sparse/empty project inputs gracefully without errors."""
    empty_classes = []
    all_diags = generate_all_uml_diagrams(empty_classes, project_name="EmptyProject")
    assert len(all_diags) >= 7
    for key, diag in all_diags.items():
        assert "mermaid" in diag
        assert diag["mermaid"] is not None
        assert len(diag["mermaid"]) > 0


def test_unusual_identifiers_and_polyglot_python():
    """Verify UML generators handle special characters and Python FastAPI classes cleanly."""
    polyglot_classes = [
        ParsedClass(
            class_name="User_Service<Data, List[Item]>",
            qualified_name="app.services.User_Service",
            file_path="app/services/user_service.py",
            start_line=1,
            end_line=30,
            language="python",
            package="app.services",
            methods=[
                ParsedMethod(
                    method_name="predict_emotion",
                    qualified_name="app.services.User_Service.predict_emotion",
                    file_path="app/services/user_service.py",
                    start_line=10,
                    end_line=20,
                    return_type="Dict[str, float]",
                    is_endpoint=True,
                    http_method="POST",
                    endpoint_path="/api/v1/predict/emotion",
                )
            ],
            fields=[
                ParsedField(
                    field_name="db_session",
                    field_type="Session",
                )
            ]
        )
    ]

    all_diags = generate_all_uml_diagrams(polyglot_classes, project_name="EmotionLearning")
    assert "classDiagram" in all_diags["class_diagram"]["mermaid"]
    assert "sequenceDiagram" in all_diags["sequence_diagram"]["mermaid"]
    assert "flowchart TB" in all_diags["deployment_diagram"]["mermaid"]
    assert "FastAPI" in all_diags["deployment_diagram"]["mermaid"] or "Uvicorn" in all_diags["deployment_diagram"]["mermaid"]
    assert "flowchart TB" in all_diags["package_diagram"]["mermaid"]
    assert "app.services" in all_diags["package_diagram"]["mermaid"]


def test_employee_management_domain_classification():
    """Verify Employee Management System is correctly classified and NOT misidentified as food/pizza."""
    from core.uml_generator import analyze_project_domain

    emp_classes = [
        ParsedClass(
            class_name="EmployeeController",
            qualified_name="backend.controllers.EmployeeController",
            file_path="backend/controllers/employeeController.js",
            start_line=1,
            end_line=50,
            methods=[ParsedMethod(method_name="getEmployees", return_type="Promise<any>", qualified_name="EmployeeController.getEmployees", file_path="backend/controllers/employeeController.js", start_line=5, end_line=15)],
            fields=[],
        ),
        ParsedClass(
            class_name="DepartmentController",
            qualified_name="backend.controllers.DepartmentController",
            file_path="backend/controllers/departmentController.js",
            start_line=1,
            end_line=50,
            methods=[ParsedMethod(method_name="getDepartments", return_type="Promise<any>", qualified_name="DepartmentController.getDepartments", file_path="backend/controllers/departmentController.js", start_line=5, end_line=15)],
            fields=[],
        ),
        ParsedClass(
            class_name="MenuBar",
            qualified_name="frontend.components.MenuBar",
            file_path="frontend/src/components/MenuBar.jsx",
            start_line=1,
            end_line=30,
            methods=[],
            fields=[],
        ),
    ]

    profile = analyze_project_domain(emp_classes, "Employee_Management_System")
    assert profile["archetype"] == "employee_management"
    assert "Employee" in profile["primary_actor"]

    diags = generate_all_uml_diagrams(emp_classes, project_name="Employee_Management_System")
    uc_svg = diags["use_case_diagram"]["svg"]
    assert "Employee" in uc_svg
    assert "Pizza" not in uc_svg
    assert "Customer" not in uc_svg
    assert "Restaurant" not in uc_svg


