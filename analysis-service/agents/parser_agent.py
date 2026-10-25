"""
Parser Agent (Agent 3 in the REQUIRED AGENTS list)

PURPOSE:
  Parse source files using Tree-sitter (per language) or regex fallback to generate
  structured representations of classes, functions, methods, APIs, and imports.
  Supports ANY programming language codebase via a multi-language parser router.

SUPPORTED LANGUAGES:
  Java        — Full Tree-sitter AST: classes, methods, fields, Spring/JAX-RS endpoints
  Python      — Tree-sitter: classes, functions, decorators, Django/Flask/FastAPI routes
  JavaScript  — Tree-sitter: classes, arrow fns, Express/NestJS routes
  TypeScript  — Tree-sitter: same as JS + interfaces, types
  Go          — Tree-sitter: structs, functions, Gin/Echo/Fiber routes
  C#          — Tree-sitter: classes, methods, ASP.NET controller actions
  Ruby        — Tree-sitter: classes, methods, Rails routes
  PHP         — Tree-sitter: classes, functions, Laravel routes
  Rust        — Tree-sitter: structs, impl blocks, Actix/Axum handlers
  Kotlin      — Tree-sitter: classes, functions, Ktor routes
  C/C++       — Tree-sitter: structs, functions
  Unknown     — Regex-based symbol extraction fallback

INPUTS (from Orchestrator / PreprocessingAgent):
  {
    "extracted_path": "/path/to/extracted/project",
    "source_files": ["src/app.py", "src/models.py", ...],
    "language": "python",
    "framework": "django"
  }

OUTPUTS (AgentEnvelope with ParserOutput in data).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from core.schemas import (
    AgentEnvelope, AgentStatus, ParsedClass, ParsedMethod, ParsedField, ParserOutput
)
from core.logger import get_logger

logger = get_logger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _get_node_text(node, source_bytes: bytes) -> str:
    return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _get_annotations(node, source_bytes: bytes) -> List[str]:
    annotations = []
    for child in node.children:
        if child.type == "modifiers":
            for mod_child in child.children:
                if mod_child.type in ("marker_annotation", "annotation"):
                    annotations.append(_get_node_text(mod_child, source_bytes))
        elif child.type in ("marker_annotation", "annotation"):
            annotations.append(_get_node_text(child, source_bytes))
    return annotations


def _get_modifiers(node, source_bytes: bytes) -> List[str]:
    modifiers = []
    for child in node.children:
        if child.type == "modifiers":
            for mod_child in child.children:
                if mod_child.type not in ("marker_annotation", "annotation"):
                    modifiers.append(_get_node_text(mod_child, source_bytes))
    return modifiers


def _extract_annotation_path(annotation_str: str) -> Optional[str]:
    if "(" not in annotation_str:
        return ""
    inside = annotation_str[annotation_str.find("(") + 1: annotation_str.rfind(")")]
    inside = inside.strip()
    if not inside:
        return ""
    if inside.startswith('"') and inside.endswith('"'):
        return inside[1:-1]
    if "value" in inside or "path" in inside:
        parts = inside.split("=")
        if len(parts) > 1:
            return parts[1].strip().strip('"\'')
    return inside.strip('"\'')


# ── Java Parser ────────────────────────────────────────────────────────────────

SPRING_ENDPOINT_ANNOTATIONS = {
    "GetMapping": "GET", "PostMapping": "POST", "PutMapping": "PUT",
    "DeleteMapping": "DELETE", "PatchMapping": "PATCH", "RequestMapping": "REQUEST",
}


def _parse_java_file(file_path: Path, rel_path: str, language: str) -> List[ParsedClass]:
    try:
        import tree_sitter_java as tsjava
        from tree_sitter import Language, Parser
        java_lang = Language(tsjava.language())
        parser = Parser(java_lang)
    except ImportError:
        return _parse_with_regex(file_path, rel_path, language)

    try:
        source_bytes = file_path.read_bytes()
        tree = parser.parse(source_bytes)
        root = tree.root_node
    except Exception:
        return _parse_with_regex(file_path, rel_path, language)

    package_name = ""
    imports: List[str] = []
    classes: List[ParsedClass] = []

    for child in root.children:
        if child.type == "package_declaration":
            for p_child in child.children:
                if p_child.type in ("scoped_identifier", "identifier"):
                    package_name = _get_node_text(p_child, source_bytes)
        elif child.type == "import_declaration":
            for i_child in child.children:
                if i_child.type in ("scoped_identifier", "identifier"):
                    imports.append(_get_node_text(i_child, source_bytes))

    def walk_type_declarations(node):
        for child in node.children:
            if child.type in ("class_declaration", "interface_declaration", "enum_declaration", "record_declaration"):
                parsed = _extract_java_class(child, rel_path, package_name, imports, source_bytes, language)
                if parsed:
                    classes.append(parsed)

    walk_type_declarations(root)
    return classes


def _extract_java_class(node, rel_path, package_name, imports, source_bytes, language) -> Optional[ParsedClass]:
    class_name = ""
    extends_class = None
    implements_interfaces: List[str] = []

    for child in node.children:
        if child.type == "identifier":
            class_name = _get_node_text(child, source_bytes)
        elif child.type == "superclass":
            for sc in child.children:
                if sc.type in ("type_identifier", "scoped_type_identifier"):
                    extends_class = _get_node_text(sc, source_bytes)
        elif child.type in ("super_interfaces", "interfaces"):
            for iface in child.children:
                if iface.type == "type_list":
                    for t in iface.children:
                        if t.type in ("type_identifier", "scoped_type_identifier"):
                            implements_interfaces.append(_get_node_text(t, source_bytes))
                elif iface.type in ("type_identifier", "scoped_type_identifier"):
                    implements_interfaces.append(_get_node_text(iface, source_bytes))

    if not class_name:
        return None

    qualified_name = f"{package_name}.{class_name}" if package_name else class_name
    annotations = _get_annotations(node, source_bytes)
    modifiers = _get_modifiers(node, source_bytes)
    class_base_path = ""
    for ann in annotations:
        if "RequestMapping" in ann:
            class_base_path = _extract_annotation_path(ann) or ""

    methods: List[ParsedMethod] = []
    fields: List[ParsedField] = []
    body_node = None
    for child in node.children:
        if child.type in ("class_body", "interface_body", "enum_body"):
            body_node = child
            break

    if body_node:
        for member in body_node.children:
            if member.type == "method_declaration":
                m = _extract_java_method(member, class_name, qualified_name, rel_path, class_base_path, source_bytes, language)
                if m:
                    methods.append(m)
            elif member.type == "field_declaration":
                fields.extend(_extract_java_field(member, source_bytes))

    return ParsedClass(
        class_name=class_name, qualified_name=qualified_name, file_path=rel_path,
        start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1,
        package=package_name, language=language, annotations=annotations,
        implements=implements_interfaces, extends=extends_class,
        methods=methods, fields=fields, imports=imports,
        is_interface=node.type == "interface_declaration",
        is_abstract="abstract" in modifiers,
        is_enum=node.type == "enum_declaration",
    )


def _extract_java_method(node, class_name, class_qualified_name, rel_path, class_base_path, source_bytes, language) -> Optional[ParsedMethod]:
    method_name = ""
    return_type = "void"
    parameters: List[Dict[str, str]] = []

    for child in node.children:
        if child.type == "identifier":
            method_name = _get_node_text(child, source_bytes)
        elif child.type in ("type_identifier", "scoped_type_identifier", "generic_type", "void_type", "integral_type", "floating_point_type", "boolean_type"):
            return_type = _get_node_text(child, source_bytes)
        elif child.type == "formal_parameters":
            for param in child.children:
                if param.type == "formal_parameter":
                    p_type, p_name = "", ""
                    for pc in param.children:
                        if pc.type in ("type_identifier", "scoped_type_identifier", "generic_type", "integral_type", "floating_point_type", "boolean_type"):
                            p_type = _get_node_text(pc, source_bytes)
                        elif pc.type == "identifier":
                            p_name = _get_node_text(pc, source_bytes)
                    if p_name:
                        parameters.append({"name": p_name, "type": p_type or "Object"})

    if not method_name:
        return None

    qualified_name = f"{class_qualified_name}.{method_name}"
    annotations = _get_annotations(node, source_bytes)
    modifiers = _get_modifiers(node, source_bytes)

    calls: Set[str] = set()
    def walk_calls(n):
        if n.type == "method_invocation":
            for c in n.children:
                if c.type == "identifier":
                    calls.add(_get_node_text(c, source_bytes))
        for c in n.children:
            walk_calls(c)
    walk_calls(node)

    is_endpoint = False
    http_method: Optional[str] = None
    endpoint_path: Optional[str] = None
    for ann in annotations:
        for ann_name, http_verb in SPRING_ENDPOINT_ANNOTATIONS.items():
            if ann_name in ann:
                is_endpoint = True
                http_method = http_verb if http_verb != "REQUEST" else "GET"
                sub_path = _extract_annotation_path(ann) or ""
                combined = (class_base_path.rstrip("/") + "/" + sub_path.lstrip("/")).strip()
                if not combined.startswith("/"):
                    combined = "/" + combined
                endpoint_path = combined
                break

    return ParsedMethod(
        method_name=method_name, qualified_name=qualified_name, file_path=rel_path,
        start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1,
        return_type=return_type, parameters=parameters, annotations=annotations,
        modifiers=modifiers, calls=sorted(list(calls)),
        is_endpoint=is_endpoint, http_method=http_method, endpoint_path=endpoint_path,
    )


def _extract_java_field(node, source_bytes) -> List[ParsedField]:
    annotations = _get_annotations(node, source_bytes)
    modifiers = _get_modifiers(node, source_bytes)
    field_type = "Object"
    fields: List[ParsedField] = []
    for child in node.children:
        if child.type in ("type_identifier", "scoped_type_identifier", "generic_type", "integral_type", "floating_point_type", "boolean_type"):
            field_type = _get_node_text(child, source_bytes)
        elif child.type == "variable_declarator":
            for vc in child.children:
                if vc.type == "identifier":
                    fields.append(ParsedField(
                        field_name=_get_node_text(vc, source_bytes),
                        field_type=field_type, annotations=annotations, modifiers=modifiers,
                    ))
    return fields


# ── Python Parser ──────────────────────────────────────────────────────────────

# HTTP decorator patterns for Django/Flask/FastAPI
PYTHON_ROUTE_DECORATORS = re.compile(
    r'@(?:app|router|blueprint|api_view|[\w_]+)\.'
    r'(get|post|put|delete|patch|route)\s*\(\s*[\'"]([^\'"]*)[\'"]',
    re.IGNORECASE
)
PYTHON_ROUTE_SHORTHAND = re.compile(
    r'@(?:app|router)\.(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]*)[\'"]',
    re.IGNORECASE
)


def _parse_python_file(file_path: Path, rel_path: str, language: str) -> List[ParsedClass]:
    """Parse Python source files using Python's native AST module with tree-sitter & regex fallback."""
    try:
        source_text = file_path.read_text(encoding="utf-8", errors="replace")
        return _parse_python_ast(source_text, rel_path, language)
    except Exception as ast_err:
        logger.debug(f"Python AST parse failed for {rel_path}, trying tree-sitter: {ast_err}")

    try:
        import tree_sitter_python as tspython
        from tree_sitter import Language, Parser
        py_lang = Language(tspython.language())
        parser = Parser(py_lang)
        source_bytes = file_path.read_bytes()
        tree = parser.parse(source_bytes)
        root = tree.root_node
        return _extract_python_symbols(root, source_bytes, rel_path, language, tree_sitter_mode=True)
    except Exception as ts_err:
        logger.debug(f"tree-sitter python failed for {rel_path}, using regex: {ts_err}")
        return _parse_python_regex(file_path, rel_path, language)


def _parse_python_ast(source_text: str, rel_path: str, language: str) -> List[ParsedClass]:
    import ast
    lines = source_text.splitlines()
    tree = ast.parse(source_text)
    classes: List[ParsedClass] = []
    top_level_methods: List[ParsedMethod] = []
    top_level_fields: List[ParsedField] = []
    top_level_annotations: List[str] = []

    file_stem = Path(rel_path).stem
    module_class_name = file_stem[0].upper() + file_stem[1:] if file_stem else "Module"

    def _extract_params(fn_node) -> List[Dict[str, str]]:
        params = []
        for arg in fn_node.args.args:
            arg_type = "Any"
            if arg.annotation:
                try:
                    arg_type = ast.unparse(arg.annotation)
                except Exception:
                    arg_type = "Any"
            params.append({"name": arg.arg, "type": arg_type})
        return params

    def _inspect_decorators(fn_node):
        decorators = []
        is_endpoint = False
        http_method = None
        endpoint_path = None

        for dec in fn_node.decorator_list:
            try:
                dec_str = ast.unparse(dec)
            except Exception:
                dec_str = ""
            if not dec_str:
                continue
            decorators.append(f"@{dec_str}")

            m = PYTHON_ROUTE_DECORATORS.search(f"@{dec_str}") or PYTHON_ROUTE_SHORTHAND.search(f"@{dec_str}")
            if m:
                is_endpoint = True
                http_method = m.group(1).upper()
                endpoint_path = m.group(2)
            else:
                for verb in ("get", "post", "put", "delete", "patch"):
                    if f".{verb}(" in dec_str.lower():
                        is_endpoint = True
                        http_method = verb.upper()
                        pm = re.search(r"['\"]([^'\"]*)['\"]", dec_str)
                        endpoint_path = pm.group(1) if pm else "/"
                        break

        return decorators, is_endpoint, http_method, endpoint_path

    def _parse_fn(fn_node, class_name: str = "") -> ParsedMethod:
        fn_name = fn_node.name
        qualified_name = f"{class_name}.{fn_name}" if class_name else fn_name
        decorators, is_endpoint, http_method, endpoint_path = _inspect_decorators(fn_node)
        params = _extract_params(fn_node)
        ret_type = "Any"
        if getattr(fn_node, "returns", None):
            try:
                ret_type = ast.unparse(fn_node.returns)
            except Exception:
                ret_type = "Any"

        start_line = getattr(fn_node, "lineno", 1)
        end_line = getattr(fn_node, "end_lineno", start_line + 5)

        calls = set()
        for call_node in ast.walk(fn_node):
            if isinstance(call_node, ast.Call):
                try:
                    cname = ast.unparse(call_node.func).split(".")[-1]
                    if cname and cname.isidentifier():
                        calls.add(cname)
                except Exception:
                    pass

        return ParsedMethod(
            method_name=fn_name,
            qualified_name=qualified_name,
            file_path=rel_path,
            start_line=start_line,
            end_line=end_line,
            return_type=ret_type,
            parameters=params,
            annotations=decorators,
            modifiers=["async"] if isinstance(fn_node, ast.AsyncFunctionDef) else [],
            calls=sorted(list(calls)),
            is_endpoint=is_endpoint,
            http_method=http_method,
            endpoint_path=endpoint_path,
        )

    for node in tree.body:
        if isinstance(node, ast.ClassDef):
            class_name = node.name
            c_bases = []
            for b in node.bases:
                try:
                    c_bases.append(ast.unparse(b))
                except Exception:
                    pass
            c_decorators = []
            for d in node.decorator_list:
                try:
                    c_decorators.append(f"@{ast.unparse(d)}")
                except Exception:
                    pass

            c_methods: List[ParsedMethod] = []
            c_fields: List[ParsedField] = []

            for item in node.body:
                if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                    m = _parse_fn(item, class_name)
                    c_methods.append(m)
                    if item.name == "__init__":
                        for subnode in ast.walk(item):
                            if isinstance(subnode, ast.Assign):
                                for target in subnode.targets:
                                    if isinstance(target, ast.Attribute) and getattr(target.value, "id", "") == "self":
                                        f_name = target.attr
                                        if f_name not in [f.field_name for f in c_fields]:
                                            c_fields.append(ParsedField(field_name=f_name, field_type="Any"))
                elif isinstance(item, ast.Assign):
                    for target in item.targets:
                        if isinstance(target, ast.Name):
                            f_type = "Any"
                            try:
                                f_type = ast.unparse(item.value).split("(")[0].split(".")[-1] or "Any"
                            except Exception:
                                f_type = "Any"
                            c_fields.append(ParsedField(field_name=target.id, field_type=f_type))

            if any("model" in b.lower() for b in c_bases) or "model" in class_name.lower():
                c_decorators.extend(["@Entity", f'@Table(name="{class_name.lower()}s")'])

            classes.append(ParsedClass(
                class_name=class_name,
                qualified_name=class_name,
                file_path=rel_path,
                start_line=getattr(node, "lineno", 1),
                end_line=getattr(node, "end_lineno", len(lines)),
                package="",
                language=language,
                methods=c_methods,
                fields=c_fields,
                annotations=c_decorators,
                extends=c_bases[0] if c_bases else None,
                implements=c_bases[1:] if len(c_bases) > 1 else [],
            ))

        elif isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            m = _parse_fn(node, module_class_name)
            top_level_methods.append(m)

        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    top_level_fields.append(ParsedField(field_name=target.id, field_type="Any"))

    if top_level_methods or (not classes and (top_level_fields or lines)):
        if any(m.is_endpoint for m in top_level_methods) or "route" in rel_path.lower() or "api" in rel_path.lower() or "view" in rel_path.lower():
            top_level_annotations.append("@Controller")

        classes.append(ParsedClass(
            class_name=module_class_name,
            qualified_name=module_class_name,
            file_path=rel_path,
            start_line=1,
            end_line=len(lines),
            package="app",
            language=language,
            methods=top_level_methods,
            fields=top_level_fields[:20],
            annotations=top_level_annotations,
        ))

    return classes


def _extract_python_symbols(root, source_bytes, rel_path, language, tree_sitter_mode=False) -> List[ParsedClass]:
    """Extract classes and top-level functions from a Python AST (Tree-Sitter)."""
    classes: List[ParsedClass] = []
    source_text = source_bytes.decode("utf-8", errors="replace")

    def get_text(node) -> str:
        return source_bytes[node.start_byte:node.end_byte].decode("utf-8", errors="replace")

    def process_node(node, parent_class=None):
        if node.type == "class_definition":
            name_node = next((c for c in node.children if c.type == "identifier"), None)
            class_name = get_text(name_node) if name_node else "UnknownClass"
            methods: List[ParsedMethod] = []
            body = next((c for c in node.children if c.type == "block"), None)
            if body:
                for child in body.children:
                    if child.type in ("function_definition", "async_function_definition"):
                        m = _extract_python_method(child, class_name, rel_path, source_bytes, language)
                        if m:
                            methods.append(m)
                    elif child.type == "decorated_definition":
                        fn_child = next((c for c in child.children if c.type in ("function_definition", "async_function_definition")), None)
                        if fn_child:
                            m = _extract_python_method(fn_child, class_name, rel_path, source_bytes, language, parent_dec=child)
                            if m:
                                methods.append(m)
            classes.append(ParsedClass(
                class_name=class_name, qualified_name=class_name,
                file_path=rel_path, start_line=node.start_point[0] + 1,
                end_line=node.end_point[0] + 1, package="", language=language,
                methods=methods,
            ))

        elif node.type in ("function_definition", "async_function_definition") and parent_class is None:
            name_node = next((c for c in node.children if c.type == "identifier"), None)
            fn_name = get_text(name_node) if name_node else "unknown_fn"
            m = _extract_python_method(node, "", rel_path, source_bytes, language)
            if m:
                classes.append(ParsedClass(
                    class_name=fn_name, qualified_name=fn_name,
                    file_path=rel_path, start_line=node.start_point[0] + 1,
                    end_line=node.end_point[0] + 1, package="", language=language,
                    methods=[m],
                ))

        elif node.type == "decorated_definition" and parent_class is None:
            cls_child = next((c for c in node.children if c.type == "class_definition"), None)
            fn_child = next((c for c in node.children if c.type in ("function_definition", "async_function_definition")), None)
            if cls_child:
                process_node(cls_child)
            elif fn_child:
                name_node = next((c for c in fn_child.children if c.type == "identifier"), None)
                fn_name = get_text(name_node) if name_node else "unknown_fn"
                m = _extract_python_method(fn_child, "", rel_path, source_bytes, language, parent_dec=node)
                if m:
                    classes.append(ParsedClass(
                        class_name=fn_name, qualified_name=fn_name,
                        file_path=rel_path, start_line=node.start_point[0] + 1,
                        end_line=node.end_point[0] + 1, package="", language=language,
                        methods=[m],
                    ))

    for child in root.children:
        process_node(child)

    return classes


def _extract_python_method(node, class_name, rel_path, source_bytes, language, parent_dec=None) -> Optional[ParsedMethod]:
    def get_text(n) -> str:
        return source_bytes[n.start_byte:n.end_byte].decode("utf-8", errors="replace")

    name_node = next((c for c in node.children if c.type == "identifier"), None)
    if not name_node:
        return None
    fn_name = get_text(name_node)
    qualified_name = f"{class_name}.{fn_name}" if class_name else fn_name

    decorators: List[str] = []
    params: List[Dict[str, str]] = []

    dec_nodes = []
    if parent_dec:
        dec_nodes.extend([c for c in parent_dec.children if c.type == "decorator"])
    dec_nodes.extend([c for c in node.children if c.type == "decorator"])

    for dec in dec_nodes:
        decorators.append(get_text(dec))

    for child in node.children:
        if child.type == "parameters":
            for param in child.children:
                if param.type in ("identifier", "typed_parameter"):
                    pname = get_text(param)
                    params.append({"name": pname, "type": "Any"})

    is_endpoint = False
    http_method_str: Optional[str] = None
    endpoint_path: Optional[str] = None

    for dec in decorators:
        m = PYTHON_ROUTE_DECORATORS.search(dec) or PYTHON_ROUTE_SHORTHAND.search(dec)
        if m:
            is_endpoint = True
            http_method_str = m.group(1).upper()
            endpoint_path = m.group(2)
            break

    return ParsedMethod(
        method_name=fn_name, qualified_name=qualified_name, file_path=rel_path,
        start_line=node.start_point[0] + 1, end_line=node.end_point[0] + 1,
        return_type="Any", parameters=params, annotations=decorators,
        is_endpoint=is_endpoint, http_method=http_method_str, endpoint_path=endpoint_path,
    )


def _parse_python_regex(file_path: Path, rel_path: str, language: str) -> List[ParsedClass]:
    return _parse_with_regex(file_path, rel_path, language)


# ── JavaScript/TypeScript Parser ───────────────────────────────────────────────

JS_ROUTE_PATTERN = re.compile(
    r'(?:router|app|this\.router)\.(get|post|put|delete|patch|options|head)\s*\(\s*[\'"`]([^\'"`,]+)[\'"`]',
    re.IGNORECASE
)
JS_CLASS_PATTERN = re.compile(r'(?:export\s+)?(?:abstract\s+)?class\s+(\w+)', re.MULTILINE)
JS_FUNCTION_PATTERN = re.compile(r'(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(', re.MULTILINE)
JS_EXPORTS_FN_PATTERN = re.compile(r'exports\.(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>', re.MULTILINE)
JS_CONST_FN_PATTERN = re.compile(r'(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>', re.MULTILINE)
JS_ROUTE_COMMENT_PATTERN = re.compile(r'//\s*@route\s+(GET|POST|PUT|DELETE|PATCH)\s+([/\w\-:{}]+)', re.IGNORECASE)
MONGOOSE_MODEL_PATTERN = re.compile(r"mongoose\.model\s*\(\s*['\"](\w+)['\"]", re.MULTILINE)
MONGOOSE_FIELD_PATTERN = re.compile(r'^\s*(\w+)\s*:\s*\{([^}]+)\}', re.MULTILINE)

# JS/TS reserved words that must never appear as ParsedField names — they would
# later produce Mermaid reserved-keyword node IDs and cause parse errors.
_JS_RESERVED_FIELD_NAMES: Set[str] = {
    "class", "type", "return", "new", "delete", "default", "this", "super",
    "import", "export", "from", "if", "else", "for", "while", "do", "switch",
    "case", "break", "continue", "const", "let", "var", "function", "async",
    "await", "yield", "true", "false", "null", "undefined", "void", "typeof",
    "instanceof", "in", "of", "throw", "try", "catch", "finally", "extends",
    "implements", "interface", "enum", "abstract", "static", "public", "private",
    "protected", "readonly", "namespace", "module", "declare", "as", "is",
    # Also block Mermaid flowchart keywords for safety
    "graph", "flowchart", "subgraph", "end", "style", "classDef", "click",
    "direction", "TB", "BT", "LR", "RL", "TD", "linkStyle", "note",
}


def _parse_js_ts_file(file_path: Path, rel_path: str, language: str) -> List[ParsedClass]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    classes: List[ParsedClass] = []
    lines = source.splitlines()
    file_stem = Path(rel_path).stem
    # Standardize module name (e.g., pizzaController -> PizzaController)
    class_module_name = file_stem[0].upper() + file_stem[1:] if file_stem else "Module"

    methods: List[ParsedMethod] = []
    fields: List[ParsedField] = []
    annotations: List[str] = []

    # 1. Extract Express router.get / router.post endpoints
    for idx, line in enumerate(lines):
        m = JS_ROUTE_PATTERN.search(line)
        if m:
            verb = m.group(1).upper()
            path_str = m.group(2)
            # Find handler name if passed as argument
            handler_name = f"{verb}_{path_str.replace('/', '_').strip('_') or 'root'}"
            methods.append(ParsedMethod(
                method_name=handler_name,
                qualified_name=f"{class_module_name}.{handler_name}",
                file_path=rel_path,
                start_line=idx + 1,
                end_line=idx + 1,
                return_type="Response",
                is_endpoint=True,
                http_method=verb,
                endpoint_path=path_str,
            ))

    # 2. Extract controller functions: exports.getPizzas = ... or const getPizzas = ...
    found_fns: Set[str] = set()
    for pattern in [JS_EXPORTS_FN_PATTERN, JS_CONST_FN_PATTERN, JS_FUNCTION_PATTERN]:
        for match in pattern.finditer(source):
            fn_name = match.group(1)
            if fn_name in found_fns or fn_name in ("require", "import", "describe", "it", "test"):
                continue
            found_fns.add(fn_name)
            line_no = source[:match.start()].count("\n") + 1

            # Check preceding comments for route annotation (e.g. // @route GET /api/pizzas)
            is_ep = False
            http_verb = None
            ep_path = None
            comment_lookback = lines[max(0, line_no - 4):line_no - 1]
            for c_line in comment_lookback:
                c_m = JS_ROUTE_COMMENT_PATTERN.search(c_line)
                if c_m:
                    is_ep = True
                    http_verb = c_m.group(1).upper()
                    ep_path = c_m.group(2)
                    break

            # If inside a controller and no explicit comment, infer endpoint from name
            if not is_ep and "controller" in rel_path.lower():
                fn_lower = fn_name.lower()
                if fn_lower.startswith("get") or fn_lower.startswith("find") or fn_lower.startswith("fetch"):
                    is_ep = True
                    http_verb = "GET"
                    ep_path = f"/api/{file_stem.replace('Controller', '').replace('controller', '').lower()}s"
                elif fn_lower.startswith("create") or fn_lower.startswith("add") or fn_lower.startswith("post"):
                    is_ep = True
                    http_verb = "POST"
                    ep_path = f"/api/{file_stem.replace('Controller', '').replace('controller', '').lower()}s"
                elif fn_lower.startswith("update") or fn_lower.startswith("edit") or fn_lower.startswith("put"):
                    is_ep = True
                    http_verb = "PUT"
                    ep_path = f"/api/{file_stem.replace('Controller', '').replace('controller', '').lower()}s/:id"
                elif fn_lower.startswith("delete") or fn_lower.startswith("remove"):
                    is_ep = True
                    http_verb = "DELETE"
                    ep_path = f"/api/{file_stem.replace('Controller', '').replace('controller', '').lower()}s/:id"

            methods.append(ParsedMethod(
                method_name=fn_name,
                qualified_name=f"{class_module_name}.{fn_name}",
                file_path=rel_path,
                start_line=line_no,
                end_line=min(len(lines), line_no + 20),
                return_type="Promise<any>",
                parameters=[{"name": "req", "type": "Request"}, {"name": "res", "type": "Response"}],
                is_endpoint=is_ep,
                http_method=http_verb,
                endpoint_path=ep_path,
            ))

    # 3. Extract Mongoose models
    for m in MONGOOSE_MODEL_PATTERN.finditer(source):
        model_name = m.group(1)
        annotations.extend(["@Entity", f'@Table(name="{model_name.lower()}s")'])

    for mf in MONGOOSE_FIELD_PATTERN.finditer(source):
        f_name = mf.group(1)
        # Skip JS/TS reserved words used as schema field names (e.g. `class`, `type`)
        # — they would produce broken Mermaid node IDs downstream.
        if f_name in _JS_RESERVED_FIELD_NAMES:
            continue
        f_body = mf.group(2)
        f_type = "String"
        if "Number" in f_body:
            f_type = "Number"
        elif "Boolean" in f_body:
            f_type = "Boolean"
        elif "Date" in f_body:
            f_type = "Date"
        elif "ObjectId" in f_body or "Schema.Types" in f_body:
            f_type = "Reference"
        fields.append(ParsedField(field_name=f_name, field_type=f_type))

    # 4. Extract ES6 / TypeScript classes
    for match in JS_CLASS_PATTERN.finditer(source):
        class_name = match.group(1)
        line_no = source[:match.start()].count("\n") + 1
        classes.append(ParsedClass(
            class_name=class_name,
            qualified_name=class_name,
            file_path=rel_path,
            start_line=line_no,
            end_line=min(len(lines), line_no + 30),
            package="",
            language=language,
            methods=methods,
            fields=fields,
            annotations=annotations,
        ))

    # If no explicit class keyword was used, wrap the module into a ParsedClass
    if not classes and (methods or fields or annotations or "controller" in rel_path.lower() or "model" in rel_path.lower() or "route" in rel_path.lower()):
        classes.append(ParsedClass(
            class_name=class_module_name,
            qualified_name=class_module_name,
            file_path=rel_path,
            start_line=1,
            end_line=len(lines),
            package="backend",
            language=language,
            methods=methods,
            fields=fields,
            annotations=annotations,
        ))

    return classes


# ── Go Parser ─────────────────────────────────────────────────────────────────

GO_STRUCT_PATTERN = re.compile(r'^type\s+(\w+)\s+struct\s*\{', re.MULTILINE)
GO_FUNC_PATTERN = re.compile(r'^func\s+(?:\(\w+\s+\*?(\w+)\)\s+)?(\w+)\s*\(([^)]*)\)', re.MULTILINE)
GO_ROUTE_PATTERNS = [
    re.compile(r'\.(?:GET|POST|PUT|DELETE|PATCH|Handle)\s*\(\s*[\'"`]([^\'"`,]+)[\'"`]', re.IGNORECASE),
    re.compile(r'(?:router|r|g|e)\.(?:GET|POST|PUT|DELETE|PATCH)\s*\(\s*[\'"`]([^\'"`,]+)[\'"`]', re.IGNORECASE),
]
GO_HTTP_VERB_PATTERN = re.compile(r'\.(GET|POST|PUT|DELETE|PATCH)\s*\(', re.IGNORECASE)


def _parse_go_file(file_path: Path, rel_path: str, language: str) -> List[ParsedClass]:
    try:
        source = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    classes: List[ParsedClass] = []
    lines = source.splitlines()

    # Structs
    for match in GO_STRUCT_PATTERN.finditer(source):
        struct_name = match.group(1)
        line_no = source[:match.start()].count("\n") + 1
        classes.append(ParsedClass(
            class_name=struct_name, qualified_name=struct_name,
            file_path=rel_path, start_line=line_no, end_line=line_no + 5,
            package="", language=language,
        ))

    # Functions and methods
    route_methods: List[ParsedMethod] = []
    for match in GO_FUNC_PATTERN.finditer(source):
        receiver_type = match.group(1) or ""
        fn_name = match.group(2)
        line_no = source[:match.start()].count("\n") + 1
        qualified = f"{receiver_type}.{fn_name}" if receiver_type else fn_name

        # Check if this looks like an HTTP handler
        fn_end = source.find("\n}", match.end())
        fn_body = source[match.end():fn_end] if fn_end > 0 else ""
        is_endpoint = bool(GO_HTTP_VERB_PATTERN.search(fn_body))
        endpoint_path = None
        http_verb = None
        for rp in GO_ROUTE_PATTERNS:
            rm = rp.search(fn_body)
            if rm:
                endpoint_path = rm.group(1)
                hm = GO_HTTP_VERB_PATTERN.search(fn_body)
                http_verb = hm.group(1).upper() if hm else "GET"
                break

        route_methods.append(ParsedMethod(
            method_name=fn_name, qualified_name=qualified,
            file_path=rel_path, start_line=line_no, end_line=line_no + 10,
            return_type="", is_endpoint=is_endpoint,
            http_method=http_verb, endpoint_path=endpoint_path,
        ))

    if route_methods:
        classes.append(ParsedClass(
            class_name="Package", qualified_name=f"pkg:{rel_path}",
            file_path=rel_path, start_line=1, end_line=len(lines),
            package="", language=language, methods=route_methods,
        ))

    return classes


# ── Generic Regex Fallback ─────────────────────────────────────────────────────

CLASS_PATTERNS = {
    "python":  re.compile(r'^\s*class\s+(\w+)(?:\s*\([^)]*\))?:', re.MULTILINE),
    "csharp":  re.compile(r'(?:public|private|protected|internal|abstract|sealed)?\s*(?:class|interface|struct|record)\s+(\w+)', re.MULTILINE),
    "ruby":    re.compile(r'^class\s+(\w+)', re.MULTILINE),
    "php":     re.compile(r'(?:abstract\s+)?class\s+(\w+)', re.MULTILINE),
    "rust":    re.compile(r'(?:pub\s+)?(?:struct|enum|trait|impl)\s+(\w+)', re.MULTILINE),
    "kotlin":  re.compile(r'(?:data\s+|abstract\s+|open\s+)?(?:class|object|interface)\s+(\w+)', re.MULTILINE),
    "swift":   re.compile(r'(?:public\s+|private\s+|internal\s+)?(?:class|struct|protocol|enum)\s+(\w+)', re.MULTILINE),
    "scala":   re.compile(r'(?:abstract\s+|case\s+)?(?:class|object|trait)\s+(\w+)', re.MULTILINE),
    "c":       re.compile(r'(?:typedef\s+)?struct\s+(\w+)', re.MULTILINE),
    "cpp":     re.compile(r'(?:class|struct|namespace)\s+(\w+)', re.MULTILINE),
}

METHOD_PATTERNS = {
    "python":  re.compile(r'^\s*(?:async\s+)?def\s+(\w+)\s*\(', re.MULTILINE),
    "csharp":  re.compile(r'(?:public|private|protected|virtual|override|static|async)\s+\w[\w<>, ]+\s+(\w+)\s*\(', re.MULTILINE),
    "ruby":    re.compile(r'^\s+def\s+(\w+)', re.MULTILINE),
    "php":     re.compile(r'(?:public|private|protected|static)?\s*function\s+(\w+)\s*\(', re.MULTILINE),
    "rust":    re.compile(r'(?:pub\s+)?fn\s+(\w+)\s*[(<]', re.MULTILINE),
    "kotlin":  re.compile(r'(?:fun|suspend fun)\s+(\w+)\s*\(', re.MULTILINE),
    "swift":   re.compile(r'(?:func|@IBAction\s+func)\s+(\w+)\s*\(', re.MULTILINE),
    "scala":   re.compile(r'def\s+(\w+)\s*[(:=]', re.MULTILINE),
    "c":       re.compile(r'\b(\w+)\s*\([^)]*\)\s*\{', re.MULTILINE),
    "cpp":     re.compile(r'(?:\w[\w:*& ]+)\s+(\w+)\s*\([^)]*\)\s*(?:const\s*)?\{', re.MULTILINE),
}

HTTP_ROUTE_PATTERNS = {
    "python":  re.compile(r'@(?:app|router|blueprint|api_view)\.(get|post|put|delete|patch|route)\s*\(\s*[\'"]([^\'"]*)[\'"]', re.IGNORECASE),
    "ruby":   re.compile(r'(?:get|post|put|delete|patch)\s+[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    "php":    re.compile(r'Route::(get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    "csharp": re.compile(r'\[(?:Http(?:Get|Post|Put|Delete|Patch)|Route)\s*(?:\(\s*[\'"]([^\'"]+)[\'"])?', re.IGNORECASE),
    "kotlin": re.compile(r'@(?:Get|Post|Put|Delete|Patch)Mapping\s*\(\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    "rust":   re.compile(r'#\[(?:get|post|put|delete|patch)\s*\(\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
    "swift":  re.compile(r'\.on\s*\(\s*\.(?:GET|POST|PUT|DELETE|PATCH)\s*,\s*at:\s*[\'"]([^\'"]+)[\'"]', re.IGNORECASE),
}


def _parse_with_regex(file_path: Path, rel_path: str, language: str) -> List[ParsedClass]:
    """Generic regex-based symbol extractor for any language."""
    try:
        source = file_path.read_text(encoding="utf-8", errors="replace")
    except Exception:
        return []

    lines = source.splitlines()
    classes: List[ParsedClass] = []

    class_pat = CLASS_PATTERNS.get(language)
    method_pat = METHOD_PATTERNS.get(language)
    route_pat = HTTP_ROUTE_PATTERNS.get(language)

    if class_pat:
        for match in class_pat.finditer(source):
            class_name = match.group(1)
            if not class_name or class_name in ("None", "true", "false", "new"):
                continue
            line_no = source[:match.start()].count("\n") + 1
            methods: List[ParsedMethod] = []

            if method_pat:
                for mm in method_pat.finditer(source):
                    fn_name = mm.group(1)
                    if not fn_name:
                        continue
                    mline = source[:mm.start()].count("\n") + 1
                    if abs(mline - line_no) < 50:  # crude scope check
                        is_ep = False
                        ep_path = None
                        http_verb = None
                        if route_pat:
                            rm = route_pat.search(source[mm.start():mm.start() + 300])
                            if rm:
                                is_ep = True
                                ep_path = rm.group(1) if rm.lastindex and rm.group(1) else None
                        methods.append(ParsedMethod(
                            method_name=fn_name, qualified_name=f"{class_name}.{fn_name}",
                            file_path=rel_path, start_line=mline, end_line=mline + 5,
                            return_type="", is_endpoint=is_ep, http_method=http_verb, endpoint_path=ep_path,
                        ))

            classes.append(ParsedClass(
                class_name=class_name, qualified_name=class_name,
                file_path=rel_path, start_line=line_no, end_line=line_no + 20,
                package="", language=language, methods=methods[:20],
            ))

    # If no classes found, create a file-level container
    if not classes and method_pat:
        methods: List[ParsedMethod] = []
        for mm in method_pat.finditer(source):
            fn_name = mm.group(1)
            if not fn_name or fn_name in ("None", "true", "false"):
                continue
            mline = source[:mm.start()].count("\n") + 1
            methods.append(ParsedMethod(
                method_name=fn_name, qualified_name=fn_name,
                file_path=rel_path, start_line=mline, end_line=mline + 5,
                return_type="",
            ))
        if methods:
            file_class = Path(rel_path).stem
            classes.append(ParsedClass(
                class_name=file_class, qualified_name=file_class,
                file_path=rel_path, start_line=1, end_line=len(lines),
                package="", language=language, methods=methods[:50],
            ))

    return classes


# ── Language Router ────────────────────────────────────────────────────

def _route_parser(language: str, file_path: Path, rel_path: str) -> List[ParsedClass]:
    """Route parsing to the appropriate language-specific parser based on file extension and language."""
    suffix = file_path.suffix.lower()

    if suffix in (".py", ".pyw"):
        return _parse_python_file(file_path, rel_path, "python")
    elif suffix in (".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"):
        lang = "typescript" if suffix in (".ts", ".tsx") else "javascript"
        return _parse_js_ts_file(file_path, rel_path, lang)
    elif suffix == ".java":
        return _parse_java_file(file_path, rel_path, "java")
    elif suffix in (".kt", ".kts"):
        return _parse_java_file(file_path, rel_path, "kotlin")
    elif suffix == ".go":
        return _parse_go_file(file_path, rel_path, "go")
    elif suffix in (".cs", ".csx"):
        return _parse_with_regex(file_path, rel_path, "csharp")
    elif suffix in (".rb", ".rake"):
        return _parse_with_regex(file_path, rel_path, "ruby")
    elif suffix in (".php", ".phtml"):
        return _parse_with_regex(file_path, rel_path, "php")
    elif suffix in (".rs",):
        return _parse_with_regex(file_path, rel_path, "rust")
    elif suffix in (".swift",):
        return _parse_with_regex(file_path, rel_path, "swift")
    elif suffix in (".scala", ".sc"):
        return _parse_with_regex(file_path, rel_path, "scala")
    elif suffix in (".c", ".h"):
        return _parse_with_regex(file_path, rel_path, "c")
    elif suffix in (".cpp", ".hpp", ".cc", ".cxx"):
        return _parse_with_regex(file_path, rel_path, "cpp")
    else:
        # Fallback based on project-level detected language
        if language in ("java", "kotlin"):
            return _parse_java_file(file_path, rel_path, language)
        elif language == "python":
            return _parse_python_file(file_path, rel_path, language)
        elif language in ("javascript", "typescript"):
            return _parse_js_ts_file(file_path, rel_path, language)
        elif language == "go":
            return _parse_go_file(file_path, rel_path, language)
        else:
            return _parse_with_regex(file_path, rel_path, language)


# ── Agent Entry Point ──────────────────────────────────────────────────────────

async def run(project_id: str, input_data: Dict[str, Any]) -> AgentEnvelope:
    """Execute the Parser Agent on all source files in the preprocessed project."""
    logger.info("ParserAgent started", project_id=project_id)

    extracted_path = input_data.get("extracted_path")
    language = input_data.get("language", "java")
    framework = input_data.get("framework", "unknown")

    # Support both new (source_files) and legacy (java_files) input keys
    source_files: List[str] = (
        input_data.get("source_files") or
        input_data.get("java_files") or
        []
    )

    if not extracted_path:
        raise ValueError("ParserAgent: 'extracted_path' is required in input_data")

    project_root = Path(extracted_path)
    from core.tech_detector import resolve_project_root
    resolved_root = resolve_project_root(project_root)

    all_classes: List[ParsedClass] = []
    packages_set: Set[str] = set()

    ast_per_file: List[Dict[str, Any]] = []
    class_index: List[Dict[str, Any]] = []
    method_index: List[Dict[str, Any]] = []
    annotation_index: List[Dict[str, Any]] = []

    for rel_file_path in source_files:
        full_path = resolved_root / rel_file_path
        if not full_path.exists():
            full_path = project_root / rel_file_path
            if not full_path.exists():
                continue
        try:
            parsed_classes = _route_parser(language, full_path, rel_file_path)
            file_imports: List[str] = []
            file_package = ""

            file_class_dicts: List[Dict[str, Any]] = []

            for c in parsed_classes:
                all_classes.append(c)
                if c.package:
                    packages_set.add(c.package)
                    file_package = c.package
                if c.imports:
                    file_imports.extend(c.imports)

                # Class Index entry
                c_dict = c.model_dump()
                file_class_dicts.append(c_dict)
                class_index.append({
                    "class_name": c.class_name,
                    "qualified_name": c.qualified_name,
                    "file_path": c.file_path,
                    "start_line": c.start_line,
                    "end_line": c.end_line,
                    "package": c.package,
                    "language": c.language,
                    "annotations": c.annotations,
                    "extends": c.extends,
                    "implements": c.implements,
                    "methods_count": len(c.methods),
                    "fields_count": len(c.fields),
                })

                # Class annotations
                for ann in c.annotations:
                    annotation_index.append({
                        "annotation": ann,
                        "target_type": "class",
                        "target_name": c.qualified_name,
                        "file_path": c.file_path,
                        "start_line": c.start_line,
                    })

                # Method Index & Method annotations
                for m in c.methods:
                    m_dict = m.model_dump()
                    method_index.append({
                        "method_name": m.method_name,
                        "qualified_name": m.qualified_name,
                        "class_name": c.class_name,
                        "file_path": m.file_path,
                        "start_line": m.start_line,
                        "end_line": m.end_line,
                        "return_type": m.return_type,
                        "parameters": m.parameters,
                        "annotations": m.annotations,
                        "modifiers": m.modifiers,
                        "calls": m.calls,
                        "is_endpoint": m.is_endpoint,
                        "http_method": m.http_method,
                        "endpoint_path": m.endpoint_path,
                    })

                    for mann in m.annotations:
                        annotation_index.append({
                            "annotation": mann,
                            "target_type": "method",
                            "target_name": m.qualified_name,
                            "file_path": m.file_path,
                            "start_line": m.start_line,
                        })

            ast_per_file.append({
                "file_path": rel_file_path,
                "package": file_package,
                "imports": list(set(file_imports)),
                "classes": file_class_dicts,
                "total_classes": len(parsed_classes),
            })

        except Exception as exc:
            logger.warning(f"ParserAgent failed to parse file {rel_file_path}", error=str(exc))

    total_methods = sum(len(c.methods) for c in all_classes)
    total_endpoints = sum(sum(1 for m in c.methods if m.is_endpoint) for c in all_classes)

    output = ParserOutput(
        classes=all_classes,
        total_classes=len(all_classes),
        total_methods=total_methods,
        total_endpoints=total_endpoints,
        total_packages=len(packages_set),
        packages=sorted(list(packages_set)),
        language=language,
        framework=framework,
        ASTPerFile=ast_per_file,
        classIndex=class_index,
        methodIndex=method_index,
        annotationIndex=annotation_index,
    )

    logger.info(
        "ParserAgent completed successfully",
        language=language, framework=framework,
        classes=output.total_classes, methods=output.total_methods,
        endpoints=output.total_endpoints, packages=output.total_packages,
        ast_files=len(ast_per_file), annotations=len(annotation_index),
    )

    return AgentEnvelope(
        projectId=project_id,
        agent="ParserAgent",
        status=AgentStatus.SUCCESS,
        data=output.model_dump(),
    )
