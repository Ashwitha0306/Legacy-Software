import React, { useState } from 'react'
import {
  Users,
  Workflow,
  Activity,
  Layers,
  FolderTree,
  Server,
  Package,
} from 'lucide-react'
import MermaidViewer from './MermaidViewer'
import clsx from 'clsx'

/**
 * UMLDiagramsView
 *
 * Renders 7 standard UML diagrams:
 *   1. Use Case Diagram (Exact match to standard UML specification & reference format)
 *   2. Activity Diagram
 *   3. Sequence Diagram
 *   4. Class Diagram
 *   5. Component Diagram
 *   6. Deployment Diagram
 *   7. Package Diagram
 */

// ── Fallback diagrams (safe, always valid Mermaid v11 / SVG) ─────────────────────

const FALLBACK_CLASS = `classDiagram
    class UserController {
        <<controller>>
        -UserService userService
        +getUser(id) User
        +createUser(body) User
        +deleteUser(id) void
    }
    class UserService {
        <<service>>
        -UserRepository userRepository
        +findById(id) User
        +save(user) User
        +delete(id) void
    }
    class UserRepository {
        <<repository>>
        +findByEmail(email) Optional_User_
    }
    class User {
        <<entity>>
        -Long id
        -String username
        -String email
        +getId() Long
        +getUsername() String
    }
    UserController --> UserService : userService
    UserService --> UserRepository : userRepository
    UserRepository --> User : returns`

const FALLBACK_SEQUENCE = `sequenceDiagram
    autonumber
    actor Client
    participant Ctrl as REST Controller
    participant Svc as Business Service
    participant Repo as Data Repository
    participant DB as Database

    Note over Client,Ctrl: GET /api/users/{id}
    Client->>Ctrl: GET /api/users/42
    activate Ctrl
    Ctrl->>Svc: getUserById(42)
    activate Svc
    Svc->>Repo: findById(42)
    activate Repo
    Repo->>DB: SELECT * FROM users WHERE id=42
    DB-->>Repo: user row
    deactivate Repo
    Svc-->>Ctrl: User DTO
    deactivate Svc
    Ctrl-->>Client: 200 OK JSON
    deactivate Ctrl

    Note over Client,Ctrl: POST /api/users
    Client->>Ctrl: POST /api/users body
    activate Ctrl
    Ctrl->>Svc: createUser(body)
    activate Svc
    Svc->>Repo: save(user)
    activate Repo
    Repo->>DB: INSERT INTO users
    DB-->>Repo: new id
    deactivate Repo
    Svc-->>Ctrl: saved User
    deactivate Svc
    Ctrl-->>Client: 201 Created
    deactivate Ctrl`

const FALLBACK_COMPONENT = `flowchart TB
    classDef ctrl fill:#0f2040,stroke:#22d3ee,stroke-width:2px,color:#fff
    classDef svc  fill:#152b56,stroke:#a78bfa,stroke-width:2px,color:#fff
    classDef repo fill:#1e3a6e,stroke:#f59e0b,stroke-width:2px,color:#fff
    classDef ent  fill:#0a1628,stroke:#10b981,stroke-width:2px,color:#fff

    subgraph Presentation_Layer[Presentation Layer]
        UserController["UserController [controller]"]:::ctrl
        AuthController["AuthController [controller]"]:::ctrl
    end

    subgraph Business_Layer[Business Logic Layer]
        UserService["UserService [service]"]:::svc
        AuthService["AuthService [service]"]:::svc
    end

    subgraph Persistence_Layer[Persistence Layer]
        UserRepository["UserRepository [repository]"]:::repo
        User["User [entity]"]:::ent
    end

    UserController --> UserService
    AuthController --> AuthService
    UserService --> UserRepository
    AuthService --> UserRepository
    UserRepository --> User`

const FALLBACK_ACTIVITY = `flowchart TD
    classDef start fill:#38bdf8,stroke:#0284c7,stroke-width:2px,color:#000
    classDef action fill:#0f2040,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef decision fill:#1e293b,stroke:#f59e0b,stroke-width:2px,color:#fcd34d
    classDef err fill:#450a0a,stroke:#ef4444,stroke-width:1.5px,color:#fecaca
    classDef stop fill:#0f172a,stroke:#38bdf8,stroke-width:3px,color:#38bdf8

    Start([● Start]):::start --> Ingest[Receive & Validate API Request]:::action
    Ingest --> Check{Input Valid?}:::decision
    Check -- No --> Err[Return 400 Bad Request]:::err
    Err --> FinalNode(((◎ Stop))):::stop
    Check -- Yes --> Logic[Execute Business Service Logic]:::action
    Logic --> Fork====
    Fork --> Persist[Persist Entity State (DB)]:::action
    Fork --> Audit[Emit Domain Events & Audit Log]:::action
    Persist --> Join====
    Audit --> Join====
    Join --> Response[Serialize DTO & Return 200 OK]:::action
    Response --> FinalNode`

const FALLBACK_DEPLOYMENT = `flowchart TB
    classDef dev fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef app fill:#0f2040,stroke:#34d399,stroke-width:2px,color:#fff
    classDef db fill:#1e1b4b,stroke:#f59e0b,stroke-width:2px,color:#fff
    classDef cache fill:#1e1b4b,stroke:#ec4899,stroke-width:2px,color:#fff

    subgraph Client_Device["«device» Client Browser"]
        Client["Web / Single Page Application"]:::dev
    end

    subgraph Edge_Gateway["«executionEnvironment» Edge Gateway"]
        Gateway["Nginx Reverse Proxy / Load Balancer"]:::dev
    end

    subgraph App_Server["«executionEnvironment» Application Server"]
        App["Spring Boot / Runtime Container\\n«artifact» app.jar"]:::app
    end

    subgraph DB_Server["«device» Database Server"]
        DB[("PostgreSQL / MongoDB Node")]:::db
    end

    subgraph Cache_Server["«device» In-Memory Cache"]
        Redis["Redis Cache & Queue"]:::cache
    end

    Client -- "HTTPS : 443" --> Gateway
    Gateway -- "HTTP : 8080" --> App
    App -- "JDBC : 5432" --> DB
    App -- "RESP : 6379" --> Redis`

const FALLBACK_PACKAGE = `flowchart TB
    classDef pkg fill:#0f172a,stroke:#38bdf8,stroke-width:2px,color:#fff
    classDef svc fill:#0f2040,stroke:#34d399,stroke-width:2px,color:#fff
    classDef repo fill:#1e1b4b,stroke:#f59e0b,stroke-width:2px,color:#fff
    classDef mdl fill:#1e1b4b,stroke:#ec4899,stroke-width:2px,color:#fff
    classDef dto fill:#1e1b4b,stroke:#a78bfa,stroke-width:2px,color:#fff

    subgraph controller["package com.app.controller"]
        Ctrl[REST & Web Controllers]:::pkg
    end

    subgraph dto_pkg["package com.app.dto"]
        DTO[Data Transfer Objects]:::dto
    end

    subgraph service["package com.app.service"]
        Svc[Business Logic Services]:::svc
    end

    subgraph repository["package com.app.repository"]
        Repo[Data Repositories]:::repo
    end

    subgraph model["package com.app.model"]
        Ent[Entities & Domain Models]:::mdl
    end

    Ctrl -. "«import»" .-> Svc
    Ctrl -. "«uses»" .-> DTO
    Svc -. "«import»" .-> Repo
    Svc -. "«access»" .-> Ent
    Repo -. "«maps»" .-> Ent`

// ── Helpers ─────────────────────────────────────────────────────────────────

const ILLEGAL_PATTERNS = [
  /class @[A-Z]/,
  /NodeType\./,
  /RelationshipType\./,
  /class \w+\([^)]+\)/,
  /<<NodeType\./,
]

function validateStoredMermaid(code) {
  if (!code || typeof code !== 'string') return null
  return ILLEGAL_PATTERNS.some(re => re.test(code)) ? null : code
}

function safeId(s) {
  return (s || 'Unknown').replace(/[^a-zA-Z0-9_]/g, '_')
}

function safeType(t) {
  if (!t) return 'void'
  let s = t.replace(/<([^>]*)>/g, (_, inner) => '_' + inner.replace(/[, ]/g, '_') + '_')
  return s.replace(/[^a-zA-Z0-9_]/g, '_')
}

function bareType(t) {
  if (!t) return ''
  const m = t.match(/<([^,>]+)/)
  return m ? m[1].trim() : t.trim()
}

function getStereotype(cls) {
  if (cls.is_interface) return 'interface'
  if (cls.is_abstract) return 'abstract'
  if (cls.is_enum) return 'enumeration'
  const ann = (cls.annotations || []).join(' ')
  if (/RestController|Controller/.test(ann)) return 'controller'
  if (/\bService\b/.test(ann)) return 'service'
  if (/Repository/.test(ann)) return 'repository'
  if (/Entity|Table/.test(ann)) return 'entity'
  if (/Configuration/.test(ann)) return 'configuration'
  return ''
}

function toTitleCase(s) {
  if (!s) return ''
  return s
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_\-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim()
}

// ── Client-side dynamic generators ──────────────────────────────────────────

function extractUseCaseData(classes, projectName = 'System') {
  const profile = analyzeProjectDomain(classes, projectName)
  const displayTitle = `${profile.title} Use Cases`
  const archetype = profile.archetype || 'custom_domain'

  if (archetype === 'cli_parser') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'CLI Application / Developer', y: 270 },
        { name: 'System Terminal / Shell', y: 730 },
      ],
      actorsRight: [
        { name: 'POSIX / GNU Syntax Engine', y: 320 },
        { name: 'Options Registry', y: 730 },
      ],
      useCases: [
        { id: 'uc_define_options', label: 'Define Command\nLine Options', cx: 385, cy: 150 },
        { id: 'uc_configure_flags', label: 'Configure Option\nFlags & Args', cx: 685, cy: 150 },
        { id: 'uc_parse_args', label: 'Parse Command\nLine Arguments', cx: 385, cy: 320 },
        { id: 'uc_validate_required', label: 'Validate Required\nOption Arguments', cx: 685, cy: 320 },
        { id: 'uc_query_values', label: 'Query Parsed\nOption Values', cx: 385, cy: 490 },
        { id: 'uc_handle_groups', label: 'Process Mutually\nExclusive Groups', cx: 685, cy: 490 },
        { id: 'uc_format_help', label: 'Format Usage\n& Help Guide', cx: 385, cy: 660 },
        { id: 'uc_print_documentation', label: 'Print Console\nSyntax Reference', cx: 685, cy: 660 },
        { id: 'uc_inspect_unrecognized', label: 'Inspect Unknown\nTrailing Arguments', cx: 385, cy: 830 },
        { id: 'uc_handle_exceptions', label: 'Handle Parse\nExceptions', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'CLI Application / Developer', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'define options' },
        { actor: 'CLI Application / Developer', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'parse args' },
        { actor: 'CLI Application / Developer', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'query values' },
        { actor: 'System Terminal / Shell', fromX: 105, fromY: 730, toX: 303, toY: 660, label: 'display help' },
        { actor: 'System Terminal / Shell', fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'pipe trailing' },
        { actor: 'POSIX / GNU Syntax Engine', fromX: 880, fromY: 320, toX: 767, toY: 150, label: 'enforce syntax' },
        { actor: 'Options Registry', fromX: 880, fromY: 720, toX: 467, toY: 320, label: 'check requirements' },
        { actor: 'Options Registry', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'audit exceptions' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{with default values}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if required flag missing}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{if group conflict}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{auto wrap 80 cols}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{throw UnrecognizedOption}' },
      ],
    }
  }

  if (archetype === 'csv_processor') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Data Ingestion Client', y: 270 },
        { name: 'File Stream / Source', y: 730 },
      ],
      actorsRight: [
        { name: 'Lexer & Tokenizer API', y: 320 },
        { name: 'Tabular Record Store', y: 730 },
      ],
      useCases: [
        { id: 'uc_config_format', label: 'Configure CSV\nFormat & Delimiters', cx: 385, cy: 150 },
        { id: 'uc_define_headers', label: 'Map Header Names\n& Column Indices', cx: 685, cy: 150 },
        { id: 'uc_parse_stream', label: 'Parse CSV\nData Stream', cx: 385, cy: 320 },
        { id: 'uc_tokenize_chars', label: 'Tokenize Delimited\nCharacter Buffer', cx: 685, cy: 320 },
        { id: 'uc_extract_records', label: 'Extract Sequential\nCSV Records', cx: 385, cy: 490 },
        { id: 'uc_query_columns', label: 'Query Row Values\nby Header Name', cx: 685, cy: 490 },
        { id: 'uc_format_print', label: 'Format & Print\nCSV Output', cx: 385, cy: 660 },
        { id: 'uc_handle_quotes', label: 'Escape Multi-line\nQuoted Fields', cx: 685, cy: 660 },
        { id: 'uc_validate_tabular', label: 'Validate Tabular\nRow Consistency', cx: 385, cy: 830 },
        { id: 'uc_export_dataset', label: 'Export Serialized\nDataset File', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Data Ingestion Client', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'set format' },
        { actor: 'Data Ingestion Client', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'stream parse' },
        { actor: 'Data Ingestion Client', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'read records' },
        { actor: 'File Stream / Source', fromX: 105, fromY: 730, toX: 303, toY: 660, label: 'write output' },
        { actor: 'File Stream / Source', fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'validate rows' },
        { actor: 'Lexer & Tokenizer API', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'tokenize stream' },
        { actor: 'Tabular Record Store', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'persist rows' },
        { actor: 'Tabular Record Store', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'export file' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{RFC 4180 standard}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{buffer size 8192}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{with header mapping}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if multi-line quote}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{if length mismatch}' },
      ],
    }
  }

  if (archetype === 'vulnerability_benchmark') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Security Researcher', y: 270 },
        { name: 'Automated Test Runner', y: 730 },
      ],
      actorsRight: [
        { name: 'Git Worktree API', y: 320 },
        { name: 'Vulnerability DB Store', y: 730 },
      ],
      useCases: [
        { id: 'uc_browse_cves', label: 'Browse Vulnerability\nBenchmark CVEs', cx: 385, cy: 150 },
        { id: 'uc_inspect_metadata', label: 'Inspect Flaw Scope\n& Severity Rating', cx: 685, cy: 150 },
        { id: 'uc_checkout_commit', label: 'Checkout Vulnerable\nGit Revision', cx: 385, cy: 320 },
        { id: 'uc_extract_ast_diff', label: 'Extract AST Code\nModifications', cx: 685, cy: 320 },
        { id: 'uc_mine_patches', label: 'Mine Patch Candidate\nModifications', cx: 385, cy: 490 },
        { id: 'uc_reproduce_flaw', label: 'Reproduce Flaw\nwith Trigger Tests', cx: 685, cy: 490 },
        { id: 'uc_verify_mitigation', label: 'Verify Patch\nMitigation Effect', cx: 385, cy: 660 },
        { id: 'uc_audit_regression', label: 'Run Regression\nBenchmark Suite', cx: 685, cy: 660 },
        { id: 'uc_benchmark_metrics', label: 'Generate Security\nEvaluation Metrics', cx: 385, cy: 830 },
        { id: 'uc_export_dossier', label: 'Export Flaw Dataset\nDossier', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Security Researcher', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'browse flaws' },
        { actor: 'Security Researcher', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'checkout' },
        { actor: 'Security Researcher', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'mine patches' },
        { actor: 'Automated Test Runner', fromX: 105, fromY: 730, toX: 303, toY: 660, label: 'test mitigation' },
        { actor: 'Automated Test Runner', fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'compute metrics' },
        { actor: 'Git Worktree API', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'extract AST' },
        { actor: 'Vulnerability DB Store', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'verify flaw' },
        { actor: 'Vulnerability DB Store', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'persist results' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{with CWE classification}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{Tree-sitter diff}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{trigger test passes}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{no regressions}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{export JSON benchmark}' },
      ],
    }
  }

  if (archetype === 'collaborative_workspace') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Workspace Member', y: 270 },
        { name: 'Workspace Admin', y: 730 },
      ],
      actorsRight: [
        { name: 'WebSocket Gateway', y: 320 },
        { name: 'Session Snapshot Store', y: 730 },
      ],
      useCases: [
        { id: 'uc_join_room', label: 'Join Collaborative\nWorkspace Session', cx: 385, cy: 150 },
        { id: 'uc_auth_member', label: 'Verify Member Token\n& Permissions', cx: 685, cy: 150 },
        { id: 'uc_broadcast_presence', label: 'Broadcast Cursor\n& Presence State', cx: 385, cy: 320 },
        { id: 'uc_render_canvas', label: 'Render Live Canvas\nDocument State', cx: 685, cy: 320 },
        { id: 'uc_mutate_document', label: 'Apply Realtime\nCanvas Mutation', cx: 385, cy: 490 },
        { id: 'uc_resolve_ot', label: 'Resolve Operational\nTransformation', cx: 685, cy: 490 },
        { id: 'uc_sync_peers', label: 'Sync Concurrent\nEdits to Peers', cx: 385, cy: 660 },
        { id: 'uc_manage_history', label: 'Inspect Revision\nHistory Timeline', cx: 685, cy: 660 },
        { id: 'uc_admin_permissions', label: 'Manage Workspace\nMember Roles', cx: 385, cy: 830 },
        { id: 'uc_persist_snapshot', label: 'Persist Session\nState Snapshot', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Workspace Member', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'join session' },
        { actor: 'Workspace Member', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'sync presence' },
        { actor: 'Workspace Member', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'edit canvas' },
        { actor: 'Workspace Admin', fromX: 105, fromY: 730, toX: 303, toY: 660, label: 'view history' },
        { actor: 'Workspace Admin', fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'manage roles' },
        { actor: 'WebSocket Gateway', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'render stream' },
        { actor: 'Session Snapshot Store', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'apply delta' },
        { actor: 'Session Snapshot Store', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'save snapshot' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{JWT auth validated}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{60fps update rate}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{if collision detected}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{with revert action}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{auto save 30s}' },
      ],
    }
  }

  if (archetype === 'employee_management') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Employee / Staff', y: 270 },
        { name: 'HR / Department Manager', y: 730 },
      ],
      actorsRight: [
        { name: 'Auth Gateway API', y: 320 },
        { name: 'Employee Database', y: 730 },
      ],
      useCases: [
        { id: 'uc_view_profile', label: 'View Employee\nProfile', cx: 385, cy: 150 },
        { id: 'uc_update_info', label: 'Update Personal\nInformation', cx: 685, cy: 150 },
        { id: 'uc_manage_dept', label: 'Manage Department\nStaff', cx: 385, cy: 320 },
        { id: 'uc_assign_role', label: 'Assign Role &\nDesignation', cx: 685, cy: 320 },
        { id: 'uc_payroll', label: 'Process Salary\n& Payroll', cx: 385, cy: 490 },
        { id: 'uc_payslip', label: 'Generate Pay\nSlip Dossier', cx: 685, cy: 490 },
        { id: 'uc_performance', label: 'Conduct Performance\nAppraisal', cx: 385, cy: 660 },
        { id: 'uc_review_rating', label: 'Submit Review\n& Feedback', cx: 685, cy: 660 },
        { id: 'uc_workforce_analytics', label: 'View Workforce\nAnalytics', cx: 385, cy: 830 },
        { id: 'uc_compliance_audit', label: 'Audit HR Policy\nCompliance', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Employee / Staff', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'view profile' },
        { actor: 'Employee / Staff', fromX: 105, fromY: 270, toX: 303, toY: 490, label: 'view payroll' },
        { actor: 'Employee / Staff', fromX: 105, fromY: 290, toX: 303, toY: 660, label: 'self review' },
        { actor: 'HR / Department Manager', fromX: 105, fromY: 730, toX: 303, toY: 320, label: 'manage dept' },
        { actor: 'HR / Department Manager', fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'view analytics' },
        { actor: 'Auth Gateway API', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'verify role' },
        { actor: 'Employee Database', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'persist payroll' },
        { actor: 'Employee Database', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'audit log' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{if contact modified}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{with manager sign-off}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{auto calculate deductions}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{score >= 3.0 required}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{export PDF report}' },
      ],
    }
  }

  if (archetype === 'recruitment') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Candidate', y: 270 },
        { name: 'Recruiter / HR', y: 730 },
      ],
      actorsRight: [
        { name: 'Resume Parser API', y: 320 },
        { name: 'Candidate Database', y: 730 },
      ],
      useCases: [
        { id: 'uc_submit_app', label: 'Submit Resume\n& Application', cx: 385, cy: 150 },
        { id: 'uc_parse_skills', label: 'Parse Resume\nSkills', cx: 685, cy: 150 },
        { id: 'uc_search_jobs', label: 'Search Matching\nJob Openings', cx: 385, cy: 320 },
        { id: 'uc_filter_rank', label: 'Filter by\nSkill Rank', cx: 685, cy: 320 },
        { id: 'uc_screen_profile', label: 'Screen Candidate\nProfile', cx: 385, cy: 490 },
        { id: 'uc_ai_match', label: 'Compute AI\nMatch Score', cx: 685, cy: 490 },
        { id: 'uc_shortlist_dossier', label: 'Shortlist Candidate\nDossier', cx: 385, cy: 660 },
        { id: 'uc_schedule_interview', label: 'Schedule\nInterview', cx: 685, cy: 660 },
        { id: 'uc_manage_pipeline', label: 'Manage Hiring\nPipeline', cx: 385, cy: 830 },
        { id: 'uc_candidate_analytics', label: 'View Candidate\nAnalytics', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Candidate', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'submit application' },
        { actor: 'Candidate', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'search jobs' },
        { actor: 'Candidate', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'view match status' },
        { actor: 'Recruiter / HR', fromX: 105, fromY: 730, toX: 303, toY: 660, label: 'review shortlisted' },
        { actor: 'Recruiter / HR', fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'manage pipeline' },
        { actor: 'Resume Parser API', fromX: 880, fromY: 320, toX: 767, toY: 150, label: 'extract skills' },
        { actor: 'Candidate Database', fromX: 880, fromY: 720, toX: 467, toY: 660, label: 'persist evaluation' },
        { actor: 'Candidate Database', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'pipeline metrics' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{extract from PDF / DOCX}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if criteria matched}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{if match score >= 75%}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if candidate approved}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{generate PDF dossier}' },
      ],
    }
  }

  if (archetype === 'emotion_learning') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Student', y: 270 },
        { name: 'Instructor / Admin', y: 730 },
      ],
      actorsRight: [
        { name: 'Facial Inference API', y: 320 },
        { name: 'Telemetry Database', y: 730 },
      ],
      useCases: [
        { id: 'uc_attend_session', label: 'Attend Learning\nSession', cx: 385, cy: 150 },
        { id: 'uc_access_camera', label: 'Access Webcam\nVideo', cx: 685, cy: 150 },
        { id: 'uc_course_module', label: 'Engage with\nCourse Module', cx: 385, cy: 320 },
        { id: 'uc_detect_emotion', label: 'Detect Live\nEmotion', cx: 685, cy: 320 },
        { id: 'uc_take_quiz', label: 'Attempt Practice\nQuiz', cx: 385, cy: 490 },
        { id: 'uc_adapt_pace', label: 'Adapt Difficulty\n& Pace', cx: 685, cy: 490 },
        { id: 'uc_listen_music', label: 'Listen to Audio\nPlaylist', cx: 385, cy: 660 },
        { id: 'uc_soothing_track', label: 'Recommend Soothing\nTrack', cx: 685, cy: 660 },
        { id: 'uc_review_telemetry', label: 'Review Learning\nTelemetry', cx: 385, cy: 830 },
        { id: 'uc_export_session', label: 'Export Session\nSummary', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Student', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'start session' },
        { actor: 'Student', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'learn content' },
        { actor: 'Student', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'take quiz' },
        { actor: 'Student', fromX: 105, fromY: 310, toX: 303, toY: 660, label: 'listen audio' },
        { actor: 'Instructor / Admin', fromX: 105, fromY: 730, toX: 303, toY: 830, label: 'monitor learners' },
        { actor: 'Facial Inference API', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'realtime inference' },
        { actor: 'Telemetry Database', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'persist scores' },
        { actor: 'Telemetry Database', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'telemetry log' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{if camera authorized}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{realtime AI landmark}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{if fatigue detected}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if stress detected}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{generate PDF report}' },
      ],
    }
  }

  if (archetype === 'food_delivery') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Customer', y: 270 },
        { name: 'Kitchen Manager', y: 730 },
      ],
      actorsRight: [
        { name: 'Payment Gateway', y: 320 },
        { name: 'Restaurant Database', y: 730 },
      ],
      useCases: [
        { id: 'uc_browse_menu', label: 'Browse Restaurant\nMenu', cx: 385, cy: 150 },
        { id: 'uc_customize_pizza', label: 'Customize Pizza\nToppings', cx: 685, cy: 150 },
        { id: 'uc_place_order', label: 'Place Food\nOrder', cx: 385, cy: 320 },
        { id: 'uc_apply_discount', label: 'Apply Promo\nDiscount', cx: 685, cy: 320 },
        { id: 'uc_track_prep', label: 'Track Kitchen\nPreparation', cx: 385, cy: 490 },
        { id: 'uc_notify_courier', label: 'Notify Courier\nDispatch', cx: 685, cy: 490 },
        { id: 'uc_track_courier', label: 'Live Track\nDelivery Courier', cx: 385, cy: 660 },
        { id: 'uc_confirm_dropoff', label: 'Confirm\nDrop-off', cx: 685, cy: 660 },
        { id: 'uc_manage_inventory', label: 'Manage Kitchen\nInventory', cx: 385, cy: 830 },
        { id: 'uc_sales_analytics', label: 'View Sales\nAnalytics', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Customer', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'browse menu' },
        { actor: 'Customer', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'order items' },
        { actor: 'Customer', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'track prep' },
        { actor: 'Customer', fromX: 105, fromY: 310, toX: 303, toY: 660, label: 'track courier' },
        { actor: 'Kitchen Manager', fromX: 105, fromY: 730, toX: 303, toY: 830, label: 'manage stock' },
        { actor: 'Payment Gateway', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'charge card' },
        { actor: 'Restaurant Database', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'save order' },
        { actor: 'Restaurant Database', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'revenue report' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{select ingredients}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if coupon valid}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{when baked}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{upon arrival}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{generate daily summary}' },
      ],
    }
  }

  if (archetype === 'healthcare') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Patient', y: 270 },
        { name: 'Physician / Doctor', y: 730 },
      ],
      actorsRight: [
        { name: 'Diagnostic Lab Gateway', y: 320 },
        { name: 'EHR Database', y: 730 },
      ],
      useCases: [
        { id: 'uc_intake', label: 'Patient Intake\n& Check-In', cx: 385, cy: 150 },
        { id: 'uc_vitals', label: 'Record Vital\nSigns', cx: 685, cy: 150 },
        { id: 'uc_chart', label: 'Review Medical\nChart', cx: 385, cy: 320 },
        { id: 'uc_tests', label: 'Perform Diagnostic\nTests', cx: 685, cy: 320 },
        { id: 'uc_prescribe', label: 'Prescribe\nMedications', cx: 385, cy: 490 },
        { id: 'uc_allergies', label: 'Check Drug\nAllergies', cx: 685, cy: 490 },
        { id: 'uc_therapy', label: 'Schedule Outpatient\nTherapy', cx: 385, cy: 660 },
        { id: 'uc_protocol', label: 'Update Treatment\nProtocol', cx: 685, cy: 660 },
        { id: 'uc_ops', label: 'Manage Clinic\nOperations', cx: 385, cy: 830 },
        { id: 'uc_compliance', label: 'Audit Clinical\nCompliance', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Patient', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'check-in' },
        { actor: 'Patient', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'view records' },
        { actor: 'Physician / Doctor', fromX: 105, fromY: 730, toX: 303, toY: 490, label: 'prescribe treatment' },
        { actor: 'Physician / Doctor', fromX: 105, fromY: 750, toX: 303, toY: 660, label: 'order therapy' },
        { actor: 'Diagnostic Lab Gateway', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'lab results' },
        { actor: 'EHR Database', fromX: 880, fromY: 720, toX: 467, toY: 320, label: 'ehr history' },
        { actor: 'EHR Database', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'audit log' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{at triage}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if urgent critical}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{verify interactions}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if recurring therapy}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{generate EHR report}' },
      ],
    }
  }

  if (archetype === 'finance') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Account Holder', y: 270 },
        { name: 'Bank Manager', y: 730 },
      ],
      actorsRight: [
        { name: 'Payment Network', y: 320 },
        { name: 'Core Banking DB', y: 730 },
      ],
      useCases: [
        { id: 'uc_view_balance', label: 'Check Account\nBalance', cx: 385, cy: 150 },
        { id: 'uc_download_statement', label: 'Download\nStatement', cx: 685, cy: 150 },
        { id: 'uc_transfer_funds', label: 'Transfer\nFunds', cx: 385, cy: 320 },
        { id: 'uc_verify_beneficiary', label: 'Verify\nBeneficiary', cx: 685, cy: 320 },
        { id: 'uc_pay_bills', label: 'Pay Utility\nBills', cx: 385, cy: 490 },
        { id: 'uc_auto_pay', label: 'Set Recurring\nAuto-Pay', cx: 685, cy: 490 },
        { id: 'uc_apply_loan', label: 'Apply for\nCredit / Loan', cx: 385, cy: 660 },
        { id: 'uc_calc_emi', label: 'Calculate\nEMI Schedule', cx: 685, cy: 660 },
        { id: 'uc_audit_logs', label: 'Audit Security\n& Compliance', cx: 385, cy: 830 },
        { id: 'uc_manage_accounts', label: 'Manage Customer\nAccounts', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Account Holder', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'view balance' },
        { actor: 'Account Holder', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'send money' },
        { actor: 'Account Holder', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'pay bills' },
        { actor: 'Account Holder', fromX: 105, fromY: 310, toX: 303, toY: 660, label: 'request loan' },
        { actor: 'Bank Manager', fromX: 105, fromY: 730, toX: 303, toY: 830, label: 'compliance check' },
        { actor: 'Bank Manager', fromX: 105, fromY: 750, toX: 603, toY: 830, label: 'approve accounts' },
        { actor: 'Payment Network', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'clear transaction' },
        { actor: 'Core Banking DB', fromX: 880, fromY: 720, toX: 467, toY: 320, label: 'ledger update' },
        { actor: 'Core Banking DB', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'audit log record' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{if e-statement requested}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if external bank}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{if recurring enabled}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if documents verified}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{export audit log}' },
      ],
    }
  }

  if (archetype === 'ecommerce') {
    return {
      title: displayTitle,
      actorsLeft: [
        { name: 'Customer', y: 270 },
        { name: 'Store Admin', y: 730 },
      ],
      actorsRight: [
        { name: 'Payment Gateway', y: 320 },
        { name: 'Database', y: 730 },
      ],
      useCases: [
        { id: 'uc_browse_catalog', label: 'Browse Product\nCatalog', cx: 385, cy: 150 },
        { id: 'uc_search_products', label: 'Search\nProducts', cx: 685, cy: 150 },
        { id: 'uc_manage_cart', label: 'Manage\nShopping Cart', cx: 385, cy: 320 },
        { id: 'uc_apply_coupon', label: 'Apply Promo\nCoupon', cx: 685, cy: 320 },
        { id: 'uc_checkout_order', label: 'Checkout\n& Order', cx: 385, cy: 490 },
        { id: 'uc_process_payment', label: 'Process\nPayment', cx: 685, cy: 490 },
        { id: 'uc_track_order', label: 'Track Order\nShipment', cx: 385, cy: 660 },
        { id: 'uc_download_invoice', label: 'Download\nInvoice', cx: 685, cy: 660 },
        { id: 'uc_manage_inventory', label: 'Manage Product\nInventory', cx: 385, cy: 830 },
        { id: 'uc_sales_analytics', label: 'View Sales\nAnalytics', cx: 685, cy: 830 },
      ],
      associations: [
        { actor: 'Customer', fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'browse' },
        { actor: 'Customer', fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'add items' },
        { actor: 'Customer', fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'place order' },
        { actor: 'Customer', fromX: 105, fromY: 310, toX: 303, toY: 660, label: 'check status' },
        { actor: 'Store Admin', fromX: 105, fromY: 730, toX: 303, toY: 830, label: 'manage catalog' },
        { actor: 'Store Admin', fromX: 105, fromY: 750, toX: 603, toY: 830, label: 'monitor revenue' },
        { actor: 'Payment Gateway', fromX: 880, fromY: 320, toX: 767, toY: 490, label: 'authorize card' },
        { actor: 'Database', fromX: 880, fromY: 720, toX: 467, toY: 490, label: 'persist order' },
        { actor: 'Database', fromX: 880, fromY: 745, toX: 467, toY: 830, label: 'update stock' },
      ],
      extensions: [
        { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{with category filter}' },
        { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if coupon valid}' },
        { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{if payment verified}' },
        { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if delivered}' },
        { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{generate PDF report}' },
      ],
    }
  }

  // Dynamic custom domain
  const pConcept = profile.pascalName || 'Domain'
  return {
    title: displayTitle,
    actorsLeft: [
      { name: profile.primaryActor, y: 270 },
      { name: profile.adminActor, y: 740 },
    ],
    actorsRight: [
      { name: 'External API Gateway', y: 320 },
      { name: profile.dbName, y: 740 },
    ],
    useCases: [
      { id: 'uc_b_0', label: `Ingest ${pConcept}\nRequest`, cx: 385, cy: 150 },
      { id: 'uc_e_0', label: `Validate ${pConcept}\nPayload`, cx: 685, cy: 150 },
      { id: 'uc_b_1', label: 'Execute Core\nAction', cx: 385, cy: 320 },
      { id: 'uc_e_1', label: 'Verify Access\nAuthorization', cx: 685, cy: 320 },
      { id: 'uc_b_2', label: `Query ${pConcept}\nRecords`, cx: 385, cy: 490 },
      { id: 'uc_e_2', label: 'Apply Custom\nFilters', cx: 685, cy: 490 },
      { id: 'uc_b_3', label: 'Process System\nWorkflow', cx: 385, cy: 660 },
      { id: 'uc_e_3', label: 'Trigger Exception\nHandling', cx: 685, cy: 660 },
      { id: 'uc_b_4', label: 'Manage System\nConfiguration', cx: 385, cy: 830 },
      { id: 'uc_e_4', label: 'Audit Security\nTelemetry', cx: 685, cy: 830 },
    ],
    associations: [
      { actor: profile.primaryActor, fromX: 105, fromY: 250, toX: 303, toY: 150, label: 'request' },
      { actor: profile.primaryActor, fromX: 105, fromY: 270, toX: 303, toY: 320, label: 'execute' },
      { actor: profile.primaryActor, fromX: 105, fromY: 290, toX: 303, toY: 490, label: 'submit' },
      { actor: profile.adminActor, fromX: 105, fromY: 730, toX: 303, toY: 660, label: 'monitor' },
      { actor: profile.adminActor, fromX: 105, fromY: 750, toX: 303, toY: 830, label: 'configure' },
      { actor: 'External API Gateway', fromX: 880, fromY: 320, toX: 767, toY: 320, label: 'sync' },
      { actor: profile.dbName, fromX: 880, fromY: 740, toX: 467, toY: 830, label: 'persist' },
    ],
    extensions: [
      { fromX: 603, fromY: 150, toX: 467, toY: 150, condition: '{with validation rules}' },
      { fromX: 603, fromY: 320, toX: 467, toY: 320, condition: '{if role permitted}' },
      { fromX: 603, fromY: 490, toX: 467, toY: 490, condition: '{with filter criteria}' },
      { fromX: 603, fromY: 660, toX: 467, toY: 660, condition: '{if error occurred}' },
      { fromX: 603, fromY: 830, toX: 467, toY: 830, condition: '{generate report}' },
    ],
  }
}
function buildUseCaseSvg(classes, projectName = 'System') {
  const data = extractUseCaseData(classes, projectName)
  const width = 980
  const height = 920
  const tabTitle = `uc ${data.title}`
  const tabW = Math.max(190, Math.floor(tabTitle.length * 8.5 + 40))

  const actorSvg = (act, isRight) => {
    const x = isRight ? 915 : 65
    const y = act.y
    return `
  <!-- Actor: ${act.name} -->
  <circle cx="${x}" cy="${y}" r="17" fill="url(#headGrad)" stroke="#0f172a" stroke-width="2.4"/>
  <line x1="${x}" y1="${y + 17}" x2="${x}" y2="${y + 62}" stroke="#0f172a" stroke-width="2.4"/>
  <line x1="${x - 24}" y1="${y + 36}" x2="${x + 24}" y2="${y + 36}" stroke="#0f172a" stroke-width="2.4"/>
  <line x1="${x}" y1="${y + 62}" x2="${x - 18}" y2="${y + 108}" stroke="#0f172a" stroke-width="2.4"/>
  <line x1="${x}" y1="${y + 62}" x2="${x + 18}" y2="${y + 108}" stroke="#0f172a" stroke-width="2.4"/>
  <text x="${x}" y="${y + 128}" font-size="15" font-weight="600" fill="#0f172a" text-anchor="middle">${act.name}</text>
    `
  }

  const ovals = data.useCases.map(uc => {
    const lines = uc.label.split('\n')
    const tStr = lines.length === 1
      ? `<text x="${uc.cx}" y="${uc.cy + 5}" font-size="14" font-weight="600" fill="#0f172a" text-anchor="middle">${lines[0]}</text>`
      : `<text x="${uc.cx}" y="${uc.cy - 6}" font-size="14" font-weight="600" fill="#0f172a" text-anchor="middle">${lines[0]}</text>
         <text x="${uc.cx}" y="${uc.cy + 14}" font-size="14" font-weight="600" fill="#0f172a" text-anchor="middle">${lines[1]}</text>`

    return `
  <ellipse cx="${uc.cx}" cy="${uc.cy}" rx="78" ry="38" fill="url(#peachGrad)" stroke="#0f172a" stroke-width="2.2"/>
  ${tStr}
    `
  }).join('\n')

  const assocSvg = data.associations.map(asc => {
    const lbl = asc.label ? `<text x="${(asc.fromX + asc.toX) / 2}" y="${(asc.fromY + asc.toY) / 2 - 8}" font-size="12" font-weight="500" fill="#0f172a" text-anchor="middle">${asc.label}</text>` : ''
    return `
  <line x1="${asc.fromX}" y1="${asc.fromY}" x2="${asc.toX}" y2="${asc.toY}" stroke="#0f172a" stroke-width="2"/>
  ${lbl}
    `
  }).join('\n')

  const extendSvg = data.extensions.map(ext => {
    const mx = (ext.fromX + ext.toX) / 2
    const my = (ext.fromY + ext.toY) / 2
    const cond = ext.condition ? `<text x="${mx}" y="${my + 14}" font-size="12" font-weight="400" fill="#334155" text-anchor="middle">${ext.condition}</text>` : ''
    return `
  <line x1="${ext.fromX}" y1="${ext.fromY}" x2="${ext.toX}" y2="${ext.toY}" stroke="#0f172a" stroke-width="2.2" stroke-dasharray="7,5" marker-end="url(#openArrow)"/>
  <text x="${mx}" y="${my - 6}" font-size="13" font-weight="700" fill="#0f172a" text-anchor="middle">&lt;&lt;extend&gt;&gt;</text>
  ${cond}
    `
  }).join('\n')

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <defs>
    <linearGradient id="peachGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff6ec" />
      <stop offset="50%" stop-color="#fed7aa" />
      <stop offset="100%" stop-color="#fba867" />
    </linearGradient>
    <linearGradient id="headGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fff1e6" />
      <stop offset="100%" stop-color="#fed7aa" />
    </linearGradient>
    <marker id="openArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#0f172a" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    </marker>
  </defs>

  <!-- Outer frame -->
  <rect x="12" y="12" width="956" height="896" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>

  <!-- Top-left tab -->
  <polygon points="12,12 ${tabW},12 ${tabW + 16},42 12,42" fill="#ffffff" stroke="#0f172a" stroke-width="2"/>
  <text x="24" y="32" font-size="14" font-weight="700" fill="#0f172a">${tabTitle}</text>

  <!-- System Boundary -->
  <rect x="190" y="52" width="630" height="848" fill="#ffffff" stroke="#94a3b8" stroke-width="1.8" rx="2"/>
  <text x="505" y="80" font-size="17" font-weight="600" fill="#1e293b" text-anchor="middle">System Boundary</text>

  ${data.actorsLeft.map(a => actorSvg(a, false)).join('\n')}
  ${data.actorsRight.map(a => actorSvg(a, true)).join('\n')}
  ${ovals}
  ${assocSvg}
  ${extendSvg}
</svg>`
}

function buildUseCaseDiagram(classes, projectName = 'System') {
  const data = extractUseCaseData(classes, projectName)
  const lines = [
    'flowchart LR',
    '    classDef actor fill:#ffedd5,stroke:#0f172a,stroke-width:2px,color:#0f172a',
    '    classDef uc fill:#fed7aa,stroke:#0f172a,stroke-width:2px,color:#0f172a',
    '',
  ]

  data.actorsLeft.forEach(a => {
    const aid = safeId(a.name)
    lines.push(`    ${aid}["👤 ${a.name}"]:::actor`)
  })
  data.actorsRight.forEach(a => {
    const aid = safeId(a.name)
    lines.push(`    ${aid}["👤 ${a.name}"]:::actor`)
  })

  lines.push(`    subgraph System_Boundary["System Boundary (${data.title})"]`)
  data.useCases.forEach(uc => {
    const cleanLbl = uc.label.replace('\n', ' ')
    lines.push(`        ${uc.id}(["${cleanLbl}"]):::uc`)
  })
  data.extensions.forEach(ext => {
    const condTxt = ext.condition ? `\\n${ext.condition}` : ''
    lines.push(`        ${data.useCases[1]?.id || 'UC2'} -. "<<extend>>${condTxt}" .-> ${data.useCases[0]?.id || 'UC1'}`)
  })
  lines.push('    end')

  data.associations.slice(0, 6).forEach(asc => {
    const aid = safeId(asc.actor)
    const targetUc = data.useCases.find(u => Math.abs(u.cy - asc.toY) < 50) || data.useCases[0]
    const labelTxt = asc.label ? `|"${asc.label}"|` : ''
    lines.push(`    ${aid} ---${labelTxt} ${targetUc.id}`)
  })

  return lines.join('\n')
}

function buildActivityDiagram(classes) {
  return FALLBACK_ACTIVITY
}

function buildDeploymentDiagram(classes) {
  return FALLBACK_DEPLOYMENT
}

function buildPackageDiagram(classes) {
  if (!classes || classes.length === 0) return FALLBACK_PACKAGE
  const packages = Array.from(new Set(classes.map(c => c.package).filter(Boolean)))
  if (packages.length === 0) return FALLBACK_PACKAGE

  const lines = ['flowchart TB']
  packages.slice(0, 8).forEach((pkg, idx) => {
    const pid = `P_${safeId(pkg)}`
    lines.push(`    subgraph ${pid}["package ${pkg}"]`)
    lines.push(`        N_${idx}["Components"]`)
    lines.push('    end')
  })
  if (packages.length >= 2) {
    lines.push(`    P_${safeId(packages[0])} ..>|«depends»| P_${safeId(packages[1])}`)
  }
  return lines.join('\n')
}

function buildClassDiagram(classes, projectName = 'System') {
  const profile = analyzeProjectDomain(classes, projectName)
  const cleanClasses = (classes || []).filter(c => {
    const cname = (c.class_name || '').toLowerCase()
    return !['vite', 'tailwind', 'config', 'slice', 'theme', 'tooltip', 'protected', 'route'].some(ign => cname.includes(ign))
  })

  if (cleanClasses.length < 2) {
    const lines = ['classDiagram']
    lines.push(`    class ${safeId(profile.superName)} {`)
    lines.push('        <<entity>>')
    profile.superAttrs.forEach(a => lines.push(`        ${a.replace(/^\+/, '+String ')}`))
    profile.superOps.forEach(o => lines.push(`        ${o}`))
    lines.push('    }')

    profile.subSpecs.forEach(sub => {
      const subId = safeId(sub.name)
      lines.push(`    class ${subId} {`)
      sub.attrs.forEach(a => lines.push(`        ${a.replace(/^\+/, '+String ')}`))
      sub.ops.forEach(o => lines.push(`        ${o}`))
      lines.push('    }')
      lines.push(`    ${safeId(profile.superName)} <|-- ${subId}`)
    })
    return lines.join('\n')
  }

  const lines = ['classDiagram']
  const knownNames = new Set(cleanClasses.map(c => c.class_name))
  const rels = []

  cleanClasses.slice(0, 15).forEach(cls => {
    const cid = safeId(cls.class_name)
    const st = getStereotype(cls)
    lines.push(`    class ${cid} {`)
    if (st) lines.push(`        <<${st}>>`)

    ;(cls.fields || []).slice(0, 6).forEach(f => {
      const vis = (f.modifiers || []).includes('public') ? '+' : '-'
      lines.push(`        ${vis}${safeType(f.field_type)} ${safeId(f.field_name)}`)
    })
    ;(cls.methods || []).slice(0, 8).forEach(m => {
      const vis = (m.modifiers || []).includes('public') ? '+' : '-'
      const params = (m.parameters || []).map(p => safeId(p.name || 'p')).join(' ')
      lines.push(`        ${vis}${safeId(m.method_name)}(${params}) ${safeType(m.return_type)}`)
    })
    lines.push('    }')

    if (cls.extends) rels.push(`    ${safeId(cls.extends)} <|-- ${cid}`)
    ;(cls.implements || []).forEach(i => rels.push(`    ${safeId(i)} <|.. ${cid}`))
    ;(cls.fields || []).forEach(f => {
      const bare = bareType(f.field_type)
      if (bare && knownNames.has(bare) && bare !== cls.class_name) {
        rels.push(`    ${cid} --> ${safeId(bare)} : ${safeId(f.field_name)}`)
      }
    })
  })

  lines.push(...rels)
  return lines.join('\n')
}
function buildSequenceDiagram(classes, projectName = 'System') {
  const profile = analyzeProjectDomain(classes, projectName)
  const endpoints = (classes || []).flatMap(c =>
    (c.methods || []).filter(m => m.is_endpoint).map(m => ({ ...m, class_name: c.class_name }))
  )

  if (endpoints.length === 0) {
    const p1 = profile.primaryActor
    const p2 = profile.engineName
    const p3 = profile.dbName
    const steps = profile.seqSteps
    return [
      'sequenceDiagram',
      '    autonumber',
      `    actor User as ${p1}`,
      `    participant Engine as ${p2}`,
      `    participant DB as ${p3}`,
      `    User->>Engine: ${steps[0]}`,
      '    activate Engine',
      `    Engine->>Engine: ${steps[1]}`,
      `    Engine-->>User: ${steps[2]}`,
      `    User->>Engine: ${steps[3]}`,
      `    Engine->>DB: ${steps[4]}`,
      '    activate DB',
      `    DB-->>Engine: ${steps[5]}`,
      '    deactivate DB',
      `    Engine-->>User: ${steps[6]}`,
      `    Engine->>DB: ${steps[7]}`,
      '    activate DB',
      `    DB-->>Engine: ${steps[8]}`,
      '    deactivate DB',
      `    Engine-->>User: ${steps[9]}`,
      '    deactivate Engine',
    ].join('\n')
  }

  const header = [
    'sequenceDiagram',
    '    autonumber',
    '    actor Client',
    '    participant Ctrl as REST Controller',
    '    participant Svc as Business Service',
    '    participant Repo as Data Repository',
    '    participant DB as Database',
  ]

  const body = []
  endpoints.slice(0, 3).forEach(ep => {
    const verb = (ep.http_method || 'GET').toUpperCase()
    const path = ep.endpoint_path || '/'
    const mname = safeId(ep.method_name)
    const rtype = safeType(ep.return_type || 'Response')
    body.push('')
    body.push(`    Note over Client,Ctrl: ${verb} ${path}`)
    body.push(`    Client->>Ctrl: ${verb} ${path}`)
    body.push('    activate Ctrl')
    body.push(`    Ctrl->>Svc: ${mname}()`)
    body.push('    activate Svc')
    body.push('    Svc->>Repo: findById() or executeQuery()')
    body.push('    activate Repo')
    body.push('    Repo->>DB: SQL Execution')
    body.push('    DB-->>Repo: Data Record')
    body.push('    deactivate Repo')
    body.push(`    Svc-->>Ctrl: ${rtype}`)
    body.push('    deactivate Svc')
    body.push(`    Ctrl-->>Client: 200 OK ${rtype}`)
    body.push('    deactivate Ctrl')
  })

  return [...header, ...body].join('\n')
}
function buildComponentDiagram(classes) {
  if (!classes || classes.length === 0) return FALLBACK_COMPONENT

  const ctrl = [], svc = [], repo = [], ent = []
  classes.forEach(cls => {
    const cid = safeId(cls.class_name)
    const st = getStereotype(cls)
    const entry = [cid, cls.class_name]
    if (st === 'controller') ctrl.push(entry)
    else if (st === 'service') svc.push(entry)
    else if (st === 'repository') repo.push(entry)
    else if (st === 'entity') ent.push(entry)
    else svc.push(entry)
  })

  const lines = [
    'flowchart TB',
    '    classDef ctrl fill:#0f2040,stroke:#22d3ee,stroke-width:2px,color:#fff',
    '    classDef svc  fill:#152b56,stroke:#a78bfa,stroke-width:2px,color:#fff',
    '    classDef repo fill:#1e3a6e,stroke:#f59e0b,stroke-width:2px,color:#fff',
    '    classDef ent  fill:#0a1628,stroke:#10b981,stroke-width:2px,color:#fff',
    '    subgraph Presentation_Layer[Presentation Layer]',
    ...(ctrl.length ? ctrl : [['DefaultCtrl', 'WebController']]).map(
      ([id, n]) => `        ${id}["${n} [controller]"]:::ctrl`
    ),
    '    end',
    '    subgraph Business_Layer[Business Logic Layer]',
    ...(svc.length ? svc : [['DefaultSvc', 'AppService']]).map(
      ([id, n]) => `        ${id}["${n} [service]"]:::svc`
    ),
    '    end',
    '    subgraph Persistence_Layer[Persistence Layer]',
    ...(repo.length ? repo : [['DefaultRepo', 'DataRepository']]).map(
      ([id, n]) => `        ${id}["${n} [repository]"]:::repo`
    ),
    ...(ent.length ? ent : []).map(
      ([id, n]) => `        ${id}["${n} [entity]"]:::ent`
    ),
    '    end',
  ]

  if (ctrl.length && svc.length) lines.push(`    ${ctrl[0][0]} --> ${svc[0][0]}`)
  if (svc.length && repo.length) lines.push(`    ${svc[0][0]} --> ${repo[0][0]}`)
  if (repo.length && ent.length) lines.push(`    ${repo[0][0]} --> ${ent[0][0]}`)

  return lines.join('\n')
}

// ── Universal Domain Semantic Profiler (Client-side) ─────────────────────────

function analyzeProjectDomain(classes = [], projectName = 'System') {
  const rawPname = (projectName || 'System').trim()
  const separated = rawPname.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  const cleanPname = separated.replace(/[^a-zA-Z0-9]+/g, ' ').trim()
  const ignored = new Set(['project', 'app', 'application', 'platform', 'system', 'service', 'v1', 'v2', 'master', 'main'])
  const words = cleanPname.split(/\s+/).filter(w => !ignored.has(w.toLowerCase()))

  const title = words.length > 0 ? cleanPname.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : 'System'
  const pascalName = words.length > 0 ? words.map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('') : 'System'

  const allTokens = new Set()
  cleanPname.toLowerCase().split(/\s+/).forEach(w => { if (w.length > 2) allTokens.add(w) })

  const extractedClasses = []
  ;(classes || []).forEach(c => {
    const cname = c.class_name || ''
    const fpath = (c.file_path || '').toLowerCase()
    const cleanCname = cname
      .replace(/(Controller|Service|Repository|Repo|Manager|Handler|Router|Endpoint|Schema|DTO|Entity|Impl)$/, '')
      .replace(/^(I|Base|Abstract)/, '')
    if (cleanCname && cleanCname.length >= 3 && !['app', 'main', 'index', 'database', 'db', 'config', 'test'].includes(cleanCname.toLowerCase())) {
      extractedClasses.push(cleanCname)
      allTokens.add(cleanCname.toLowerCase())
    }

    fpath.split(/[^a-zA-Z0-9]+/).forEach(tok => {
      if (tok.length >= 3 && !['src', 'main', 'java', 'app', 'api', 'routes', 'controllers', 'models', 'services'].includes(tok)) {
        allTokens.add(tok)
      }
    })

    ;(c.methods || []).forEach(m => {
      const mname = m.method_name || ''
      const cleanM = mname.replace(/^(get|post|put|delete|patch|handle|find|create|update|set|on)_?/i, '')
      if (cleanM && cleanM.length >= 3) allTokens.add(cleanM.toLowerCase())
    })

    ;(c.fields || []).forEach(f => {
      const fname = f.field_name || ''
      if (fname && fname.length >= 3) allTokens.add(fname.toLowerCase())
    })
  })

  const pLower = cleanPname.toLowerCase()
  const pWords = new Set(pLower.split(/\s+/))
  const hasIntersection = (tokenSet, testArray) => testArray.some(k => tokenSet.has(k))

  const cliKeywords = ['cli', 'commandline', 'posix', 'option', 'options', 'helpformatter', 'commandlineparser', 'optgroup', 'basicparser', 'defaultparser']
  const isCli = hasIntersection(allTokens, cliKeywords) || pWords.has('cli') || pWords.has('command') || pLower.includes('commons-cli') || pLower.includes('cli')

  const csvKeywords = ['csv', 'tsv', 'delimited', 'csvrecord', 'csvparser', 'csvformat', 'csvprinter', 'extendedbufferedreader']
  const isCsv = (hasIntersection(allTokens, csvKeywords) || pWords.has('csv') || pLower.includes('commons-csv')) && !isCli

  const vulnKeywords = ['vul4j', 'vulnerability', 'vulnerabilities', 'cve', 'patchminer', 'patchcandidate', 'evaluationtarget', 'exploit']
  const isVuln = hasIntersection(allTokens, vulnKeywords) || pLower.includes('vul4j') || pLower.includes('vuln')

  const collabKeywords = ['collaborative', 'collab', 'whiteboard', 'canvas', 'socket', 'realtime']
  const isCollab = hasIntersection(allTokens, collabKeywords) || pWords.has('collaborative') || pWords.has('workspace')

  const resumeKeywords = ['resume', 'cv', 'candidate', 'applicant', 'job_opening', 'recruit', 'shortlist', 'interview', 'hire', 'hiring', 'screening', 'selection', 'ats', 'job']
  const isResume = (hasIntersection(allTokens, resumeKeywords) || pWords.has('resume') || pWords.has('ats') || pLower.includes('ats')) && !isCli && !isCsv && !isVuln

  const empKeywords = ['employee', 'employees', 'staff', 'payroll', 'salary', 'salaries', 'department', 'attendance', 'workforce', 'human_resource', 'timesheet', 'appraisal']
  const isEmployee = (hasIntersection(allTokens, empKeywords) || ['employee', 'employees', 'payroll', 'salary', 'hr', 'workforce'].some(k => pWords.has(k))) && !isCli && !isCsv && !isVuln && !isResume

  const learningKeywords = ['quiz', 'student', 'education', 'tutorial', 'lesson', 'submission', 'exam', 'grade', 'faculty', 'school']
  const isLearning = (hasIntersection(allTokens, learningKeywords) || pWords.has('learning') || pWords.has('education')) && !isResume && !isEmployee && !isCli

  const emotionKeywords = ['emotion', 'mood', 'facial', 'face', 'webcam', 'camera', 'playlist', 'expression', 'vision', 'audio', 'sentiment']
  const isEmotion = (hasIntersection(allTokens, emotionKeywords) || pWords.has('emotion')) && !isCli && !isCsv

  const foodKeywords = ['pizza', 'food_order', 'restaurant', 'dish', 'dining', 'waiter', 'kitchen_order', 'recipe', 'catering', 'food_delivery']
  const isFood = (hasIntersection(allTokens, foodKeywords) || pWords.has('pizza') || pWords.has('food') || pWords.has('restaurant')) && !isEmployee && !isCli

  const healthKeywords = ['health', 'patient', 'doctor', 'hospital', 'clinic', 'medical', 'prescription', 'diagnosis', 'appointment', 'ehr', 'vital', 'nurse']
  const isHealth = hasIntersection(allTokens, healthKeywords) || pWords.has('health') || pWords.has('hospital') || pWords.has('clinic')

  const financeKeywords = ['bank', 'banking', 'finance', 'loan', 'deposit', 'transfer', 'wallet', 'crypto', 'ledger', 'credit', 'tax', 'billing', 'expense', 'expenses', 'budget', 'spending']
  const isFinance = (hasIntersection(allTokens, financeKeywords) || pWords.has('expense') || pWords.has('tracker')) && !isFood && !isResume && !isEmployee && !isCli

  const ecommerceKeywords = ['shop', 'store', 'product', 'ecommerce', 'cart', 'checkout', 'shipping', 'merchandise']
  const isEcommerce = (hasIntersection(allTokens, ecommerceKeywords) || pWords.has('shop') || pWords.has('store') || pWords.has('ecommerce')) && !isFood && !isResume && !isEmployee && !isCli

  let archetype = 'custom_domain'
  let primaryActor = 'ClientUser'
  let adminActor = 'SystemAdmin'
  let engineName = 'CoreEngine'
  let dbName = 'PrimaryDB'
  let containerName = `${pascalName}System`
  let superName = 'BaseEntity'
  let superAttrs = ['+id: String', '+createdAt: DateTime']
  let superOps = ['+validate()', '+process()']
  let subSpecs = []
  let compNames = []
  let seqSteps = []
  let activity = {}
  let packages = {}
  let deploy = {}

  if (isCli) {
    archetype = 'cli_parser'
    primaryActor = 'CLI Application / Developer'
    adminActor = 'System Terminal / Shell'
    engineName = 'CommandLineParser'
    dbName = 'OptionsRegistry'
    containerName = pascalName ? `${pascalName}ParserSystem` : 'CommandLineParserSystem'
    superName = 'CommandLineParser'
    superAttrs = ['+options: Options', '+cmd: CommandLine', '+stopAtNonOption: Boolean']
    superOps = ['+parse(options, args): CommandLine', '+processOption(opt, iter)', '+validateOptionGroup()']
    subSpecs = [
      { name: 'DefaultParser', attrs: ['+stripLeadingHyphens: Boolean', '+expectedArgs: Int'], ops: ['+handleConcatenatedOptions()', '+checkRequiredOptions()'] },
      { name: 'Option', attrs: ['+opt: String', '+longOpt: String', '+required: Boolean', '+hasArg: Boolean'], ops: ['+addValue(val)', '+hasArgs(): Boolean'] },
      { name: 'CommandLine', attrs: ['+args: List<String>', '+options: List<Option>'], ops: ['+hasOption(opt): Boolean', '+getOptionValue(opt): String'] },
    ]
    compNames = ['DefaultParser', 'CommandLine', 'Options', 'HelpFormatter']
    seqSteps = [
      '1: Initialize CLI Options Specification',
      '2: Define Option Flags & Arguments',
      '3: Supply Command Line Arguments',
      '4: Invoke CommandLineParser.parse()',
      '5: Validate Option Constraints & Groups',
      '6: Return Parsed CommandLine Instance',
      '7: Query Option Flags & Values',
      '8: Format Console Usage Help Guide',
      '9: Output Diagnostic Parsing Summary',
      '10: Deliver Final Execution Configuration',
    ]
    activity = {
      act1: 'Receive Command Line Arguments',
      actBranchLeft: 'Parse & Validate Option Tokens',
      guardCond: '[valid syntax & arguments]',
      actLeft1: 'Populate CommandLine State',
      actLeft2: 'Trigger ParseException Handling',
      actBranchRight1: 'Format Usage Help Guide',
      actBranchRight2: 'Output Console Diagnostics',
      finalMsg: 'CLI Argument Parsing Completed',
    }
    packages = {
      top: ['CLI Client Application', 'Shell / Terminal Interface', 'Console Input Gateway', 'Argument Dispatcher'],
      middle: ['Parser Engine (DefaultParser)', 'Option Model (Options, OptionGroup)'],
      bottom: ['CommandLine Result Store', 'HelpFormatter Subsystem'],
    }
    deploy = {
      client: 'Terminal / Shell Environment',
      gateway: 'CLI Command Ingestion',
      appServer: 'Java Virtual Machine (JVM)',
      worker: 'Parser & Validation Engine',
      db: 'In-Memory Options Registry',
      cache: 'Parsed Arguments Cache',
    }
  } else if (isCsv) {
    archetype = 'csv_processor'
    primaryActor = 'Data Ingestion Client'
    adminActor = 'File Stream / Input Source'
    engineName = 'CSVParser'
    dbName = 'TabularRecordStore'
    containerName = pascalName ? `${pascalName}System` : 'CommonsCSVProcessingSystem'
    superName = 'CSVFormat'
    superAttrs = ['+delimiter: Char', '+quoteChar: Character', '+header: List<String>', '+ignoreEmptyLines: Boolean']
    superOps = ['+parse(reader): CSVParser', '+format(values): String', '+withHeader(names): CSVFormat']
    subSpecs = [
      { name: 'CSVParser', attrs: ['+recordNumber: Long', '+characterPosition: Long'], ops: ['+getRecords(): List<CSVRecord>', '+iterator()', '+getHeaderNames()'] },
      { name: 'CSVRecord', attrs: ['+mapping: Map', '+values: String[]', '+comment: String'], ops: ['+get(name): String', '+size(): Int', '+isConsistent(): Boolean'] },
      { name: 'CSVPrinter', attrs: ['+out: Appendable', '+format: CSVFormat'], ops: ['+printRecord(values)', '+flush()'] },
    ]
    compNames = ['CSVParser', 'CSVRecord', 'CSVFormat', 'CSVPrinter']
    seqSteps = [
      '1: Configure CSVFormat & Delimiters',
      '2: Initialize Character Reader & Lexer',
      '3: Open CSV Input Stream / Source',
      '4: Invoke CSVParser.parse()',
      '5: Tokenize Delimited Character Stream',
      '6: Return Structured CSVRecord Stream',
      '7: Iterate Records & Extract Column Values',
      '8: Format & Print CSV Output Rows',
      '9: Flush Formatted Record Buffer',
      '10: Deliver Processed Tabular Dataset',
    ]
    activity = {
      act1: 'Ingest Raw Tabular Stream',
      actBranchLeft: 'Tokenize & Delimit Records',
      guardCond: '[valid row syntax]',
      actLeft1: 'Extract CSVRecord Columns',
      actLeft2: 'Throw Malformed CSV Exception',
      actBranchRight1: 'Map Column Header Metadata',
      actBranchRight2: 'Stream Formatted Output Records',
      finalMsg: 'CSV Processing Completed',
    }
    packages = {
      top: ['Data Processing Client', 'Tabular Ingestion Stream', 'File Source Gateway', 'Export Channel'],
      middle: ['CSV Parsing Engine', 'Lexer & Tokenizer Subsystem'],
      bottom: ['CSVRecord Data Model', 'CSVPrinter Output Module'],
    }
    deploy = {
      client: 'Client Ingestion Application',
      gateway: 'File / I/O Stream Gateway',
      appServer: 'Java Virtual Machine (JVM)',
      worker: 'Lexer & Tokenizer Worker',
      db: 'Tabular File System Storage',
      cache: 'Record Stream Buffer',
    }
  } else if (isVuln) {
    archetype = 'vulnerability_benchmark'
    primaryActor = 'Security Researcher'
    adminActor = 'Automated Test Runner'
    engineName = 'PatchMiner'
    dbName = 'VulnerabilityBenchmarkDB'
    containerName = pascalName ? `${pascalName}System` : 'VUL4JSecurityBenchmarkSystem'
    superName = 'EvaluationTarget'
    superAttrs = ['+vulId: String', '+cveId: String', '+project: String', '+vulnerableCommit: String']
    superOps = ['+checkoutRevision()', '+executeTestHarness()', '+evaluateMitigation()']
    subSpecs = [
      { name: 'PatchMiner', attrs: ['+repoDir: Path', '+targetCommit: String'], ops: ['+extractModifications(): ExtractedData', '+minePatchCandidates()'] },
      { name: 'ExtractedData', attrs: ['+modifiedFiles: List<String>', '+astDiffs: List<String>'], ops: ['+getASTNodes()', '+exportDossier()'] },
      { name: 'GitUtils', attrs: ['+workingDir: Path', '+gitBinary: String'], ops: ['+checkout(commit)', '+getDiff(c1, c2)'] },
    ]
    compNames = ['PatchMiner', 'ExtractedData', 'GitUtils', 'PatchCandidate']
    seqSteps = [
      '1: Query Vulnerability CVE Benchmark',
      '2: Retrieve Target Flaw Metadata',
      '3: Request Target Code Checkout',
      '4: Checkout Vulnerable Git Revision',
      '5: Extract AST Patch Modifications',
      '6: Return Extracted Modification State',
      '7: Execute Benchmark Vulnerability Tests',
      '8: Validate Patch Mitigation Outcome',
      '9: Persist Evaluation Benchmark Record',
      '10: Deliver Security Dataset Dossier',
    ]
    activity = {
      act1: 'Ingest Vulnerability Target',
      actBranchLeft: 'Extract AST Modifications',
      guardCond: '[reproduction verified]',
      actLeft1: 'Execute Mitigation Test Suite',
      actLeft2: 'Flag Inconclusive Reproduction',
      actBranchRight1: 'Record CVE Benchmark Metrics',
      actBranchRight2: 'Export Security Evaluation Report',
      finalMsg: 'Vulnerability Benchmark Analysis Completed',
    }
    packages = {
      top: ['Researcher CLI / Notebook', 'Benchmark Runner API', 'Git Repository Gateway', 'Dataset Ingestion'],
      middle: ['Patch Miner Engine', 'AST Modification Extractor'],
      bottom: ['Git Repository Worktree', 'Vulnerability Benchmark Store'],
    }
    deploy = {
      client: 'Security Researcher Terminal',
      gateway: 'Benchmark API Gateway',
      appServer: 'Python / Java Analysis Engine',
      worker: 'Patch Mining & Testing Worker',
      db: 'CVE Benchmark Dataset Store',
      cache: 'Git Object Cache / Worktree',
    }
  } else if (isCollab) {
    archetype = 'collaborative_workspace'
    primaryActor = 'Workspace Member'
    adminActor = 'Workspace Admin'
    engineName = 'CollaborationEngine'
    dbName = 'WorkspaceDocumentStore'
    containerName = pascalName ? `${pascalName}System` : 'CollaborativeWorkspaceSystem'
    superName = 'WorkspaceDocument'
    superAttrs = ['+docId: String', '+title: String', '+ownerId: String', '+revision: Long']
    superOps = ['+applyMutation(delta)', '+getSnapshot()', '+broadcastPresence()']
    subSpecs = [
      { name: 'CanvasElement', attrs: ['+elementId: String', '+type: String', '+coordinates: Point'], ops: ['+updateBounds()', '+lock()'] },
      { name: 'CollaborationSession', attrs: ['+sessionId: String', '+activeMembers: List'], ops: ['+join(user)', '+leave(user)'] },
      { name: 'UserPresence', attrs: ['+userId: String', '+cursorX: Int', '+cursorY: Int'], ops: ['+updateCursor(x, y)'] },
    ]
    compNames = ['CollaborationEngine', 'WorkspaceDocument', 'CanvasElement', 'UserPresence']
    seqSteps = [
      '1: Connect to Realtime Workspace',
      '2: Authenticate Member Token',
      '3: Join Collaborative Room Session',
      '4: Broadcast Live Presence State',
      '5: Ingest Document Canvas Mutation',
      '6: Resolve Operational Transformation',
      '7: Sync Mutated State to Active Peers',
      '8: Persist Revision to Workspace DB',
      '9: Return Synchronization Receipt',
      '10: Deliver Realtime Stream Updates',
    ]
    activity = {
      act1: 'Ingest Member Action Event',
      actBranchLeft: 'Resolve Concurrent Edits',
      guardCond: '[conflict detected]',
      actLeft1: 'Apply Operational Transform',
      actLeft2: 'Apply Direct Mutation',
      actBranchRight1: 'Broadcast Webhook / Socket Frame',
      actBranchRight2: 'Update Member Presence Heartbeat',
      finalMsg: 'Realtime Sync Event Finalized',
    }
    packages = {
      top: ['Collaborator Web UI', 'Mobile Canvas Client', 'WebSocket Gateway', 'Presence Hub'],
      middle: ['Operational Transform Engine', 'Document Synchronization Service'],
      bottom: ['Workspace Repository', 'Realtime Snapshot DB'],
    }
    deploy = {
      client: 'Collaborator Web / Canvas Client',
      gateway: 'WebSocket / Edge Gateway',
      appServer: 'Node.js / Express Core Server',
      worker: 'Realtime Sync & Diff Worker',
      db: 'MongoDB Document Store',
      cache: 'Redis Pub/Sub State Engine',
    }
  } else if (isEmployee) {
    archetype = 'employee_management'
    primaryActor = 'Employee'
    adminActor = 'HR / Department Manager'
    engineName = 'WorkforceService'
    dbName = 'EmployeeDatabase'
    containerName = pascalName ? `${pascalName}System` : 'EmployeeManagementSystem'
    superName = 'Employee'
    superAttrs = ['+employeeId: String', '+fullName: String', '+email: String', '+departmentId: String', '+position: String', '+status: String']
    superOps = ['+getDetails()', '+updateProfile()', '+viewPayroll()']
    subSpecs = [
      { name: 'Department', attrs: ['+deptId: String', '+name: String', '+managerId: String'], ops: ['+assignEmployee()', '+getStaffList()'] },
      { name: 'Salary', attrs: ['+salaryId: String', '+baseSalary: Double', '+netSalary: Double'], ops: ['+calculateNetSalary()', '+generatePaySlip()'] },
      { name: 'Performance', attrs: ['+reviewId: String', '+rating: Float', '+feedback: String'], ops: ['+submitReview()', '+getAppraisalScore()'] },
    ]
    compNames = ['EmployeeService', 'DepartmentService', 'SalaryService', 'PerformanceService']
    seqSteps = [
      '1: Log In to Employee Portal',
      '2: Authenticate Role Credentials',
      '3: Request Employee Profile & Records',
      '4: Validate Department Assignment',
      '5: Query Employee & Salary Database',
      '6: Return Profile & Compensation Record',
      '7: Display Employee Dashboard Analytics',
      '8: Persist Performance & Payroll Update',
      '9: Database Transaction Receipt',
      '10: Deliver Workforce Status Summary',
    ]
    activity = {
      act1: 'Authenticate Employee Credentials',
      actBranchLeft: 'Process Workforce Records',
      guardCond: '[is HR Admin / Manager]',
      actLeft1: 'Update Department & Compensation',
      actLeft2: 'View Personal Profile & Paystub',
      actBranchRight1: 'Calculate Performance Appraisal',
      actBranchRight2: 'Audit Employee Log Records',
      finalMsg: 'Employee Profile Sync Completed',
    }
    packages = {
      top: ['Employee Web UI', 'HR Admin Terminal', 'Auth Service Gateway', 'API Gateway'],
      middle: ['Employee Management Controller', 'Salary & Payroll Engine', 'Department Service'],
      bottom: ['Employee Repository', 'Company MongoDB Database'],
    }
    deploy = {
      client: 'Employee / HR Browser UI',
      gateway: 'API Gateway / Nginx',
      appServer: 'Employee Management Express Server',
      worker: 'Payroll & Performance Worker',
      db: 'MongoDB Database Node',
      cache: 'Session Store / Redis',
    }
  } else if (isResume) {
    archetype = 'recruitment'
    primaryActor = 'Candidate'
    adminActor = 'Recruiter'
    engineName = 'ResumeParser'
    dbName = 'CandidateDB'
    containerName = pascalName ? `${pascalName}Engine` : 'ResumeShortlistingEngine'
    superName = 'CandidateProfile'
    superAttrs = ['+candidateId: String', '+fullName: String', '+email: String', '+experienceYears: Int']
    superOps = ['+extractSkills(): List', '+evaluateMatch(): Float', '+submitApplication()']
    subSpecs = [
      { name: 'TechnicalCandidate', attrs: ['+githubUrl: String', '+techStack: List<String>'], ops: ['+verifyCodeRepos()', '+computeSkillRank()'] },
      { name: 'ManagementCandidate', attrs: ['+leadershipYears: Int', '+certifications: List'], ops: ['+verifyCredentials()', '+calculateFit()'] },
      { name: 'ShortlistedCandidate', attrs: ['+matchScore: Float', '+status: String'], ops: ['+scheduleInterview()', '+exportDossier()'] },
    ]
    compNames = ['ResumeParser', 'Candidate', 'JobDescription', 'ShortlistStore']
    seqSteps = [
      '1: Ingest Resume & Job Specs',
      '2: Parse & Extract Key Skills',
      '3: Request Profile Verification',
      '4: Confirm Credentials & Experience',
      '5: Query Candidate Match Benchmark',
      '6: Return Match Benchmark Record',
      '7: Display Match Score & Summary',
      '8: Persist Evaluation & Status',
      '9: Acknowledge Candidate Record',
      '10: Deliver Shortlist Decision',
    ]
    activity = {
      act1: 'Ingest Resume Application',
      actBranchLeft: 'Evaluate Qualifications',
      guardCond: '[match score >= 75%]',
      actLeft1: 'Add to Shortlist Dossier',
      actLeft2: 'Flag for Manual Review',
      actBranchRight1: 'Verify Candidate Details',
      actBranchRight2: 'Notify Hiring Team',
      finalMsg: 'Candidate Dossier Finalized',
    }
    packages = {
      top: ['Candidate Portal', 'Recruiter Portal', 'Resume Ingestion API', 'Job Match Gateway'],
      middle: ['Parsing Engine', 'Shortlist Evaluator'],
      bottom: ['Candidate Repository', 'Shortlist Database'],
    }
    deploy = {
      client: 'Candidate / Recruiter UI',
      gateway: 'Internet / API Gateway',
      appServer: 'Resume Analysis Service',
      worker: 'NLP Parsing Worker',
      db: 'Candidate Database Node',
      cache: 'Caching Server / Redis',
    }
  } else if (isEmotion) {
    archetype = 'emotion_learning'
    primaryActor = 'Student'
    adminActor = 'Instructor'
    engineName = 'EmotionEngine'
    dbName = 'EmotionTelemetryDB'
    containerName = pascalName ? `${pascalName}Engine` : 'EmotionLearningEngine'
    superName = 'LearningSession'
    superAttrs = ['+sessionId: String', '+studentId: String', '+timestamp: DateTime']
    superOps = ['+startSession()', '+computeTelemetry()', '+terminateSession()']
    subSpecs = [
      { name: 'FacialDetectionSession', attrs: ['+confidence: Float', '+primaryEmotion: String'], ops: ['+processFrame()', '+detectLandmarks()'] },
      { name: 'AdaptivePlaylistSession', attrs: ['+moodCategory: String', '+tempoScore: Float'], ops: ['+generateTrackList()', '+adaptDifficulty()'] },
      { name: 'TelemetryAuditSession', attrs: ['+durationSeconds: Int', '+anomalyCount: Int'], ops: ['+exportTelemetry()', '+notifyInstructor()'] },
    ]
    compNames = ['EmotionDetector', 'Student', 'AdaptiveContent', 'PlaylistStore']
    seqSteps = [
      '1: Open Learning Application',
      '2: Initialize Camera & Webcams',
      '3: Capture Live Video Frame',
      '4: Detect Facial Expression',
      '5: Query Emotion Benchmark DB',
      '6: Return Emotion Benchmark Record',
      '7: Display Realtime Mood Telemetry',
      '8: Query Adaptive Audio Catalog',
      '9: Return Recommended Playlist',
      '10: Stream Personalized Audio Content',
    ]
    activity = {
      act1: 'Capture Webcam Video Frame',
      actBranchLeft: 'Neural Emotion Inference',
      guardCond: '[focus score < threshold]',
      actLeft1: 'Trigger Soothing Audio Adaptation',
      actLeft2: 'Maintain Current Pace Content',
      actBranchRight1: 'Extract Facial Expression Landmarks',
      actBranchRight2: 'Log Realtime Affective Telemetry',
      finalMsg: 'Affective Learning Loop Updated',
    }
    packages = {
      top: ['Student UI App', 'Webcam Streamer', 'Emotion Inference API', 'Audio Catalog Gateway'],
      middle: ['Affective Engine', 'Difficulty Recommender'],
      bottom: ['Student Repository', 'Telemetry Database'],
    }
    deploy = {
      client: 'Student Webcam Browser',
      gateway: 'Internet / WebRTC Gateway',
      appServer: 'Emotion Analysis Service',
      worker: 'Vision Neural Net Worker',
      db: 'Learner Telemetry DB',
      cache: 'Caching Server / Redis',
    }
  } else if (isFood) {
    archetype = 'food_delivery'
    primaryActor = 'Customer'
    adminActor = 'Kitchen Manager'
    engineName = 'KitchenOrderEngine'
    dbName = 'RestaurantDB'
    containerName = pascalName ? `${pascalName}Platform` : 'SmartPizzaPlatform'
    superName = 'MenuItem'
    superAttrs = ['+itemId: String', '+name: String', '+price: Double']
    superOps = ['+getDetails()', '+calculateSubtotal()']
    subSpecs = [
      { name: 'PizzaOrder', attrs: ['+crustType: String', '+toppings: List<String>'], ops: ['+addTopping()', '+bakeOrder()'] },
      { name: 'BeverageOrder', attrs: ['+volumeMl: Int', '+isChilled: Boolean'], ops: ['+dispenseDrink()'] },
      { name: 'DeliveryPackage', attrs: ['+trackingNumber: String', '+driverId: String'], ops: ['+assignCourier()', '+trackLocation()'] },
    ]
    compNames = ['OrderProcessor', 'Customer', 'MenuItem', 'KitchenStore']
    seqSteps = [
      '1: Browse Restaurant Menu Items',
      '2: Add Customized Pizza to Cart',
      '3: Request Delivery Address Validation',
      '4: Confirm Delivery Zone Feasibility',
      '5: Query Kitchen Order Inventory',
      '6: Confirm Ingredient Availability',
      '7: Display Payment & Total Quote',
      '8: Authorize Transaction with Gateway',
      '9: Persist Confirmed Order in Kitchen',
      '10: Dispatch Live Courier Tracking',
    ]
    activity = {
      act1: 'Receive Customer Order Request',
      actBranchLeft: 'Verify Kitchen Capacity',
      guardCond: '[priority expedited delivery]',
      actLeft1: 'Fast-Track In Oven Line',
      actLeft2: 'Standard Queue In Oven',
      actBranchRight1: 'Charge Credit Card / Wallet',
      actBranchRight2: 'Print Kitchen Prep Ticket',
      finalMsg: 'Pizza Order Dispatched to Courier',
    }
    packages = {
      top: ['Customer Mobile App', 'Web Ordering Portal', 'Payment Ingestion API', 'Courier Dispatch Gateway'],
      middle: ['Order Processing Engine', 'Kitchen Dispatch Service'],
      bottom: ['Order Repository', 'Inventory Database'],
    }
    deploy = {
      client: 'Customer Mobile App',
      gateway: 'Internet / Order Gateway',
      appServer: 'Order Fulfillment Core',
      worker: 'Kitchen Routing Dispatcher',
      db: 'Restaurant Database Cluster',
      cache: 'Caching Server / Redis',
    }
  } else if (isHealth) {
    archetype = 'healthcare'
    primaryActor = 'Patient'
    adminActor = 'Chief Medical Officer'
    engineName = 'ClinicalDiagnosticEngine'
    dbName = 'EHR_Database'
    containerName = pascalName ? `${pascalName}EHR` : 'ClinicalHealthSystem'
    superName = 'MedicalRecord'
    superAttrs = ['+recordId: String', '+patientId: String', '+bloodType: String']
    superOps = ['+computeVitals()', '+evaluateRiskScore()']
    subSpecs = [
      { name: 'InpatientRecord', attrs: ['+roomNumber: String', '+attendingDoctor: String'], ops: ['+assignBed()', '+scheduleRounds()'] },
      { name: 'DiagnosticLabRecord', attrs: ['+specimenType: String', '+isUrgent: Boolean'], ops: ['+runBiochemicalScreen()'] },
      { name: 'PrescriptionRecord', attrs: ['+medicationName: String', '+dosageMg: Double'], ops: ['+verifyAllergies()', '+dispenseMedication()'] },
    ]
    compNames = ['ClinicalDiagnostics', 'Patient', 'MedicalChart', 'EHR_Store']
    seqSteps = [
      '1: Patient Check-In & Triage',
      '2: Record Vital Signs & Symptoms',
      '3: Request Diagnostic Protocol',
      '4: Confirm Patient Medical History',
      '5: Query Electronic Health Record',
      '6: Return Past Diagnostic History',
      '7: Display Physician Dashboard',
      '8: Authorize Treatment & Prescription',
      '9: Acknowledge Clinical Update',
      '10: Issue Patient Discharge Plan',
    ]
    activity = {
      act1: 'Receive Clinical Intake',
      actBranchLeft: 'Perform Lab Diagnostics',
      guardCond: '[urgent critical care]',
      actLeft1: 'Route to Intensive Care Unit',
      actLeft2: 'Schedule Outpatient Therapy',
      actBranchRight1: 'Authorize Medical Prescription',
      actBranchRight2: 'Update Electronic Health Record',
      finalMsg: 'Patient Care Plan Executed',
    }
    packages = {
      top: ['Patient Portal', 'Physician Terminal', 'Lab Ingestion API', 'Emergency Gateway'],
      middle: ['Diagnostic Engine', 'Prescription Service'],
      bottom: ['Medical Repository', 'EHR Database Cluster'],
    }
    deploy = {
      client: 'Hospital Clinic Terminal',
      gateway: 'Internet / HIPAA Gateway',
      appServer: 'EHR Clinical Core Server',
      worker: 'Diagnostic Analytics Worker',
      db: 'Encrypted EHR Database',
      cache: 'Caching Server / Redis',
    }
  } else if (isEcommerce) {
    archetype = 'ecommerce'
    primaryActor = 'Customer'
    adminActor = 'StoreAdmin'
    engineName = 'OrderEngine'
    dbName = 'StoreDB'
    containerName = pascalName ? `${pascalName}System` : 'OnlineStoreSystem'
    superName = 'CatalogProduct'
    superAttrs = ['+sku: String', '+title: String', '+price: Double', '+inStock: Boolean']
    superOps = ['+checkInventory()', '+applyDiscount()', '+calculateTax()']
    subSpecs = [
      { name: 'PhysicalProduct', attrs: ['+weightKg: Double', '+dimensions: String'], ops: ['+calculateShipping()', '+reserveWarehouseSlot()'] },
      { name: 'DigitalProduct', attrs: ['+downloadUrl: String', '+licenseKey: String'], ops: ['+generateLicense()', '+revokeAccess()'] },
      { name: 'SubscriptionProduct', attrs: ['+renewalPeriod: String', '+isAutoRenew: Boolean'], ops: ['+billCycle()', '+cancelSubscription()'] },
    ]
    compNames = ['OrderProcessor', 'Customer', 'ProductCatalog', 'InventoryStore']
    seqSteps = [
      '1: Browse Product Catalog',
      '2: Add Item to Shopping Cart',
      '3: Request Inventory Reservation',
      '4: Confirm Stock Availability',
      '5: Query Customer Account Profile',
      '6: Return Saved Billing / Shipping',
      '7: Display Order Summary & Tax',
      '8: Process Payment Transaction',
      '9: Persist Purchase Order Record',
      '10: Confirm Order & Deliver Receipt',
    ]
    activity = {
      act1: 'Receive Order Request',
      actBranchLeft: 'Fill Order from Inventory',
      guardCond: '[rush priority order]',
      actLeft1: 'Arrange Overnight Delivery',
      actLeft2: 'Arrange Regular Delivery',
      actBranchRight1: 'Send Invoice to Customer',
      actBranchRight2: 'Receive Payment Authorization',
      finalMsg: 'Order Fulfillment Completed',
    }
    packages = {
      top: ['Web Storefront', 'Mobile Shopping App', 'Checkout API Gateway', 'Payment Gateway'],
      middle: ['Order Processing Engine', 'Inventory Service'],
      bottom: ['Order Repository', 'Product Database'],
    }
    deploy = {
      client: 'Customer Browser / App',
      gateway: 'Internet / API Gateway',
      appServer: 'E-Commerce Core Server',
      worker: 'Inventory & Dispatch Worker',
      db: 'Orders Database Cluster',
      cache: 'Caching Server / Redis',
    }
  } else {
    archetype = 'custom_domain'
    const pConcept = words.length > 0 ? words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase() : 'Domain'
    const sConcept = words.length > 1 ? words[1].charAt(0).toUpperCase() + words[1].slice(1).toLowerCase() : 'Resource'
    const tConcept = words.length > 2 ? words[2].charAt(0).toUpperCase() + words[2].slice(1).toLowerCase() : 'Manager'

    const topClasses = extractedClasses.slice(0, 4)
    const c1 = topClasses[0] || `${pConcept}Model`
    const c2 = topClasses[1] || `${sConcept}Entity`
    const c3 = topClasses[2] || `${tConcept}Record`
    const c4 = topClasses[3] || `${pConcept}Store`

    const engineCandidates = extractedClasses.filter(c => /service|parser|engine|controller|manager|handler|processor|miner|runner|builder|factory/i.test(c))
    engineName = engineCandidates[0] || (pascalName ? `${pascalName}Engine` : 'CoreEngine')

    const entityCandidates = extractedClasses.filter(c => /model|entity|record|data|item|entry|info|target|format|config/i.test(c))
    superName = entityCandidates[0] || c1

    const dbCandidates = extractedClasses.filter(c => /repository|repo|store|db|dao|registry|cache|source/i.test(c))
    dbName = dbCandidates[0] || (pascalName ? `${pascalName}Database` : 'DataStore')

    primaryActor = pascalName ? `${pascalName} Client` : 'ClientUser'
    adminActor = pascalName ? `${pConcept} Supervisor` : 'SystemAdmin'
    containerName = pascalName ? `${pascalName}System` : 'CoreSystem'

    superAttrs = ['+id: String', '+status: String', '+createdAt: DateTime']
    superOps = ['+validate()', '+executeOperation()']
    subSpecs = [
      { name: c1, attrs: ['+name: String', '+priority: Int'], ops: ['+process()', '+updateState()'] },
      { name: c2, attrs: ['+value: Double', '+isVerified: Boolean'], ops: ['+evaluate()'] },
      { name: c3, attrs: ['+referenceCode: String', '+summary: String'], ops: ['+generateReport()'] },
    ]
    compNames = [c1, engineName, c2, c4]
    seqSteps = [
      `1: Ingest ${pConcept} Request`,
      `2: Validate ${pConcept} Payload`,
      `3: Request Client Parameters`,
      `4: Invoke ${engineName}.process()`,
      `5: Query ${dbName} Records`,
      `6: Return ${superName} State Data`,
      '7: Display Processing Feedback',
      `8: Persist Transaction to ${dbName}`,
      '9: Transaction Confirmation Receipt',
      `10: Deliver Final ${pConcept} Result`,
    ]
    activity = {
      act1: `Ingest ${pConcept} Request`,
      actBranchLeft: `Process ${sConcept} Rules`,
      guardCond: '[validation successful]',
      actLeft1: `Execute ${engineName} Pipeline`,
      actLeft2: 'Trigger Exception Handling',
      actBranchRight1: 'Audit System Telemetry',
      actBranchRight2: 'Notify System Administrator',
      finalMsg: `${pConcept} Workflow Completed`,
    }
    packages = {
      top: [`${pConcept} Client API`, `${sConcept} Ingestion`, 'API Gateway', 'External Connectors'],
      middle: [`${engineName} Core`, `${sConcept} Service`],
      bottom: [`${dbName} Store`, 'System Cache'],
    }
    deploy = {
      client: `${pConcept} Client / Device`,
      gateway: 'Internet / API Gateway',
      appServer: `${engineName} Host Runtime`,
      worker: `${pConcept} Worker Engine`,
      db: `${dbName} Node`,
      cache: 'Caching Server / Redis',
    }
  }

  // If real AST parsed classes exist, overlay them
  if (extractedClasses.length >= 2 && archetype !== 'custom_domain') {
    if (extractedClasses[0]) subSpecs[0].name = extractedClasses[0]
    if (extractedClasses[1]) subSpecs[1].name = extractedClasses[1]
    if (extractedClasses[2] && subSpecs[2]) subSpecs[2].name = extractedClasses[2]
  }

  return {
    title,
    pascalName,
    archetype,
    primaryActor,
    adminActor,
    engineName,
    dbName,
    containerName,
    superName,
    superAttrs,
    superOps,
    subSpecs,
    compNames,
    seqSteps,
    activity,
    packages,
    deploy,
  }
}

// ── SVG Diagram Builders ────────────────────────────────────────────────────

function buildClassSvg(classes = [], projectName = 'System') {
  const width = 860
  const height = 520
  const profile = analyzeProjectDomain(classes, projectName)

  const superName = profile.superName
  const superAttrs = profile.superAttrs
  const superOps = profile.superOps
  const subs = profile.subSpecs

  const renderClassBox = (x, y, w, h, name, attrs, methods) => {
    const headerH = 38
    const attrH = 50
    const attrLines = attrs.slice(0, 2).map((a, idx) => `<text x="${x + 12}" y="${y + headerH + 20 + idx * 18}" font-size="13" font-family="'Segoe UI', -apple-system, sans-serif" fill="#0f172a">${a}</text>`).join('\n')
    const methodLines = methods.slice(0, 2).map((m, idx) => `<text x="${x + 12}" y="${y + headerH + attrH + 20 + idx * 18}" font-size="13" font-family="'Segoe UI', -apple-system, sans-serif" fill="#0f172a">${m}</text>`).join('\n')

    return `
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>
    <rect x="${x}" y="${y}" width="${w}" height="${headerH}" fill="#d9f2d9" stroke="#000000" stroke-width="1.8"/>
    <text x="${x + w / 2}" y="${y + 25}" font-size="17" font-weight="700" font-family="'Segoe UI', -apple-system, sans-serif" fill="#0f172a" text-anchor="middle">${name}</text>
    <line x1="${x}" y1="${y + headerH}" x2="${x + w}" y2="${y + headerH}" stroke="#000000" stroke-width="1.8"/>
    ${attrLines}
    <line x1="${x}" y1="${y + headerH + attrH}" x2="${x + w}" y2="${y + headerH + attrH}" stroke="#000000" stroke-width="1.8"/>
    ${methodLines}
    `
  }

  const superBox = renderClassBox(340, 40, 200, 140, superName, superAttrs, superOps)
  const subBox0 = renderClassBox(20, 290, 240, 140, subs[0]?.name || 'SubEntity1', subs[0]?.attrs || [], subs[0]?.ops || [])
  const subBox1 = renderClassBox(300, 290, 240, 140, subs[1]?.name || 'SubEntity2', subs[1]?.attrs || [], subs[1]?.ops || [])
  const subBox2 = renderClassBox(580, 290, 240, 140, subs[2]?.name || 'SubEntity3', subs[2]?.attrs || [], subs[2]?.ops || [])

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #f3f4f6; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <rect width="100%" height="100%" fill="#f3f4f6"/>
  ${superBox}
  ${subBox0}
  ${subBox1}
  ${subBox2}
  <!-- Generalization Triangle and Branch Lines -->
  <polygon points="440,180 450,205 430,205" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>
  <line x1="440" y1="205" x2="440" y2="245" stroke="#000000" stroke-width="1.8"/>
  <line x1="140" y1="245" x2="700" y2="245" stroke="#000000" stroke-width="1.8"/>
  <line x1="140" y1="245" x2="140" y2="290" stroke="#000000" stroke-width="1.8"/>
  <line x1="440" y1="245" x2="440" y2="290" stroke="#000000" stroke-width="1.8"/>
  <line x1="700" y1="245" x2="700" y2="290" stroke="#000000" stroke-width="1.8"/>
</svg>`
}

function buildSequenceSvg(classes = [], projectName = 'System') {
  const width = 960
  const height = 820
  const profile = analyzeProjectDomain(classes, projectName)

  const title = `${profile.title} Sequence Diagram`
  const steps = profile.seqSteps

  const xUser = 180
  const xDev = 480
  const xDb = 780

  const p1 = profile.primaryActor
  const p2 = profile.engineName
  const p3 = profile.dbName

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <defs>
    <marker id="seqSolidArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#0f172a"/>
    </marker>
    <marker id="seqOpenArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round"/>
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#ffffff"/>
  <text x="${width / 2}" y="42" font-size="22" font-weight="700" fill="#0f172a" text-anchor="middle">${title}</text>

  <!-- Lifelines -->
  <line x1="${xUser}" y1="112" x2="${xUser}" y2="780" stroke="#94a3b8" stroke-dasharray="6,6" stroke-width="1.8"/>
  <line x1="${xDev}" y1="112" x2="${xDev}" y2="780" stroke="#94a3b8" stroke-dasharray="6,6" stroke-width="1.8"/>
  <line x1="${xDb}" y1="112" x2="${xDb}" y2="780" stroke="#94a3b8" stroke-dasharray="6,6" stroke-width="1.8"/>

  <!-- Participants -->
  <rect x="${xUser - 75}" y="70" width="150" height="42" rx="10" fill="#d9f2d9" stroke="#70ad47" stroke-width="2"/>
  <text x="${xUser}" y="96" font-size="15" font-weight="600" fill="#0f172a" text-anchor="middle">${p1}</text>

  <rect x="${xDev - 75}" y="70" width="150" height="42" rx="10" fill="#d9f2d9" stroke="#70ad47" stroke-width="2"/>
  <text x="${xDev}" y="96" font-size="15" font-weight="600" fill="#0f172a" text-anchor="middle">${p2}</text>

  <rect x="${xDb - 75}" y="70" width="150" height="42" rx="10" fill="#d9f2d9" stroke="#70ad47" stroke-width="2"/>
  <text x="${xDb}" y="96" font-size="15" font-weight="600" fill="#0f172a" text-anchor="middle">${p3}</text>

  <!-- Activations -->
  <rect x="${xUser - 14}" y="310" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>
  <rect x="${xUser - 14}" y="475" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>
  <rect x="${xUser - 14}" y="620" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>

  <rect x="${xDev - 14}" y="145" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>
  <rect x="${xDev - 14}" y="235" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>
  <rect x="${xDev - 14}" y="365" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>
  <rect x="${xDev - 14}" y="555" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>

  <rect x="${xDb - 14}" y="390" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>
  <rect x="${xDb - 14}" y="515" width="28" height="50" rx="8" fill="#d9f2d9" stroke="#70ad47" stroke-width="1.5"/>

  <!-- Messages -->
  <line x1="${xUser}" y1="160" x2="${xDev - 14}" y2="160" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="320" y="148" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[0]}</text>

  <path d="M ${xDev + 14} 210 L ${xDev + 65} 210 L ${xDev + 65} 245 L ${xDev + 14} 245" fill="none" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="${xDev + 15}" y="200" font-size="13" font-weight="600" fill="#0f172a">${steps[1]}</text>

  <line x1="${xDev - 14}" y1="270" x2="${xUser}" y2="270" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="320" y="258" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[2]}</text>

  <line x1="${xUser + 14}" y1="335" x2="${xDev - 14}" y2="335" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="320" y="323" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[3]}</text>

  <line x1="${xDev + 14}" y1="380" x2="${xDb - 14}" y2="380" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="630" y="368" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[4]}</text>

  <line x1="${xDb - 14}" y1="415" x2="${xDev + 14}" y2="415" stroke="#0f172a" stroke-width="1.8" stroke-dasharray="6,4" marker-end="url(#seqOpenArrow)"/>
  <text x="630" y="432" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[5]}</text>

  <line x1="${xDev - 14}" y1="465" x2="${xUser + 14}" y2="465" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="320" y="453" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[6]}</text>

  <line x1="${xDev + 14}" y1="500" x2="${xDb - 14}" y2="500" stroke="#0f172a" stroke-width="1.8" marker-end="url(#seqSolidArrow)"/>
  <text x="630" y="488" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[7]}</text>

  <line x1="${xDb - 14}" y1="540" x2="${xDev + 14}" y2="540" stroke="#0f172a" stroke-width="1.8" stroke-dasharray="6,4" marker-end="url(#seqOpenArrow)"/>
  <text x="630" y="557" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[8]}</text>

  <line x1="${xDev - 14}" y1="610" x2="${xUser + 14}" y2="610" stroke="#0f172a" stroke-width="1.8" stroke-dasharray="6,4" marker-end="url(#seqOpenArrow)"/>
  <text x="320" y="598" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">${steps[9]}</text>
</svg>`
}

function buildComponentSvg(classes = [], projectName = 'System') {
  const width = 1040
  const height = 540
  const profile = analyzeProjectDomain(classes, projectName)

  const title = `${profile.title} Component based Diagram`
  const containerName = profile.containerName
  const [c1, c2, c3, c4] = profile.compNames

  const componentSymbol = (cx, cy, fill = '#ffffff', stroke = '#000000') => `
    <rect x="${cx}" y="${cy}" width="16" height="24" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <rect x="${cx - 6}" y="${cy + 4}" width="8" height="5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
    <rect x="${cx - 6}" y="${cy + 14}" width="8" height="5" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #f5f5f5; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <rect width="100%" height="100%" fill="#f5f5f5"/>

  <!-- Centered Diagram Title -->
  <text x="${width / 2}" y="48" font-size="24" font-weight="700" fill="#000000" text-anchor="middle">${title}</text>

  <!-- Outer Container Component -->
  <rect x="115" y="100" width="580" height="380" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>

  <!-- UML Component Symbol on Container (Top-Right) -->
  <rect x="660" y="112" width="18" height="26" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>
  <rect x="653" y="117" width="10" height="6" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>
  <rect x="653" y="127" width="10" height="6" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>

  <!-- Container Component Label -->
  <text x="135" y="134" font-size="14" font-weight="700" fill="#000000">&lt;&lt;Component&gt;&gt;</text>
  <text x="135" y="156" font-size="17" font-weight="700" fill="#000000">: ${containerName}</text>

  <!-- 1. Left External Port and Delegation Line -->
  <rect x="107" y="278" width="16" height="16" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>
  <line x1="123" y1="286" x2="225" y2="286" stroke="#000000" stroke-width="1.8" stroke-dasharray="4,4"/>
  <text x="165" y="275" font-size="12" font-style="italic" fill="#000000" text-anchor="middle">&lt;&lt;delegate&gt;&gt;</text>

  <!-- Inner Component 1 (Left) -->
  <rect x="225" y="250" width="175" height="75" fill="#b36b1d" stroke="#000000" stroke-width="1.6"/>
  ${componentSymbol(374, 259, '#b36b1d', '#ffffff')}
  <text x="312.5" y="283" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">&lt;&lt;Component&gt;&gt;</text>
  <text x="312.5" y="304" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">: ${c1}</text>

  <!-- Internal Assembly Connector (Left to Right) -->
  <line x1="400" y1="287.5" x2="445" y2="287.5" stroke="#000000" stroke-width="1.8"/>
  <circle cx="452" cy="287.5" r="7" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>
  <path d="M 459 277.5 A 10 10 0 0 1 459 297.5" fill="none" stroke="#000000" stroke-width="1.8"/>
  <line x1="461" y1="287.5" x2="505" y2="287.5" stroke="#000000" stroke-width="1.8"/>

  <!-- Inner Component 3 (Right) -->
  <rect x="505" y="250" width="175" height="75" fill="#b36b1d" stroke="#000000" stroke-width="1.6"/>
  ${componentSymbol(654, 259, '#b36b1d', '#ffffff')}
  <text x="592.5" y="283" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">&lt;&lt;Component&gt;&gt;</text>
  <text x="592.5" y="304" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">: ${c3}</text>

  <!-- External Component 2 (Top Left) -->
  <rect x="20" y="160" width="175" height="75" fill="#b36b1d" stroke="#000000" stroke-width="1.6"/>
  ${componentSymbol(169, 169, '#b36b1d', '#ffffff')}
  <text x="107.5" y="193" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">&lt;&lt;Component&gt;&gt;</text>
  <text x="107.5" y="214" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">: ${c2}</text>

  <!-- Connection: Component 2 to Left Port -->
  <line x1="115" y1="235" x2="115" y2="278" stroke="#000000" stroke-width="1.8"/>

  <!-- Right External Ports and Delegation -->
  <line x1="680" y1="270" x2="695" y2="270" stroke="#000000" stroke-width="1.8" stroke-dasharray="4,4"/>
  <rect x="687" y="262" width="16" height="16" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>
  <line x1="703" y1="270" x2="745" y2="270" stroke="#000000" stroke-width="1.8"/>
  <circle cx="752" cy="270" r="7" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>

  <line x1="680" y1="340" x2="695" y2="340" stroke="#000000" stroke-width="1.8" stroke-dasharray="4,4"/>
  <rect x="687" y="332" width="16" height="16" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>
  <line x1="703" y1="340" x2="720" y2="340" stroke="#000000" stroke-width="1.8"/>
  <path d="M 726 330 A 10 10 0 0 1 726 350" fill="none" stroke="#000000" stroke-width="1.8"/>
  <line x1="728" y1="338" x2="766" y2="310" stroke="#000000" stroke-width="1.8" stroke-dasharray="4,4"/>
  <circle cx="772" cy="306" r="6" fill="#ffffff" stroke="#000000" stroke-width="1.8"/>
  <line x1="778" y1="302" x2="824" y2="287.5" stroke="#000000" stroke-width="1.8"/>
  <rect x="824" y="279.5" width="16" height="16" fill="#ffffff" stroke="#000000" stroke-width="1.6"/>

  <!-- External Component 4 (Right) -->
  <rect x="840" y="250" width="175" height="75" fill="#b36b1d" stroke="#000000" stroke-width="1.6"/>
  ${componentSymbol(989, 259, '#b36b1d', '#ffffff')}
  <text x="927.5" y="283" font-size="13" font-weight="600" fill="#ffffff" text-anchor="middle">&lt;&lt;Component&gt;&gt;</text>
  <text x="927.5" y="304" font-size="16" font-weight="700" fill="#ffffff" text-anchor="middle">: ${c4}</text>
</svg>`
}

function buildActivitySvg(classes = [], projectName = 'Workflow') {
  const width = 700
  const height = 720
  const profile = analyzeProjectDomain(classes, projectName)
  const act = profile.activity

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <defs>
    <marker id="actOpenArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
      <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#000000" stroke-width="1.8" stroke-linecap="round"/>
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#ffffff"/>

  <!-- Initial Node -->
  <circle cx="350" cy="28" r="14" fill="#000000"/>
  <line x1="350" y1="42" x2="350" y2="82" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>

  <!-- Top Ingest Action -->
  <rect x="250" y="82" width="200" height="46" rx="15" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="350" y="110" font-size="13" font-weight="600" fill="#000000" text-anchor="middle">${act.act1}</text>
  <line x1="350" y1="128" x2="350" y2="170" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>

  <!-- Fork Bar -->
  <rect x="308" y="170" width="84" height="15" fill="#000000"/>

  <!-- Left: Fill / Process Branch -->
  <path d="M 335 185 L 150 185 L 150 230" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>
  <rect x="50" y="230" width="200" height="46" rx="15" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="150" y="258" font-size="13" font-weight="600" fill="#000000" text-anchor="middle">${act.actBranchLeft}</text>
  <line x1="150" y1="276" x2="150" y2="310" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>

  <!-- Decision Diamond -->
  <polygon points="150,310 160,323 150,336 140,323" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="120" y="318" font-size="12" fill="#000000" text-anchor="end">${act.guardCond}</text>
  <path d="M 140 323 L 50 323 L 50 375" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>
  <rect x="-15" y="375" width="130" height="46" rx="15" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="50" y="403" font-size="11" font-weight="600" fill="#000000" text-anchor="middle">${act.actLeft1}</text>
  <path d="M 50 421 L 50 488 L 140 488" fill="none" stroke="#000000" stroke-width="1.8"/>

  <text x="180" y="318" font-size="12" fill="#000000">[else]</text>
  <path d="M 160 323 L 250 323 L 250 375" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>
  <rect x="185" y="375" width="130" height="46" rx="15" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="250" y="403" font-size="11" font-weight="600" fill="#000000" text-anchor="middle">${act.actLeft2}</text>
  <path d="M 250 421 L 250 488 L 160 488" fill="none" stroke="#000000" stroke-width="1.8"/>

  <!-- Merge Diamond -->
  <polygon points="150,475 160,488 150,501 140,488" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <path d="M 150 501 L 150 535 L 335 535 L 335 570" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>

  <!-- Right: Verification & Telemetry Branch -->
  <path d="M 365 185 L 550 185 L 550 230" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>
  <rect x="450" y="230" width="200" height="46" rx="15" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="550" y="258" font-size="13" font-weight="600" fill="#000000" text-anchor="middle">${act.actBranchRight1}</text>
  <line x1="550" y1="276" x2="550" y2="375" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>

  <rect x="450" y="375" width="200" height="46" rx="15" fill="#70cbf4" stroke="#000000" stroke-width="1.8"/>
  <text x="550" y="403" font-size="13" font-weight="600" fill="#000000" text-anchor="middle">${act.actBranchRight2}</text>
  <path d="M 550 421 L 550 535 L 365 535 L 365 570" fill="none" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>

  <!-- Join Bar & Final Node -->
  <rect x="308" y="570" width="84" height="15" fill="#000000"/>
  <line x1="350" y1="585" x2="350" y2="625" stroke="#000000" stroke-width="1.8" marker-end="url(#actOpenArrow)"/>
  <circle cx="350" cy="640" r="15" fill="#ffffff" stroke="#000000" stroke-width="2"/>
  <circle cx="350" cy="640" r="9" fill="#000000"/>
</svg>`
}

function buildDeploymentSvg(classes = [], projectName = 'System') {
  const width = 800
  const height = 640
  const profile = analyzeProjectDomain(classes, projectName)
  const d = profile.deploy

  const cuboid = (x, y, w, h, depth, title, stereotype) => {
    const stereoSvg = stereotype ? `<text x="${x + w / 2}" y="${y + 22}" font-size="11" font-weight="600" fill="#000000" text-anchor="middle">&lt;&lt;${stereotype}&gt;&gt;</text>` : ''
    const titleY = stereotype ? y + 42 : y + h / 2 + 5
    return `
    <polygon points="${x},${y} ${x + depth},${y - depth} ${x + w + depth},${y - depth} ${x + w},${y}" fill="#9ee1f9" stroke="#000000" stroke-width="1.6"/>
    <polygon points="${x + w},${y} ${x + w + depth},${y - depth} ${x + w + depth},${y + h - depth} ${x + w},${y + h}" fill="#4cbbe8" stroke="#000000" stroke-width="1.6"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#70cbf4" stroke="#000000" stroke-width="1.6"/>
    ${stereoSvg}
    <text x="${x + w / 2}" y="${titleY}" font-size="12" font-weight="700" fill="#000000" text-anchor="middle">${title}</text>
    `
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <defs>
    <marker id="depArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 1 L 9 5 L 0 9 z" fill="#c25454"/>
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#ffffff"/>

  <!-- Left Annotation: Node -->
  <text x="30" y="45" font-size="16" font-weight="700" fill="#c25454">Node</text>
  <line x1="75" y1="42" x2="140" y2="42" stroke="#c25454" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#depArrow)"/>

  <!-- Left Annotation: Association -->
  <text x="30" y="165" font-size="16" font-weight="700" fill="#c25454">Association</text>
  <line x1="125" y1="160" x2="250" y2="160" stroke="#c25454" stroke-width="2" stroke-dasharray="6,4" marker-end="url(#depArrow)"/>

  <!-- Associations -->
  <line x1="260" y1="42" x2="380" y2="42" stroke="#000000" stroke-width="1.6"/>
  <path d="M 435 80 L 435 135 L 290 135 L 290 190" fill="none" stroke="#000000" stroke-width="1.6"/>
  <path d="M 435 135 L 585 135 L 585 190" fill="none" stroke="#000000" stroke-width="1.6"/>
  <line x1="290" y1="310" x2="290" y2="370" stroke="#000000" stroke-width="1.6"/>
  <line x1="585" y1="310" x2="585" y2="370" stroke="#000000" stroke-width="1.6"/>
  <line x1="160" y1="430" x2="160" y2="490" stroke="#000000" stroke-width="1.6"/>
  <line x1="310" y1="430" x2="310" y2="490" stroke="#000000" stroke-width="1.6"/>
  <line x1="460" y1="430" x2="460" y2="490" stroke="#000000" stroke-width="1.6"/>
  <line x1="610" y1="430" x2="610" y2="490" stroke="#000000" stroke-width="1.6"/>

  <!-- Nodes -->
  ${cuboid(140, 20, 120, 60, 15, d.client, 'device')}
  ${cuboid(380, 20, 140, 60, 15, d.gateway, 'executionEnvironment')}
  ${cuboid(200, 190, 170, 120, 18, d.appServer, 'processor')}
  ${cuboid(495, 190, 170, 120, 18, d.worker, 'processor')}
  ${cuboid(90, 370, 600, 60, 18, `${profile.pascalName} Cluster Network`, 'network')}
  ${cuboid(90, 490, 130, 95, 16, d.db, 'database')}
  ${cuboid(240, 490, 130, 95, 16, 'Replica Node', 'database')}
  ${cuboid(390, 490, 130, 95, 16, d.cache, 'storage')}
  ${cuboid(540, 490, 130, 95, 16, 'Metrics Agent', 'service')}
</svg>`
}

function buildPackageSvg(classes = [], projectName = 'System') {
  const width = 900
  const height = 540
  const profile = analyzeProjectDomain(classes, projectName)
  const pkgs = profile.packages

  const folder = (x, y, w, h, title, bodyColor, tabColor, foldColor) => `
    <path d="M ${x} ${y + 14} L ${x} ${y} L ${x + 32} ${y} L ${x + 42} ${y + 14} Z" fill="${tabColor}" stroke="#a85d77" stroke-width="1.4"/>
    <polygon points="${x},${y} ${x + 12},${y} ${x},${y + 12}" fill="${foldColor}"/>
    <rect x="${x}" y="${y + 14}" width="${w}" height="${h}" fill="${bodyColor}" stroke="${tabColor}" stroke-width="1.4"/>
    <text x="${x + w / 2}" y="${y + 14 + h / 2 + 5}" font-size="12" font-weight="600" fill="#0f172a" text-anchor="middle">${title}</text>
  `

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #ffffff; font-family: 'Segoe UI', -apple-system, sans-serif;">
  <defs>
    <marker id="pkgOpenArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="#2563eb" stroke-width="1.8" stroke-linecap="round"/>
    </marker>
  </defs>

  <rect width="100%" height="100%" fill="#ffffff"/>

  <!-- Top tier packages (Pink) -->
  ${folder(40, 30, 140, 75, pkgs.top[0], '#f8d7e6', '#f0a8c4', '#a8436b')}
  ${folder(255, 30, 140, 75, pkgs.top[1], '#f8d7e6', '#f0a8c4', '#a8436b')}
  ${folder(475, 30, 140, 75, pkgs.top[2], '#f8d7e6', '#f0a8c4', '#a8436b')}
  ${folder(695, 30, 140, 75, pkgs.top[3], '#f8d7e6', '#f0a8c4', '#a8436b')}

  <!-- Dependencies -->
  <line x1="110" y1="120" x2="110" y2="155" stroke="#2563eb" stroke-width="1.6"/>
  <line x1="325" y1="120" x2="325" y2="155" stroke="#2563eb" stroke-width="1.6"/>
  <line x1="545" y1="120" x2="545" y2="155" stroke="#2563eb" stroke-width="1.6"/>
  <line x1="765" y1="120" x2="765" y2="155" stroke="#2563eb" stroke-width="1.6"/>
  <line x1="110" y1="155" x2="765" y2="155" stroke="#2563eb" stroke-width="1.6"/>
  <text x="215" y="145" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;merge&gt;&gt;</text>
  <text x="655" y="145" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;merge&gt;&gt;</text>

  <path d="M 65 105 L 65 190 L 270 190" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6,4"/>
  <path d="M 65 190 L 65 250 L 210 250" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6,4" marker-end="url(#pkgOpenArrow)"/>
  <text x="135" y="180" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;use&gt;&gt;</text>
  <text x="110" y="240" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;use&gt;&gt;</text>

  <line x1="725" y1="155" x2="725" y2="210" stroke="#2563eb" stroke-width="1.6"/>
  <path d="M 270 190 L 770 190 L 770 250 L 740 250" fill="none" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6,4" marker-end="url(#pkgOpenArrow)"/>
  <text x="680" y="180" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;use&gt;&gt;</text>

  <!-- Middle tier packages (Peach) -->
  ${folder(210, 215, 140, 75, pkgs.middle[0], '#fddbc7', '#fcae82', '#b3531b')}
  ${folder(600, 215, 140, 75, pkgs.middle[1], '#fddbc7', '#fcae82', '#b3531b')}

  <line x1="350" y1="260" x2="600" y2="260" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6,4"/>
  <text x="475" y="250" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;access&gt;&gt;</text>

  <line x1="280" y1="290" x2="280" y2="370" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6,4" marker-end="url(#pkgOpenArrow)"/>
  <text x="210" y="340" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;Import&gt;&gt;</text>

  <line x1="670" y1="290" x2="670" y2="370" stroke="#2563eb" stroke-width="1.6" stroke-dasharray="6,4" marker-end="url(#pkgOpenArrow)"/>
  <text x="735" y="340" font-size="13" font-weight="600" fill="#0f172a" text-anchor="middle">&lt;&lt;Import&gt;&gt;</text>

  <!-- Bottom tier packages (Mint) -->
  ${folder(210, 370, 140, 75, pkgs.bottom[0], '#d6ebd9', '#a8d5af', '#2e7a3a')}
  ${folder(600, 370, 140, 75, pkgs.bottom[1], '#d6ebd9', '#a8d5af', '#2e7a3a')}

  <!-- Banner -->
  <rect x="0" y="490" width="${width}" height="50" fill="#e2ede6"/>
  <text x="40" y="522" font-size="16" font-weight="700" fill="#1e293b">${profile.title} Package Diagram</text>
  <text x="${width - 50}" y="522" font-size="20" font-weight="800" fill="#047857" text-anchor="middle">&gt;&lt;</text>
</svg>`
}

// ── Diagram type metadata ────────────────────────────────────────────────────

const DIAGRAM_META = {
  use_case: {
    accent: 'orange',
    gradient: 'from-orange-500/20 to-orange-500/5',
    border: 'border-orange-400',
    ring: 'ring-orange-400/30',
    iconBg: 'bg-orange-500/15 text-orange-400',
    label: 'UML Use Case Diagram',
    badge: 'usecase',
    description: 'System boundary, stick figure actors, peach use case ovals, extend/include relationships',
  },
  activity: {
    accent: 'rose',
    gradient: 'from-rose-500/20 to-rose-500/5',
    border: 'border-rose-400',
    ring: 'ring-rose-400/30',
    iconBg: 'bg-rose-500/15 text-rose-400',
    label: 'UML Activity Diagram',
    badge: 'flowchart TD',
    description: 'Workflow execution — input checks, business decisions, parallel forks, and synchronization joins',
  },
  sequence: {
    accent: 'violet',
    gradient: 'from-violet-500/20 to-violet-500/5',
    border: 'border-violet-400',
    ring: 'ring-violet-400/30',
    iconBg: 'bg-violet-500/15 text-violet-400',
    label: 'UML Sequence Diagram',
    badge: 'sequenceDiagram',
    description: 'Runtime message interactions — Client → Controller → Service → Repository → Database',
  },
  class: {
    accent: 'cyan',
    gradient: 'from-cyan-500/20 to-cyan-500/5',
    border: 'border-cyan-400',
    ring: 'ring-cyan-400/30',
    iconBg: 'bg-cyan-500/15 text-cyan-400',
    label: 'UML Class Diagram',
    badge: 'classDiagram',
    description: 'OOP structure — classes, interfaces, attributes, methods, inheritance and associations',
  },
  component: {
    accent: 'amber',
    gradient: 'from-amber-500/20 to-amber-500/5',
    border: 'border-amber-400',
    ring: 'ring-amber-400/30',
    iconBg: 'bg-amber-500/15 text-amber-400',
    label: 'Component Architecture',
    badge: 'flowchart TB',
    description: 'Layered subsystems — Presentation Layer, Business Logic Layer, and Persistence Repositories',
  },
  deployment: {
    accent: 'emerald',
    gradient: 'from-emerald-500/20 to-emerald-500/5',
    border: 'border-emerald-400',
    ring: 'ring-emerald-400/30',
    iconBg: 'bg-emerald-500/15 text-emerald-400',
    label: 'Deployment Diagram',
    badge: 'deployment',
    description: 'Physical topology — Client devices, Nginx gateway, app runtime, DB servers, and protocols',
  },
  package: {
    accent: 'sky',
    gradient: 'from-sky-500/20 to-sky-500/5',
    border: 'border-sky-400',
    ring: 'ring-sky-400/30',
    iconBg: 'bg-sky-500/15 text-sky-400',
    label: 'Package Diagram',
    badge: 'package',
    description: 'Module dependencies — folder structures, imports, DTO usage, and inter-package coupling',
  },
}

// ── Main Component ───────────────────────────────────────────────────────────

function getValidVectorSvg(serverSvg, fallbackFn) {
  if (
    serverSvg &&
    typeof serverSvg === 'string' &&
    !serverSvg.includes('foreignObject') &&
    !serverSvg.includes('<pre') &&
    !serverSvg.includes('word-break: break-all') &&
    serverSvg.includes('<svg') &&
    (serverSvg.includes('<rect') || serverSvg.includes('<circle') || serverSvg.includes('<path') || serverSvg.includes('<polygon'))
  ) {
    return serverSvg
  }
  return fallbackFn()
}

export default function UMLDiagramsView({ diagramsData = {}, parsedClasses = [], projectName = 'System' }) {
  const [selected, setSelected] = useState('use_case')

  const serverUseCaseMermaid = validateStoredMermaid(diagramsData?.use_case_diagram?.mermaid)
  const serverActivityMermaid = validateStoredMermaid(diagramsData?.activity_diagram?.mermaid)
  const serverSequenceMermaid = validateStoredMermaid(diagramsData?.sequence_diagram?.mermaid)
  const serverClassMermaid = validateStoredMermaid(diagramsData?.class_diagram?.mermaid)
  const serverComponentMermaid = validateStoredMermaid(diagramsData?.component_diagram?.mermaid)
  const serverDeploymentMermaid = validateStoredMermaid(diagramsData?.deployment_diagram?.mermaid)
  const serverPackageMermaid = validateStoredMermaid(diagramsData?.package_diagram?.mermaid)

  const hasServerData = Boolean(
    serverUseCaseMermaid ||
    serverActivityMermaid ||
    serverSequenceMermaid ||
    serverClassMermaid ||
    serverComponentMermaid ||
    serverDeploymentMermaid ||
    serverPackageMermaid ||
    diagramsData?.use_case_diagram?.svg
  )
  const hasParsedClasses = Boolean(parsedClasses && parsedClasses.length > 0)
  const hasLiveData = hasServerData || hasParsedClasses

  const diagrams = [
    {
      id: 'use_case',
      icon: Users,
      svg: getValidVectorSvg(diagramsData?.use_case_diagram?.svg, () => buildUseCaseSvg(parsedClasses, projectName)),
      code: serverUseCaseMermaid || buildUseCaseDiagram(parsedClasses, projectName),
      isDemo: !serverUseCaseMermaid && !diagramsData?.use_case_diagram?.svg && !hasParsedClasses,
    },
    {
      id: 'activity',
      icon: Workflow,
      svg: getValidVectorSvg(diagramsData?.activity_diagram?.svg, () => buildActivitySvg(parsedClasses, projectName)),
      code: serverActivityMermaid || (hasParsedClasses ? buildActivityDiagram(parsedClasses) : FALLBACK_ACTIVITY),
      isDemo: !serverActivityMermaid && !diagramsData?.activity_diagram?.svg && !hasParsedClasses,
    },
    {
      id: 'sequence',
      icon: Activity,
      svg: getValidVectorSvg(diagramsData?.sequence_diagram?.svg, () => buildSequenceSvg(parsedClasses, projectName)),
      code: serverSequenceMermaid || buildSequenceDiagram(parsedClasses, projectName),
      isDemo: !serverSequenceMermaid && !diagramsData?.sequence_diagram?.svg && !hasParsedClasses,
    },
    {
      id: 'class',
      icon: Layers,
      svg: getValidVectorSvg(diagramsData?.class_diagram?.svg, () => buildClassSvg(parsedClasses, projectName)),
      code: serverClassMermaid || buildClassDiagram(parsedClasses, projectName),
      isDemo: !serverClassMermaid && !diagramsData?.class_diagram?.svg && !hasParsedClasses,
    },
    {
      id: 'component',
      icon: FolderTree,
      svg: getValidVectorSvg(diagramsData?.component_diagram?.svg, () => buildComponentSvg(parsedClasses, projectName)),
      code: serverComponentMermaid || (hasParsedClasses ? buildComponentDiagram(parsedClasses) : FALLBACK_COMPONENT),
      isDemo: !serverComponentMermaid && !diagramsData?.component_diagram?.svg && !hasParsedClasses,
    },
    {
      id: 'deployment',
      icon: Server,
      svg: getValidVectorSvg(diagramsData?.deployment_diagram?.svg, () => buildDeploymentSvg(parsedClasses, projectName)),
      code: serverDeploymentMermaid || (hasParsedClasses ? buildDeploymentDiagram(parsedClasses) : FALLBACK_DEPLOYMENT),
      isDemo: !serverDeploymentMermaid && !diagramsData?.deployment_diagram?.svg && !hasParsedClasses,
    },
    {
      id: 'package',
      icon: Package,
      svg: getValidVectorSvg(diagramsData?.package_diagram?.svg, () => buildPackageSvg(parsedClasses, projectName)),
      code: serverPackageMermaid || (hasParsedClasses ? buildPackageDiagram(parsedClasses) : FALLBACK_PACKAGE),
      isDemo: !serverPackageMermaid && !diagramsData?.package_diagram?.svg && !hasParsedClasses,
    },
  ]

  const active = diagrams.find(d => d.id === selected) || diagrams[0]
  const activeMeta = DIAGRAM_META[selected] || DIAGRAM_META.use_case

  return (
    <div className="space-y-4">

      {/* ── Status banner ──────────────────────────────────────────────────── */}
      {!hasLiveData && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-500/30
                        bg-amber-500/5 text-amber-300">
          <span className="text-lg">⚠️</span>
          <div>
            <p className="text-xs font-semibold">Displaying Reference / Demonstration Models</p>
            <p className="text-[11px] text-amber-400/80 mt-0.5">
              Upload a codebase ZIP or GitHub repository to generate live, tailored UML diagrams automatically.
            </p>
          </div>
          <span className="ml-auto text-[10px] font-mono font-bold px-2.5 py-1 rounded-full
                           border border-amber-500/40 bg-amber-500/10 text-amber-400 flex-shrink-0">
            DEMO
          </span>
        </div>
      )}

      {/* ── 7 Diagram Selector Tabs ────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
        {diagrams.map(diag => {
          const meta = DIAGRAM_META[diag.id]
          const Icon = diag.icon
          const isActive = selected === diag.id

          return (
            <button
              key={diag.id}
              onClick={() => setSelected(diag.id)}
              className={clsx(
                'relative flex flex-col gap-2.5 p-3.5 rounded-2xl text-left border transition-all duration-200',
                'focus:outline-none focus-visible:ring-2',
                isActive
                  ? [
                      `bg-gradient-to-b ${meta.gradient}`,
                      meta.border,
                      `ring-1 ${meta.ring}`,
                      'shadow-lg',
                    ]
                  : [
                      'bg-navy-900/60 border-navy-700/50',
                      'hover:bg-navy-800/60 hover:border-navy-600',
                    ]
              )}
            >
              {/* Top row: icon + badge */}
              <div className="flex items-start justify-between gap-1.5">
                <div className={clsx('p-2 rounded-xl flex-shrink-0', isActive ? meta.iconBg : 'bg-navy-800 text-slate-500')}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={clsx(
                  'text-[8px] font-mono font-bold px-1.5 py-0.5 rounded border flex-shrink-0',
                  isActive
                    ? `border-current text-${meta.accent}-400 bg-${meta.accent}-500/10`
                    : 'border-navy-600 text-slate-500 bg-navy-800/40'
                )}>
                  {meta.badge}
                </span>
              </div>

              {/* Label */}
              <div>
                <p className={clsx(
                  'text-xs font-semibold leading-tight line-clamp-1',
                  isActive ? 'text-white' : 'text-slate-300'
                )}>
                  {meta.label}
                </p>
                <p className="text-[10px] text-slate-500 mt-0.5 leading-snug line-clamp-2">
                  {meta.description}
                </p>
              </div>

              {/* Active indicator bar */}
              {isActive && (
                <div className={clsx(
                  'absolute bottom-0 left-3 right-3 h-0.5 rounded-full',
                  `bg-${meta.accent}-400`
                )} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Active diagram viewer ──────────────────────────────────────────── */}
      <MermaidViewer
        key={active.id}
        chartCode={active.code}
        svgCode={active.svg}
        title={activeMeta.label}
        description={activeMeta.description}
        diagramType={active.id}
        isDemo={active.isDemo}
      />
    </div>
  )
}
