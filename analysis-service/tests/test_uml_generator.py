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
    generate_collaboration_diagram,
    generate_collaboration_svg,
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

    svg = generate_class_svg(sample_parsed_classes, project_name="OnlineStore")
    assert "<svg" in svg
    assert "class-relations-legend" in svg
    assert "Inheritance" in svg
    assert "Realization" in svg
    assert "Composition" in svg
    assert "Aggregation" in svg
    assert "Directed" in svg
    assert "Reflexive" in svg
    assert "Multiplicity" in svg


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
    assert "collaboration_diagram" in diagrams
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


def test_unique_members_and_reference_inheritance_tree():
    """Verify classes have distinctive, unique members and inheritance tree uses standard UML bus routing."""
    animal_classes = [
        ParsedClass(
            class_name='Animal',
            qualified_name='Animal',
            file_path='Animal.java',
            start_line=1, end_line=50,
            fields=[
                ParsedField(field_name='age', field_type='Int', modifiers=['public']),
                ParsedField(field_name='gender', field_type='String', modifiers=['public']),
            ],
            methods=[
                ParsedMethod(method_name='isMammal', return_type='boolean', parameters=[], modifiers=['public'], qualified_name='Animal.isMammal', file_path='Animal.java', start_line=10, end_line=15),
                ParsedMethod(method_name='mate', return_type='void', parameters=[], modifiers=['public'], qualified_name='Animal.mate', file_path='Animal.java', start_line=16, end_line=20),
            ]
        ),
        ParsedClass(
            class_name='Duck',
            qualified_name='Duck',
            file_path='Duck.java',
            start_line=1, end_line=50,
            extends='Animal',
            fields=[
                ParsedField(field_name='beakColr', field_type='String', modifiers=['public']),
            ],
            methods=[
                ParsedMethod(method_name='swim', return_type='void', parameters=[], modifiers=['public'], qualified_name='Duck.swim', file_path='Duck.java', start_line=10, end_line=15),
            ]
        ),
        ParsedClass(
            class_name='Fish',
            qualified_name='Fish',
            file_path='Fish.java',
            start_line=1, end_line=50,
            extends='Animal',
            fields=[
                ParsedField(field_name='sizeInFt', field_type='Int', modifiers=['private']),
                ParsedField(field_name='canEat', field_type='Boolean', modifiers=['private']),
            ],
            methods=[
                ParsedMethod(method_name='Swim', return_type='void', parameters=[], modifiers=['private'], qualified_name='Fish.Swim', file_path='Fish.java', start_line=10, end_line=15),
            ]
        ),
        ParsedClass(
            class_name='Zebra',
            qualified_name='Zebra',
            file_path='Zebra.java',
            start_line=1, end_line=50,
            extends='Animal',
            fields=[
                ParsedField(field_name='is_wild', field_type='Boolean', modifiers=['public']),
            ],
            methods=[
                ParsedMethod(method_name='run', return_type='void', parameters=[], modifiers=['public'], qualified_name='Zebra.run', file_path='Zebra.java', start_line=10, end_line=15),
            ]
        )
    ]

    svg = generate_class_svg(animal_classes, "Animal Kingdom")
    assert "<svg" in svg
    assert "Animal" in svg
    assert "Duck" in svg
    assert "Fish" in svg
    assert "Zebra" in svg
    assert "Inheritance Tree Connector" in svg
    assert "#d5e8d4" in svg


def test_unique_members_emotion_platform():
    """Verify Emotion Platform classes have unique, tailored members and no duplicate generic methods."""
    emotion_classes = [
        ParsedClass(
            class_name='Main',
            qualified_name='main.Main',
            file_path='main.py',
            start_line=1, end_line=100,
            annotations=['Controller'],
            fields=[
                ParsedField(field_name='app', field_type='Any', modifiers=['private']),
            ],
            methods=[
                ParsedMethod(method_name='preprocess_image', return_type='Any', parameters=[], modifiers=['private'], qualified_name='Main.preprocess_image', file_path='main.py', start_line=31, end_line=40),
            ]
        ),
        ParsedClass(
            class_name='Emotion',
            qualified_name='models.Emotion',
            file_path='models/emotion.py',
            start_line=1, end_line=50,
            fields=[],
            methods=[]
        ),
        ParsedClass(
            class_name='Session',
            qualified_name='models.Session',
            file_path='models/session.py',
            start_line=1, end_line=50,
            fields=[],
            methods=[]
        ),
        ParsedClass(
            class_name='Course',
            qualified_name='models.Course',
            file_path='models/course.py',
            start_line=1, end_line=50,
            fields=[],
            methods=[]
        )
    ]

    svg = generate_class_svg(emotion_classes, "Emotion Platform")
    assert "<svg" in svg
    # Check that each class received unique domain attributes and methods
    assert "getSyllabus" in svg or "enrollStudent" in svg
    assert "startSession" in svg or "recordEmotion" in svg
    assert "detectFromFrame" in svg or "getDominantMood" in svg
    # Ensure neither Course nor Session has generic identical fallback "+execute()"
    assert svg.count("+execute()") == 0


def test_class_box_overflow_protection_and_deduplication():
    from core.uml_generator import generate_class_svg
    from core.schemas import ParsedClass, ParsedMethod, ParsedField

    ats_classes = [
        ParsedClass(
            class_name="App",
            qualified_name="App",
            file_path="App.js",
            start_line=1, end_line=50,
            fields=[
                ParsedField(field_name="defaultOptions", field_type="String"),
                ParsedField(field_name="success", field_type="String"),
                ParsedField(field_name="error", field_type="String"),
            ],
            methods=[
                ParsedMethod(method_name="RecruiterRoute", return_type="Promise<any>", parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}], qualified_name="App.RecruiterRoute", file_path="App.js", start_line=5, end_line=10),
                ParsedMethod(method_name="ApplicantRoute", return_type="Promise<any>", parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}], qualified_name="App.ApplicantRoute", file_path="App.js", start_line=12, end_line=18),
                ParsedMethod(method_name="ProtectedRoute", return_type="Promise<any>", parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}], qualified_name="App.ProtectedRoute", file_path="App.js", start_line=20, end_line=28),
            ]
        ),
        ParsedClass(
            class_name="JobController",
            qualified_name="controllers.JobController",
            file_path="JobController.js",
            start_line=1, end_line=50,
            fields=[
                ParsedField(field_name="pagination", field_type="Number"),
                ParsedField(field_name="pagination", field_type="Number"),  # duplicate
                ParsedField(field_name="job", field_type="String"),
            ],
            methods=[
                ParsedMethod(method_name="getJobs", return_type="Promise<any>", parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}], qualified_name="JobController.getJobs", file_path="JobController.js", start_line=5, end_line=10),
                ParsedMethod(method_name="getJob", return_type="Promise<any>", parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}], qualified_name="JobController.getJob", file_path="JobController.js", start_line=12, end_line=18),
                ParsedMethod(method_name="createJob", return_type="Promise<any>", parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}], qualified_name="JobController.createJob", file_path="JobController.js", start_line=20, end_line=28),
            ]
        )
    ]

    svg = generate_class_svg(ats_classes, "Ai Ats Software Main")
    assert "<svg" in svg
    assert "JobController" in svg
    assert "App" in svg
    # Duplicate field should be deduplicated
    assert svg.count("-pagination: Number") == 1
    # Boilerplate Promise<any> / Promise_any_ should be cleanly sanitized
    assert "Promise_any_" not in svg
    assert "Promise" in svg
    # Verbose req: Request, res: Response should be simplified
    assert "req: Request, res: Response" not in svg
    # SVG clipPath should be present to guarantee no text overflow out of boxes
    assert "<clipPath id=" in svg


def test_generate_collaboration_diagram(sample_parsed_classes):
    mmd = generate_collaboration_diagram(sample_parsed_classes, "Job Recruitment System")
    assert "flowchart TD" in mmd
    assert "CollabGraph" in mmd
    assert "Applicant" in mmd
    assert "Database" in mmd
    assert "Recruiter" in mmd
    assert "1 : Ask For Register" in mmd
    assert "10 : Joining" in mmd
    assert "[return]" in mmd
    assert "[self]" in mmd


def test_generate_collaboration_svg_and_notations():
    ats_classes = [
        ParsedClass(
            class_name="App",
            qualified_name="App",
            file_path="App.js",
            start_line=1, end_line=50,
            methods=[
                ParsedMethod(method_name="RecruiterRoute", return_type="Promise<any>", parameters=[], qualified_name="App.RecruiterRoute", file_path="App.js", start_line=5, end_line=10),
                ParsedMethod(method_name="ApplicantRoute", return_type="Promise<any>", parameters=[], qualified_name="App.ApplicantRoute", file_path="App.js", start_line=12, end_line=18),
            ]
        )
    ]

    svg = generate_collaboration_svg(ats_classes, "Ai Ats Software Main")
    assert "<svg" in svg
    assert "collaboration" in svg

    # 1. Objects / Participants
    assert "&lt;&lt;participant&gt;&gt;" in svg
    assert "Recruiter" in svg

    # 2. Multiple Objects (Stacked Rectangles)
    assert "&lt;&lt;multi-object&gt;&gt;" in svg
    assert "Database" in svg
    assert "Multi-Object (Stacked)" in svg

    # 3. Actors
    assert "&lt;&lt;actor&gt;&gt;" in svg
    assert "Applicant" in svg

    # 4. Messages (Numbered with directional flows matching reference)
    assert "1 : Ask For Register" in svg
    assert "2 : Login" in svg
    assert "3 : Verify Login" in svg
    assert "4 : Check the jobs" in svg
    assert "5 : Ask to send interview Details" in svg
    assert "6 : Detail Sentin" in svg
    assert "7 : Attend the Test" in svg
    assert "8 : Selects the Talented applicants" in svg
    assert "9 : sends the letter" in svg
    assert "10 : Joining" in svg

    # 5. Self Message (Loop arrow notation)
    assert "3.1 : [self]" in svg
    assert "Index Audit" in svg

    # 6. Links (Solid straight lines)
    assert '<line x1=' in svg

    # 7. Return Messages (Dashed line with open arrowhead)
    assert "&lt;-- 4.1 : [return]" in svg
    assert "stroke-dasharray=" in svg

    # Bottom Title matching reference model
    assert "Job Recruitment system" in svg

    # Notations Legend Bar
    assert "collaboration-legend" in svg
    assert "Object / Actor" in svg
    assert "Return Message (dashed)" in svg
    assert "Sequence" in svg


def test_collaboration_unique_per_domain():
    # 1. Emotion Learning project
    emotion_classes = [
        ParsedClass(class_name="EmotionDetector", qualified_name="EmotionDetector", file_path="EmotionDetector.py", start_line=1, end_line=50),
        ParsedClass(class_name="SessionModel", qualified_name="SessionModel", file_path="SessionModel.py", start_line=1, end_line=50)
    ]
    emotion_svg = generate_collaboration_svg(emotion_classes, "Emotion Learning Platform")
    assert "Student" in emotion_svg
    assert "EmotionSessionDB" in emotion_svg
    assert "Instructor" in emotion_svg
    assert "Emotion Learning Platform" in emotion_svg

    # 2. E-Commerce project
    shop_classes = [
        ParsedClass(class_name="ProductController", qualified_name="ProductController", file_path="ProductController.js", start_line=1, end_line=50),
        ParsedClass(class_name="CartService", qualified_name="CartService", file_path="CartService.js", start_line=1, end_line=50)
    ]
    shop_svg = generate_collaboration_svg(shop_classes, "Online Shopping Store")
    assert "Customer" in shop_svg
    assert "ProductCatalogDB" in shop_svg
    assert "StoreAdmin" in shop_svg
    assert "E-Commerce Platform" in shop_svg

    # Ensure uniqueness across domains
    assert emotion_svg != shop_svg




