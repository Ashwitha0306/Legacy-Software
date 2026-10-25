"""
Technology Stack Detector — Universal Language & Framework Detection

Detects the programming language, framework, build tool, and source file
extensions for any codebase by scanning project marker files.

Supports:
  Java        — Spring Boot, Quarkus, Micronaut, plain Java
  Python      — Django, Flask, FastAPI, plain Python
  JavaScript  — Express, NestJS, Next.js, plain Node
  TypeScript  — NestJS, Next.js, Angular, plain TS
  Go          — Gin, Echo, Fiber, plain Go
  C#          — ASP.NET Core, plain C#
  Ruby        — Rails, Sinatra, plain Ruby
  PHP         — Laravel, Symfony, plain PHP
  Rust        — Actix, Axum, plain Rust
  Kotlin      — Ktor, Spring Boot (Kotlin), plain Kotlin
  Swift       — Vapor, plain Swift
  Scala       — Play Framework, Akka, plain Scala
  C/C++       — CMake, Makefile based projects
  Unknown     — Generic fallback (text-level analysis)
"""

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any

from core.logger import get_logger

logger = get_logger(__name__)


class TechStackInfo:
    """Encapsulates detected technology stack information for a project."""

    def __init__(
        self,
        language: str = "unknown",
        framework: str = "unknown",
        build_tool: Optional[str] = None,
        framework_version: Optional[str] = None,
        source_extensions: Optional[List[str]] = None,
        tech_confidence: float = 0.0,
        tech_stack: str = "unknown",
        extra_metadata: Optional[Dict[str, Any]] = None,
    ):
        self.language = language
        self.framework = framework
        self.build_tool = build_tool
        self.framework_version = framework_version
        self.source_extensions = source_extensions or [".txt"]
        self.tech_confidence = tech_confidence
        self.tech_stack = tech_stack or f"{language}-{framework}"
        self.extra_metadata = extra_metadata or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "language": self.language,
            "framework": self.framework,
            "build_tool": self.build_tool,
            "framework_version": self.framework_version,
            "source_extensions": self.source_extensions,
            "tech_confidence": self.tech_confidence,
            "tech_stack": self.tech_stack,
            "extra_metadata": self.extra_metadata,
        }


# ── Excluded directories (always pruned during file scan) ─────────────────────
EXCLUDED_DIRS: set = {
    "node_modules", "__pycache__", ".git", ".github", ".idea", ".vscode",
    "target", "build", ".gradle", ".mvn", "dist", "out", ".next",
    "vendor", "bin", "obj", ".dart_tool", ".pub-cache",
    "venv", ".venv", "env", ".env_dir", "site-packages",
    "Pods", ".build", "DerivedData",
}

EXCLUDED_EXTENSIONS: set = {
    ".class", ".jar", ".war", ".ear", ".zip", ".tar", ".gz", ".whl",
    ".pyc", ".pyo", ".o", ".so", ".dll", ".exe", ".bin", ".out",
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp",
    ".pdf", ".docx", ".xlsx", ".pptx",
    ".lock",  # package-lock.json / yarn.lock / Cargo.lock should NOT be parsed as source
}


# ── Detection rules ───────────────────────────────────────────────────────────
import fnmatch
import os


def _safe_rglob(root: Path, pattern: str) -> List[Path]:
    """Glob files while strictly pruning EXCLUDED_DIRS."""
    matches: List[Path] = []
    try:
        for dirpath, dirnames, filenames in os.walk(root, onerror=lambda e: None):
            dirnames[:] = [
                d for d in dirnames
                if d not in EXCLUDED_DIRS
                and not d.startswith(".")
                and "{" not in d
                and not any(c in d for c in '<>:"|?*')
            ]
            for fn in filenames:
                try:
                    if fnmatch.fnmatch(fn, pattern):
                        matches.append(Path(dirpath) / fn)
                except Exception:
                    continue
    except Exception:
        pass
    return matches


def _read_file_safe(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return ""


def _find_marker(root: Path, filename: str) -> Optional[Path]:
    """Find a marker file at root or in immediate subdirectories (skipping excluded dirs)."""
    try:
        p = root / filename
        if p.is_file():
            return p
    except Exception:
        pass
    try:
        for item in root.iterdir():
            try:
                if (
                    item.is_dir()
                    and item.name not in EXCLUDED_DIRS
                    and not item.name.startswith(".")
                    and "{" not in item.name
                    and not any(c in item.name for c in '<>:"|?*')
                ):
                    sub_p = item / filename
                    if sub_p.is_file():
                        return sub_p
            except Exception:
                continue
    except Exception:
        pass
    return None


def _detect_java(root: Path) -> Optional[TechStackInfo]:
    pom = _find_marker(root, "pom.xml")
    gradle = _find_marker(root, "build.gradle")
    gradle_kts = _find_marker(root, "build.gradle.kts")

    build_file = pom or gradle or gradle_kts
    has_java = bool(_safe_rglob(root, "*.java"))
    if build_file is None and not has_java:
        return None

    build_tool = "maven" if pom else ("gradle" if (gradle or gradle_kts) else None)
    content = _read_file_safe(build_file) if build_file else ""
    content_lower = content.lower()

    framework = "java"
    framework_version = None
    confidence = 0.95 if (build_file and has_java) else (0.80 if has_java else 0.60)

    if "spring-boot" in content_lower or "springframework" in content_lower or any("spring" in _read_file_safe(f).lower() for f in _safe_rglob(root, "*.java")[:5]):
        framework = "spring-boot"
        confidence = 0.98
        m = re.search(r"<version>([\d.]+(?:[\.\-]\w+)?)</version>", content)
        if m:
            framework_version = m.group(1)
    elif "quarkus" in content_lower:
        framework = "quarkus"
        confidence = 0.96
    elif "micronaut" in content_lower:
        framework = "micronaut"
        confidence = 0.96
    elif "ktor" in content_lower:
        framework = "ktor"
        confidence = 0.94
    elif has_java:
        framework = "plain-java"
        confidence = 0.95 if build_file else 0.80

    # Kotlin override: if primarily .kt files
    kt_count = len(_safe_rglob(root, "*.kt"))
    java_count = len(_safe_rglob(root, "*.java"))
    if kt_count > java_count:
        return TechStackInfo(
            language="kotlin", framework=framework, build_tool=build_tool,
            framework_version=framework_version, source_extensions=[".kt", ".java"],
            tech_confidence=confidence, tech_stack=f"kotlin-{framework}",
        )

    return TechStackInfo(
        language="java", framework=framework, build_tool=build_tool,
        framework_version=framework_version, source_extensions=[".java"],
        tech_confidence=confidence, tech_stack=f"java-{framework}",
    )


def _detect_python(root: Path) -> Optional[TechStackInfo]:
    markers = ["requirements.txt", "Pipfile", "pyproject.toml", "setup.py", "setup.cfg"]
    found_marker = None
    for m in markers:
        fm = _find_marker(root, m)
        if fm:
            found_marker = fm
            break
    has_py = bool(_safe_rglob(root, "*.py"))
    if not found_marker and not has_py:
        return None

    build_tool = "pip"
    if found_marker:
        if found_marker.name == "pyproject.toml":
            build_tool = "poetry/hatch"
        elif found_marker.name == "Pipfile":
            build_tool = "pipenv"

    req_content = _read_file_safe(found_marker).lower() if found_marker else ""
    framework = "plain-python"
    confidence = 0.75
    framework_version = None

    if "django" in req_content:
        framework = "django"
        confidence = 0.97
        m = re.search(r"django[=~><!]+([^\s,]+)", req_content)
        framework_version = m.group(1) if m else None
    elif "flask" in req_content:
        framework = "flask"
        confidence = 0.96
    elif "fastapi" in req_content:
        framework = "fastapi"
        confidence = 0.96
    elif "tornado" in req_content:
        framework = "tornado"
        confidence = 0.90
    elif "aiohttp" in req_content:
        framework = "aiohttp"
        confidence = 0.88

    return TechStackInfo(
        language="python", framework=framework, build_tool=build_tool,
        framework_version=framework_version, source_extensions=[".py"],
        tech_confidence=confidence, tech_stack=f"python-{framework}",
    )


def _detect_javascript(root: Path) -> Optional[TechStackInfo]:
    pkg_path = _find_marker(root, "package.json")
    ts_files = _safe_rglob(root, "*.ts") + _safe_rglob(root, "*.tsx")
    js_files = _safe_rglob(root, "*.js") + _safe_rglob(root, "*.jsx")
    has_js = bool(pkg_path or ts_files or js_files)
    if not pkg_path and not has_js:
        return None

    pkg = {}
    if pkg_path:
        try:
            pkg = json.loads(pkg_path.read_text(encoding="utf-8", errors="ignore"))
        except Exception:
            pkg = {}

    deps = {**pkg.get("dependencies", {}), **pkg.get("devDependencies", {})}
    deps_lower = {str(k).lower(): str(v) for k, v in deps.items()}

    # Determine language (JS vs TS)
    has_ts = "typescript" in deps_lower or bool(ts_files)
    ts_count = len(ts_files)
    js_count = len(js_files)
    language = "typescript" if (has_ts and ts_count > js_count // 2) else "javascript"
    exts = [".ts", ".tsx", ".js", ".jsx"] if language == "typescript" else [".js", ".jsx", ".mjs", ".cjs"]

    framework = "plain-node"
    confidence = 0.80 if pkg_path else 0.40

    if "@nestjs/core" in deps_lower or "nestjs" in str(deps_lower):
        framework = "nestjs"
        confidence = 0.97
    elif "next" in deps_lower:
        framework = "nextjs"
        confidence = 0.96
    elif "express" in deps_lower or (
        pkg_path and any(
            re.search(r'''(?:require\s*\(\s*['"]express['"]|from\s+['"]express['"])''', _read_file_safe(f))
            for f in list(root.rglob("*.js"))[:5]
        )
    ):
        framework = "express"
        confidence = 0.96 if pkg_path else 0.50
    elif "fastify" in deps_lower:
        framework = "fastify"
        confidence = 0.95
    elif "koa" in deps_lower:
        framework = "koa"
        confidence = 0.93
    elif "@angular/core" in deps_lower:
        framework = "angular"
        confidence = 0.97
    elif "vue" in deps_lower:
        framework = "vue"
        confidence = 0.95
    elif "react" in deps_lower:
        framework = "react"
        confidence = 0.90

    return TechStackInfo(
        language=language, framework=framework, build_tool="npm/yarn",
        framework_version=deps_lower.get(framework, None),
        source_extensions=exts,
        tech_confidence=confidence, tech_stack=f"{language}-{framework}",
    )


def _detect_go(root: Path) -> Optional[TechStackInfo]:
    mod_path = root / "go.mod"
    if not mod_path.exists():
        return None

    content = _read_file_safe(mod_path).lower()
    framework = "plain-go"
    confidence = 0.88

    if "gin-gonic/gin" in content:
        framework = "gin"
        confidence = 0.97
    elif "labstack/echo" in content:
        framework = "echo"
        confidence = 0.96
    elif "gofiber/fiber" in content:
        framework = "fiber"
        confidence = 0.96
    elif "go-chi/chi" in content:
        framework = "chi"
        confidence = 0.93

    return TechStackInfo(
        language="go", framework=framework, build_tool="go-modules",
        source_extensions=[".go"],
        tech_confidence=confidence, tech_stack=f"go-{framework}",
    )


def _detect_csharp(root: Path) -> Optional[TechStackInfo]:
    csproj_files = _safe_rglob(root, "*.csproj")
    sln_files = _safe_rglob(root, "*.sln")
    if not csproj_files and not sln_files:
        return None

    framework = "plain-dotnet"
    confidence = 0.85

    for csproj in csproj_files[:3]:
        content = _read_file_safe(csproj).lower()
        if "microsoft.aspnetcore" in content:
            framework = "aspnet-core"
            confidence = 0.97
            break
        elif "microsoft.net.sdk.web" in content:
            framework = "aspnet-core"
            confidence = 0.94
            break

    return TechStackInfo(
        language="csharp", framework=framework, build_tool="dotnet-sdk",
        source_extensions=[".cs", ".cshtml", ".razor"],
        tech_confidence=confidence, tech_stack=f"csharp-{framework}",
    )


def _detect_ruby(root: Path) -> Optional[TechStackInfo]:
    gemfile = root / "Gemfile"
    if not gemfile.exists():
        return None

    content = _read_file_safe(gemfile).lower()
    framework = "plain-ruby"
    confidence = 0.82

    if "rails" in content:
        framework = "rails"
        confidence = 0.97
        m = re.search(r"gem\s+['\"]rails['\"]\s*,\s*['\"]([^'\"]+)['\"]", content)
    elif "sinatra" in content:
        framework = "sinatra"
        confidence = 0.95
    elif "hanami" in content:
        framework = "hanami"
        confidence = 0.93

    return TechStackInfo(
        language="ruby", framework=framework, build_tool="bundler",
        source_extensions=[".rb", ".erb"],
        tech_confidence=confidence, tech_stack=f"ruby-{framework}",
    )


def _detect_php(root: Path) -> Optional[TechStackInfo]:
    composer = root / "composer.json"
    if not composer.exists():
        return None

    try:
        pkg = json.loads(composer.read_text(encoding="utf-8", errors="ignore"))
    except Exception:
        pkg = {}

    requires = {**pkg.get("require", {}), **pkg.get("require-dev", {})}
    framework = "plain-php"
    confidence = 0.80

    if "laravel/framework" in requires:
        framework = "laravel"
        confidence = 0.97
    elif "symfony/symfony" in requires or "symfony/framework-bundle" in requires:
        framework = "symfony"
        confidence = 0.97
    elif "slim/slim" in requires:
        framework = "slim"
        confidence = 0.93
    elif "codeigniter4/framework" in requires:
        framework = "codeigniter"
        confidence = 0.93

    return TechStackInfo(
        language="php", framework=framework, build_tool="composer",
        source_extensions=[".php"],
        tech_confidence=confidence, tech_stack=f"php-{framework}",
    )


def _detect_rust(root: Path) -> Optional[TechStackInfo]:
    cargo = root / "Cargo.toml"
    if not cargo.exists():
        return None

    content = _read_file_safe(cargo).lower()
    framework = "plain-rust"
    confidence = 0.88

    if "actix-web" in content:
        framework = "actix"
        confidence = 0.97
    elif "axum" in content:
        framework = "axum"
        confidence = 0.97
    elif "rocket" in content:
        framework = "rocket"
        confidence = 0.96
    elif "warp" in content:
        framework = "warp"
        confidence = 0.93

    return TechStackInfo(
        language="rust", framework=framework, build_tool="cargo",
        source_extensions=[".rs"],
        tech_confidence=confidence, tech_stack=f"rust-{framework}",
    )


def _detect_swift(root: Path) -> Optional[TechStackInfo]:
    pkg_swift = root / "Package.swift"
    if not pkg_swift.exists():
        return None

    content = _read_file_safe(pkg_swift).lower()
    framework = "plain-swift"
    confidence = 0.85

    if "vapor" in content:
        framework = "vapor"
        confidence = 0.97
    elif "hummingbird" in content:
        framework = "hummingbird"
        confidence = 0.93

    return TechStackInfo(
        language="swift", framework=framework, build_tool="swift-package-manager",
        source_extensions=[".swift"],
        tech_confidence=confidence, tech_stack=f"swift-{framework}",
    )


def _detect_scala(root: Path) -> Optional[TechStackInfo]:
    sbt = root / "build.sbt"
    if not sbt.exists():
        return None

    content = _read_file_safe(sbt).lower()
    framework = "plain-scala"
    confidence = 0.85

    if "playframework" in content or "com.typesafe.play" in content:
        framework = "play-framework"
        confidence = 0.96
    elif "akka" in content:
        framework = "akka"
        confidence = 0.95

    return TechStackInfo(
        language="scala", framework=framework, build_tool="sbt",
        source_extensions=[".scala"],
        tech_confidence=confidence, tech_stack=f"scala-{framework}",
    )


def _detect_c_cpp(root: Path) -> Optional[TechStackInfo]:
    has_cmake = (root / "CMakeLists.txt").exists()
    has_makefile = (root / "Makefile").exists() or (root / "makefile").exists()
    c_files = _safe_rglob(root, "*.c") + _safe_rglob(root, "*.cpp")

    if not (has_cmake or has_makefile) and not c_files:
        return None

    has_cpp = bool(_safe_rglob(root, "*.cpp")) or bool(_safe_rglob(root, "*.cc")) or bool(_safe_rglob(root, "*.cxx"))
    language = "cpp" if has_cpp else "c"
    build_tool = "cmake" if has_cmake else ("make" if has_makefile else None)
    exts = [".cpp", ".cc", ".cxx", ".hpp", ".h", ".c"] if has_cpp else [".c", ".h"]

    return TechStackInfo(
        language=language, framework=f"plain-{language}", build_tool=build_tool,
        source_extensions=exts,
        tech_confidence=0.82, tech_stack=f"{language}-native",
    )


# ── Public API ─────────────────────────────────────────────────────────────────

_DETECTORS = [
    _detect_java,
    _detect_python,
    _detect_javascript,
    _detect_go,
    _detect_csharp,
    _detect_ruby,
    _detect_php,
    _detect_rust,
    _detect_swift,
    _detect_scala,
    _detect_c_cpp,
]


def resolve_project_root(path: Path) -> Path:
    """
    Unwrap top-level wrapper directory (e.g., repo-main/ or extracted zip folder)
    if no build markers exist at top level but exist in a single subfolder.
    """
    try:
        if not path.exists() or not path.is_dir():
            return path
    except Exception:
        return path

    # Quick check for marker files at current level
    markers = ["pom.xml", "build.gradle", "requirements.txt", "package.json", "go.mod", "Cargo.toml", "Gemfile", "composer.json", "pyproject.toml"]
    try:
        if any((path / m).is_file() for m in markers):
            return path
    except Exception:
        pass

    # Check if there's any source file directly in current directory
    try:
        if any(f.is_file() for f in path.iterdir()):
            return path
    except Exception:
        pass

    # If single subdirectory exists, unwrap
    try:
        subdirs = [
            d for d in path.iterdir()
            if d.is_dir()
            and not d.name.startswith(".")
            and d.name not in EXCLUDED_DIRS
            and "{" not in d.name
            and not any(c in d.name for c in '<>:"|?*')
        ]
        if len(subdirs) == 1:
            return resolve_project_root(subdirs[0])
    except Exception:
        pass

    return path


def detect(project_root: Path) -> TechStackInfo:
    """
    Run all technology detectors against the project root and return the
    best-match TechStackInfo, falling back to a generic 'unknown' profile
    if no detector fires.

    Multiple detectors may match (e.g., a monorepo with Java + Node.js).
    The one with the highest tech_confidence wins.
    """
    project_root = resolve_project_root(project_root)
    candidates: List[TechStackInfo] = []

    for detector_fn in _DETECTORS:
        try:
            result = detector_fn(project_root)
            if result is not None:
                candidates.append(result)
                logger.debug(
                    "Tech detector matched",
                    detector=detector_fn.__name__,
                    language=result.language,
                    framework=result.framework,
                    confidence=result.tech_confidence,
                )
        except Exception as exc:
            logger.warning(f"Tech detector {detector_fn.__name__} raised exception", error=str(exc))

    if not candidates:
        logger.warning("No technology detected; using generic fallback", path=str(project_root))
        # Count files to make a best-effort guess
        all_files = list(project_root.rglob("*.*"))
        ext_counts: Dict[str, int] = {}
        for f in all_files:
            ext_counts[f.suffix] = ext_counts.get(f.suffix, 0) + 1
        most_common_ext = max(ext_counts, key=ext_counts.get) if ext_counts else ".txt"
        return TechStackInfo(
            language="unknown", framework="unknown", build_tool=None,
            source_extensions=[most_common_ext],
            tech_confidence=0.1, tech_stack="unknown",
            extra_metadata={"ext_counts": ext_counts},
        )

    best = max(candidates, key=lambda x: x.tech_confidence)
    # Collect extensions across all strong candidates for polyglot projects
    combined_exts = set(best.source_extensions)
    for c in candidates:
        if c.tech_confidence >= 0.6:
            combined_exts.update(c.source_extensions)
    best.source_extensions = sorted(list(combined_exts))

    logger.info(
        "Technology stack detected",
        language=best.language,
        framework=best.framework,
        confidence=best.tech_confidence,
        tech_stack=best.tech_stack,
        extensions=best.source_extensions,
    )
    return best


ALL_CODE_EXTENSIONS: set = {
    ".java", ".kt", ".py", ".js", ".jsx", ".ts", ".tsx",
    ".go", ".cs", ".php", ".rb", ".rs", ".c", ".cpp", ".h",
}


def find_source_files(project_root: Path, extensions: List[str]) -> Tuple[List[str], List[str]]:
    """
    Walk project_root and return (source_files, excluded_files) relative paths.
    Prunes EXCLUDED_DIRS and filters out EXCLUDED_EXTENSIONS.
    Discovers all legitimate source code files in the codebase (supporting polyglot repositories).
    """
    import os
    project_root = resolve_project_root(project_root)
    source_files: List[str] = []
    excluded_files: List[str] = []

    ext_set = set(e.lower() for e in extensions if e and e != ".txt")
    combined_ext_set = ext_set.union(ALL_CODE_EXTENSIONS) if ext_set else ALL_CODE_EXTENSIONS

    for root, dirs, files in os.walk(project_root, onerror=lambda e: None):
        root_path = Path(root)
        dirs[:] = [
            d for d in dirs
            if d not in EXCLUDED_DIRS
            and not d.startswith(".")
            and "{" not in d
            and not any(c in d for c in '<>:"|?*')
        ]

        for filename in files:
            try:
                file_path = root_path / filename
                rel_path = str(file_path.relative_to(project_root)).replace("\\", "/")
                suffix = file_path.suffix.lower()

                if suffix in EXCLUDED_EXTENSIONS:
                    excluded_files.append(rel_path)
                elif suffix in combined_ext_set:
                    source_files.append(rel_path)
            except Exception:
                continue

    return sorted(source_files), sorted(excluded_files)
