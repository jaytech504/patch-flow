"""
Framework adapters for PatchFlow Phase 3.

Each adapter captures everything PatchFlow needs to know about one framework:
  - Detection signals (files / deps / code patterns)
  - Code-generation rules fed verbatim into the FixAgent prompt
  - Endpoint-location patterns used by the programmatic locator
  - Deterministic review pre-checks (no LLM required)
  - Validation commands run after a fix is applied

Supported adapters (ranked by current vibe-coding prevalence):
  fastapi      Python / asyncio, Pydantic, HTTPException
  flask        Python / sync routes, Blueprints, abort()
  nextjs       TypeScript / App Router route.ts, NextRequest/NextResponse
  express      TypeScript or JavaScript / req,res,next, Router
  nestjs       TypeScript / @Controller, @Get/@Post, Filters, Pipes
  hono         TypeScript / Edge-ready, c.json(), c.req, HonoError
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Callable


# ── Data model ────────────────────────────────────────────────────────────────

@dataclass
class FrameworkAdapter:
    name: str               # canonical slug, e.g. "fastapi"
    language: str           # "python" | "typescript" | "javascript"
    display_name: str       # human label shown in prompts / logs

    # --- Detection ------------------------------------------------------------
    # package.json dep keys that identify this framework (Node only)
    npm_deps: list[str] = field(default_factory=list)
    # Python requirements keywords (lowercased)
    py_deps: list[str] = field(default_factory=list)
    # File paths whose existence confirms this framework
    marker_files: list[str] = field(default_factory=list)
    # Regex patterns searched in source files to confirm framework usage
    source_patterns: list[str] = field(default_factory=list)

    # --- Code generation rules -----------------------------------------------
    # Injected verbatim into the FixAgent system prompt as a bullet list
    generation_rules: list[str] = field(default_factory=list)

    # --- Endpoint location ---------------------------------------------------
    # Regex strings that match route-definition lines for this framework.
    # Each is tried against every source line; first match wins.
    route_patterns: list[str] = field(default_factory=list)
    # Extra path variants to generate when searching for an endpoint
    # Callable: (path: str) -> list[str]
    path_variants_fn: Callable[[str], list[str]] | None = None

    # --- Review pre-checks ---------------------------------------------------
    # Framework-specific deterministic checks run before the LLM review.
    # Callable: (code_after: str, imports: list[str]) -> list[str]  (issues)
    precheck_fn: Callable[[str, list[str]], list[str]] | None = None

    # --- Validation commands -------------------------------------------------
    # Shell commands run inside the repo after a fix is applied.
    # Each entry: (label, [command, args...])
    validation_commands: list[tuple[str, list[str]]] = field(default_factory=list)

    # --- Build command --------------------------------------------------------
    # The build command to run before pushing a PR.
    # For JS/TS: ["run", "build"] — the package manager is prefixed at runtime.
    # For Python: ["python", "-m", "py_compile"] — invoked per changed file.
    # None means no build validation is available for this framework.
    build_command: list[str] | None = None


# ── Pre-check helpers (framework-specific) ────────────────────────────────────

def _fastapi_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    uses_http_exc = "HTTPException" in code_after
    has_import = any("HTTPException" in i for i in imports) or "HTTPException" in code_after.split("\n")[0]
    if uses_http_exc and not has_import:
        issues.append("HTTPException used but not imported — add 'from fastapi import HTTPException'.")
    if "except Exception:" in code_after and "raise HTTPException" not in code_after:
        issues.append(
            "Bare 'except Exception' swallows errors without re-raising as HTTPException. "
            "Callers will receive no useful status code."
        )
    if re.search(r"async def \w+.*:(?!\s*\n\s+try)", code_after):
        if "try:" not in code_after:
            issues.append("Async endpoint has no try/except block — unhandled exceptions crash the worker.")
    return issues


def _flask_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    if "abort(" in code_after:
        has_abort = any("abort" in i for i in imports) or "from flask import" in code_after
        if not has_abort:
            issues.append("abort() used but 'abort' not imported — add 'from flask import abort'.")
    if "except Exception:" in code_after and "abort(" not in code_after and "jsonify" not in code_after:
        issues.append(
            "Bare 'except Exception' without abort() or jsonify() — Flask will return an unformatted 500."
        )
    if "return" in code_after and "jsonify" not in code_after and "make_response" not in code_after:
        # Only warn if returning a plain dict (common mistake in Flask < 2.2)
        if re.search(r"return\s*\{", code_after):
            issues.append(
                "Returning a plain dict without jsonify() — use 'return jsonify({...}), status_code'."
            )
    return issues


def _nextjs_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []

    # Check NextResponse is imported when used in App Router
    if "NextResponse" in code_after:
        all_code = "\n".join(imports) + "\n" + code_after
        has_import = (
            "from 'next/server'" in all_code
            or 'from "next/server"' in all_code
            or any("next/server" in imp for imp in imports)
            or any("NextResponse" in imp for imp in imports)
        )
        if not has_import:
            if "export " in code_after and "import " in code_after and "next/server" not in code_after:
                issues.append(
                    "NextResponse used but not imported — add \"import { NextResponse } from 'next/server'\"."
                )

    # Supabase checks
    if "supabase" in code_after.lower():
        # Check if raw error object is sent to client
        if re.search(r"(?:res\.status\(\d+\)\.json|NextResponse\.json)\(\s*error\s*\)", code_after):
            issues.append(
                "Raw Supabase error object returned in response — this leaks database schema details. "
                "Return a sanitized error message instead: { error: 'Failed to process request' }."
            )

    # Check catch block returns or sends response
    if re.search(r"catch\s*\(\w+\)\s*\{[^}]*console\.(error|log|warn)", code_after, re.DOTALL):
        has_response = (
            "NextResponse.json" in code_after
            or "new Response" in code_after
            or "res.status(" in code_after
            or "res.json(" in code_after
            or "res.end(" in code_after
            or "return {" in code_after  # getServerSideProps returns props
        )
        if not has_response:
            issues.append(
                "catch block logs the error but doesn't return or send a response — the client will hang."
            )

    # Unguarded custom process.env access (exclude standard Node.js built-ins and guarded expressions)
    env_accesses = [
        v for v in re.findall(r"process\.env\.(\w+)", code_after)
        if v not in ("NODE_ENV", "VERCEL_ENV", "NEXT_RUNTIME", "PORT")
    ]
    for var in env_accesses:
        has_guard = (
            re.search(rf"if\s*\(\s*[!]?\s*(?:process\.env\.{var}|[a-zA-Z_]\w*)\s*\)", code_after)
            or re.search(rf"process\.env\.{var}\s*(?:\?\?|\|\||===|!==|==|!=|\?)", code_after)
        )
        if not has_guard:
            issues.append(
                f"process.env.{var} accessed without a guard — "
                "check the variable is defined before using it."
            )
            break  # report once

    return issues


def _express_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    # async handler without try/catch is a silent crash in Express 4
    if re.search(r"async\s+(?:function\s+\w+|\(\w[^)]*\)|\w+)\s*\(req", code_after):
        if "try {" not in code_after and "try{" not in code_after:
            issues.append(
                "Async Express handler has no try/catch — unhandled promise rejections crash Express 4. "
                "Wrap the body in try/catch and call next(err)."
            )
    if "next(err)" not in code_after and "next(error)" not in code_after:
        if "catch" in code_after:
            issues.append(
                "catch block doesn't call next(err) — Express error middleware will never be reached."
            )
    if re.search(r"res\.send\(err\)|res\.json\(err\)", code_after):
        issues.append(
            "Sending raw Error objects leaks stack traces to clients — serialize to a safe message first."
        )
    return issues


def _nestjs_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    if "throw new HttpException" in code_after or "throw new BadRequestException" in code_after:
        has_import = any("HttpException" in i or "BadRequestException" in i for i in imports)
        if not has_import:
            issues.append(
                "NestJS exception thrown but not imported — "
                "add 'import { HttpException, HttpStatus } from \"@nestjs/common\"'."
            )
    if "catch" in code_after and "throw" not in code_after and "HttpException" not in code_after:
        issues.append(
            "catch block doesn't re-throw as HttpException — NestJS will swallow the error silently."
        )
    if "@UseFilters" in code_after:
        has_import = any("UseFilters" in i for i in imports)
        if not has_import:
            issues.append("@UseFilters used but not imported from '@nestjs/common'.")
    return issues


def _hono_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    if "c.json(" not in code_after and "return" in code_after:
        if re.search(r"return\s+(?!c\.json|c\.text|c\.html|c\.body|c\.redirect)", code_after):
            issues.append(
                "Hono handlers should return c.json(), c.text(), or c.html() — "
                "returning a plain value may produce an empty response."
            )
    if "HTTPException" in code_after:
        has_import = any("HTTPException" in i for i in imports)
        if not has_import:
            issues.append("Hono HTTPException used but not imported — add 'import { HTTPException } from \"hono/http-exception\"'.")
    if "app.onError" not in code_after and "try {" not in code_after and "catch" not in code_after:
        if re.search(r"app\.\w+\(|\.get\(|\.post\(", code_after):
            issues.append(
                "Hono route has no error handling — add try/catch or register app.onError() globally."
            )
    return issues


# ── Path variant helpers ───────────────────────────────────────────────────────

def _nextjs_path_variants(path: str) -> list[str]:
    """
    Next.js uses filesystem routing for both App Router and Pages Router.
    Handles:
      /api/notes      → app/api/notes/route.ts, pages/api/notes.ts, etc.
      /dashboard      → pages/dashboard.tsx, app/dashboard/page.tsx, etc.
      /api/users/{id} → app/api/users/[id]/route.ts, pages/api/users/[id].ts
    """
    raw_seg = path.strip("/")
    sub_seg = raw_seg[4:] if raw_seg.startswith("api/") else raw_seg

    raw_fs = re.sub(r"\{([^}]+)\}", r"[\1]", raw_seg)
    sub_fs = re.sub(r"\{([^}]+)\}", r"[\1]", sub_seg)

    variants = []
    for ext in ("ts", "tsx", "js", "jsx"):
        variants.extend([
            f"app/api/{sub_fs}/route.{ext}",
            f"src/app/api/{sub_fs}/route.{ext}",
            f"app/{raw_fs}/route.{ext}",
            f"src/app/{raw_fs}/route.{ext}",
            f"app/{raw_fs}/page.{ext}",
            f"src/app/{raw_fs}/page.{ext}",
            f"app/{sub_fs}/page.{ext}",
            f"src/app/{sub_fs}/page.{ext}",
            f"pages/api/{sub_fs}.{ext}",
            f"pages/api/{sub_fs}/index.{ext}",
            f"src/pages/api/{sub_fs}.{ext}",
            f"src/pages/api/{sub_fs}/index.{ext}",
            f"pages/{raw_fs}.{ext}",
            f"pages/{raw_fs}/index.{ext}",
            f"src/pages/{raw_fs}.{ext}",
            f"src/pages/{raw_fs}/index.{ext}",
            f"pages/{sub_fs}.{ext}",
            f"src/pages/{sub_fs}.{ext}",
        ])
    return variants


def _express_path_variants(path: str) -> list[str]:
    """Express uses :param, also matches router.get('/path') patterns."""
    colon_path = re.sub(r"\{([^}]+)\}", r":\1", path)
    return [colon_path, path]


def _hono_path_variants(path: str) -> list[str]:
    """Hono uses :param like Express but also supports {param}."""
    colon_path = re.sub(r"\{([^}]+)\}", r":\1", path)
    return [colon_path, path]


def _django_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    if "JsonResponse(" in code_after:
        has_import = any("JsonResponse" in i for i in imports) or "JsonResponse" in code_after.split("\n")[0]
        if not has_import:
            issues.append("JsonResponse used but not imported — add 'from django.http import JsonResponse'.")
    if "Response(" in code_after and "JsonResponse(" not in code_after:
        has_resp = any("Response" in i for i in imports) or "from rest_framework.response import" in code_after
        if not has_resp:
            issues.append("DRF Response used but not imported — add 'from rest_framework.response import Response'.")
    if "status.HTTP_" in code_after:
        has_status = any("status" in i for i in imports) or "from rest_framework import status" in code_after
        if not has_status:
            issues.append("DRF status used but not imported — add 'from rest_framework import status'.")
    if "except Exception:" in code_after and "JsonResponse" not in code_after and "Response" not in code_after and "raise" not in code_after:
        issues.append("Bare 'except Exception' without returning JsonResponse/Response or re-raising — client will receive no response.")
    return issues


def _django_path_variants(path: str) -> list[str]:
    """Django routes often omit leading slash, e.g. path('users/', ...) or path('api/users', ...)."""
    stripped = path.strip("/")
    return [path, stripped, f"{stripped}/", f"/{stripped}/"]


def _springboot_precheck(code_after: str, imports: list[str]) -> list[str]:
    issues: list[str] = []
    if "ResponseEntity" in code_after:
        has_import = any("ResponseEntity" in i for i in imports) or "ResponseEntity" in code_after
        if not has_import:
            issues.append("ResponseEntity used but not imported — add 'import org.springframework.http.ResponseEntity;'.")
    if "HttpStatus" in code_after:
        has_import = any("HttpStatus" in i for i in imports) or "HttpStatus" in code_after
        if not has_import:
            issues.append("HttpStatus used but not imported — add 'import org.springframework.http.HttpStatus;'.")
    return issues


def _springboot_path_variants(path: str) -> list[str]:
    """Spring Boot routes often use @GetMapping('/users') or @GetMapping('users')."""
    stripped = path.strip("/")
    curly = re.sub(r":(\w+)", r"{\1}", path)
    return [path, f"/{stripped}", stripped, curly]


# ── Adapter registry ──────────────────────────────────────────────────────────

ADAPTERS: dict[str, FrameworkAdapter] = {}


def _reg(a: FrameworkAdapter) -> FrameworkAdapter:
    ADAPTERS[a.name] = a
    return a


_reg(FrameworkAdapter(
    name="fastapi",
    language="python",
    display_name="FastAPI",
    py_deps=["fastapi"],
    source_patterns=[
        r"from fastapi import",
        r"@app\.(get|post|put|patch|delete|router)\(",
        r"@router\.(get|post|put|patch|delete)\(",
    ],
    generation_rules=[
        "Use specific exception types: sqlalchemy.exc.SQLAlchemyError, httpx.TimeoutException, "
        "httpx.ConnectError, httpx.HTTPStatusError.",
        "Raise HTTPException(status_code=..., detail=...) from caught exceptions — never expose raw error messages.",
        "Use status codes from fastapi import status (e.g. status.HTTP_503_SERVICE_UNAVAILABLE).",
        "For async routes, wrap the entire body in try/except — unhandled exceptions in async FastAPI kill the request silently.",
        "Use Pydantic ValidationError handling when parsing request bodies.",
        "Add background_tasks argument only if the endpoint already uses it; do not introduce new DI parameters.",
        "If retrying, use tenacity or a manual retry loop — never time.sleep() in an async handler.",
        "CRITICAL: 'import logging' alone is not enough — also add 'logger = logging.getLogger(__name__)' to imports_needed.",
    ],
    route_patterns=[
        r'@(?:app|router)\.(get|post|put|patch|delete|websocket)\s*\(\s*["\']',
    ],
    precheck_fn=_fastapi_precheck,
    validation_commands=[
        ("Python syntax", ["python", "-c", "import ast, sys; ast.parse(open(sys.argv[1]).read())"]),
    ],
    build_command=["python", "-m", "py_compile"],
))

_reg(FrameworkAdapter(
    name="flask",
    language="python",
    display_name="Flask",
    py_deps=["flask"],
    source_patterns=[
        r"from flask import",
        r"@app\.route\(",
        r"@bp\.route\(",
        r"Blueprint\(",
    ],
    generation_rules=[
        "Use abort(status_code) to return HTTP errors — not bare raise.",
        "Return jsonify({...}), status_code tuples, never plain dicts.",
        "Register app-level error handlers with @app.errorhandler(Exception) for uncaught exceptions.",
        "For SQLAlchemy errors, rollback db.session and call abort(500) with a safe message.",
        "Blueprints: register error handlers on the blueprint, not just the app.",
        "CRITICAL: import abort, jsonify, make_response from flask explicitly.",
        "CRITICAL: 'import logging' alone is not enough — also add 'logger = logging.getLogger(__name__)' to imports_needed.",
    ],
    route_patterns=[
        r'@(?:app|bp|blueprint)\.(route|get|post|put|patch|delete)\s*\(\s*["\']',
    ],
    precheck_fn=_flask_precheck,
    validation_commands=[
        ("Python syntax", ["python", "-c", "import ast, sys; ast.parse(open(sys.argv[1]).read())"]),
    ],
    build_command=["python", "-m", "py_compile"],
))

_reg(FrameworkAdapter(
    name="nextjs",
    language="typescript",
    display_name="Next.js",
    npm_deps=["next"],
    marker_files=["next.config.ts", "next.config.js", "next.config.mjs"],
    source_patterns=[
        r"from ['\"]next/server['\"]",
        r"export async function (GET|POST|PUT|PATCH|DELETE)",
        r"NextRequest|NextResponse",
        r"NextApiRequest|NextApiResponse",
        r"getServerSideProps|getStaticProps",
        r"from ['\"]@supabase/supabase-js['\"]",
        r"from ['\"]@supabase/ssr['\"]",
        r"from ['\"]@supabase/auth-helpers-nextjs['\"]",
    ],
    generation_rules=[
        "For App Router (app/api/.../route.ts): handlers MUST be named exports: export async function GET(request: NextRequest) { ... } and return NextResponse.json({...}, { status: N }).",
        "For Pages Router API (pages/api/...): handlers MUST be default export: export default async function handler(req: NextApiRequest, res: NextApiResponse) { ... } and return res.status(N).json({ error: '...' }).",
        "For Pages Router pages (pages/dashboard.tsx): wrap data fetching in getServerSideProps with try/catch, returning { props: { error: '...' } } or { notFound: true } on failure.",
        "For Supabase: ALWAYS check 'if (error)' after 'const { data, error } = await supabase...'. Never leak raw Supabase/Postgres error messages or internal schema details to the client.",
        "For Supabase: Handle 404 when single record is expected but data is null, and handle 400 for constraint errors.",
        "Always wrap async route bodies in try/catch to prevent unhandled promise rejections.",
        "Guard process.env access: const val = process.env.NEXT_PUBLIC_... || process.env.SUPABASE_...; if (!val) ...",
        "CRITICAL for App Router: import { NextResponse } from 'next/server', not from 'next'.",
    ],
    route_patterns=[
        r"export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*\(",
        r"export\s+function\s+(GET|POST|PUT|PATCH|DELETE)\s*\(",
        r"export\s+default\s+(?:async\s+)?function\b",
        r"export\s+(?:async\s+)?function\s+(?:getServerSideProps|getStaticProps)\b",
        r"export\s+default\s+(?:async\s+)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>",
    ],
    path_variants_fn=_nextjs_path_variants,
    precheck_fn=_nextjs_precheck,
    validation_commands=[
        ("TypeScript", ["npx", "tsc", "--noEmit"]),
    ],
    build_command=["run", "build"],
))

_reg(FrameworkAdapter(
    name="express",
    language="typescript",
    display_name="Express",
    npm_deps=["express"],
    source_patterns=[
        r"from ['\"]express['\"]",
        r"require\(['\"]express['\"]\)",
        r"Router\(\)|express\.Router\(\)",
        r"app\.(get|post|put|patch|delete)\s*\(",
        r"router\.(get|post|put|patch|delete)\s*\(",
    ],
    generation_rules=[
        "Async handlers MUST have try/catch — Express 4 does not catch rejected promises automatically.",
        "Always call next(err) in catch blocks — this routes to the error middleware.",
        "Never call next(err) AND send a response in the same handler — pick one path.",
        "Define centralized error middleware: app.use((err, req, res, next) => { ... }) with 4 parameters.",
        "Detect existing error middleware before adding new middleware — do not create duplicates.",
        "Use res.status(N).json({error: safeMessage}) — never send raw Error objects to the client.",
        "For async route files, consider wrapping handlers with an asyncHandler utility to reduce boilerplate.",
        "CRITICAL: import Router from 'express' explicitly if using Router().",
    ],
    route_patterns=[
        r'(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*["\']',
        r'(?:app|router)\.use\s*\(\s*["\']',
    ],
    path_variants_fn=_express_path_variants,
    precheck_fn=_express_precheck,
    validation_commands=[
        ("TypeScript", ["npx", "tsc", "--noEmit"]),
    ],
    build_command=["run", "build"],
))

_reg(FrameworkAdapter(
    name="nestjs",
    language="typescript",
    display_name="NestJS",
    npm_deps=["@nestjs/core", "@nestjs/common"],
    source_patterns=[
        r"from ['\"]@nestjs/common['\"]",
        r"@Controller\(",
        r"@Get\(|@Post\(|@Put\(|@Patch\(|@Delete\(",
        r"@Injectable\(",
    ],
    generation_rules=[
        "Throw HttpException (or its subclasses) — never throw plain Error objects.",
        "Use HttpStatus enum: throw new HttpException('msg', HttpStatus.BAD_GATEWAY).",
        "For global error handling, implement ExceptionFilter and decorate with @UseFilters().",
        "Service methods should throw domain exceptions; controllers should let them propagate to the filter.",
        "Validate DTOs with class-validator and class-transformer — add @UsePipes(ValidationPipe) if not already global.",
        "For async operations, use async/await and let NestJS exception filters handle uncaught errors.",
        "Interceptors (RxJS catchError) are valid for cross-cutting concerns — don't duplicate error logic.",
        "CRITICAL: import all decorators from '@nestjs/common', not '@nestjs/core'.",
    ],
    route_patterns=[
        r'@(Get|Post|Put|Patch|Delete|All)\s*\(\s*["\']',
        r'@(Get|Post|Put|Patch|Delete|All)\s*\(\s*\)',
    ],
    precheck_fn=_nestjs_precheck,
    validation_commands=[
        ("TypeScript", ["npx", "tsc", "--noEmit"]),
    ],
    build_command=["run", "build"],
))

_reg(FrameworkAdapter(
    name="hono",
    language="typescript",
    display_name="Hono",
    npm_deps=["hono"],
    source_patterns=[
        r"from ['\"]hono['\"]",
        r"new Hono\(\)",
        r"c\.json\(|c\.text\(|c\.req",
        r"app\.(get|post|put|patch|delete)\s*\(",
    ],
    generation_rules=[
        "Always return c.json({...}, status) — Hono requires an explicit return value from every handler.",
        "Use HTTPException from 'hono/http-exception' for structured error responses.",
        "Register app.onError((err, c) => c.json({error: err.message}, 500)) for global error handling.",
        "For Edge runtimes (Cloudflare Workers, Vercel Edge): no Node.js built-ins (fs, path, crypto) — use Web APIs.",
        "Use c.req.json() inside try/catch — it throws on malformed request bodies.",
        "Hono middleware: use app.use('*', ...) for global middleware before route definitions.",
        "For environment variables on Edge, use c.env.MY_VAR (Cloudflare) or process.env.MY_VAR (Node) — guard both.",
        "CRITICAL: import HTTPException from 'hono/http-exception', NOT from 'hono'.",
    ],
    route_patterns=[
        r'(?:app|router)\.(get|post|put|patch|delete|all|use)\s*\(\s*["\']',
    ],
    path_variants_fn=_hono_path_variants,
    precheck_fn=_hono_precheck,
    validation_commands=[
        ("TypeScript", ["npx", "tsc", "--noEmit"]),
    ],
    build_command=["run", "build"],
))

_reg(FrameworkAdapter(
    name="django",
    language="python",
    display_name="Django / DRF",
    py_deps=["django", "djangorestframework"],
    marker_files=["manage.py", "wsgi.py", "asgi.py"],
    source_patterns=[
        r"from django",
        r"import django",
        r"from rest_framework",
        r"urlpatterns\s*=",
        r"@api_view\(",
    ],
    generation_rules=[
        "Wrap view logic in try/except blocks to catch runtime and database errors.",
        "For Django REST Framework (DRF): import status from 'rest_framework' and Response from 'rest_framework.response'. Return Response({'error': 'safe message'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR).",
        "For standard Django views: return JsonResponse({'error': 'safe message'}, status=500) from 'django.http'.",
        "Catch specific exceptions: DatabaseError, ObjectDoesNotExist, ValidationError before generic Exception.",
        "Never return raw exception strings or database tracebacks in the response payload.",
        "CRITICAL: Add all needed imports to imports_needed, e.g. 'from django.http import JsonResponse' or 'from rest_framework import status'.",
    ],
    route_patterns=[
        r'(?:path|re_path|url)\s*\(\s*["\']',
        r'@api_view\s*\(',
    ],
    path_variants_fn=_django_path_variants,
    precheck_fn=_django_precheck,
    validation_commands=[
        ("Python syntax", ["python", "-c", "import ast, sys; ast.parse(open(sys.argv[1]).read())"]),
    ],
    build_command=["python", "-m", "py_compile"],
))

_reg(FrameworkAdapter(
    name="springboot",
    language="java",
    display_name="Spring Boot",
    marker_files=["pom.xml", "build.gradle", "build.gradle.kts", "mvnw", "gradlew"],
    source_patterns=[
        r"@SpringBootApplication",
        r"@RestController",
        r"@Controller",
        r"org\.springframework",
    ],
    generation_rules=[
        "Use ResponseEntity<T> to return structured JSON responses with appropriate HttpStatus.",
        "Wrap database and service calls in try/catch blocks catching specific exceptions (DataAccessException, ResourceNotFoundException).",
        "Use @ExceptionHandler or ControllerAdvice when global/centralized exception handling is preferred.",
        "Never expose stack traces or internal entity models in error responses; return an ErrorResponse DTO or Map<String, Object>.",
        "Preserve Java types, annotations, and package imports.",
    ],
    route_patterns=[
        r'@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*\(\s*(?:(?:value|path)\s*=\s*)?["\']',
    ],
    path_variants_fn=_springboot_path_variants,
    precheck_fn=_springboot_precheck,
    validation_commands=[],
    build_command=None,
))


# ── Public API ────────────────────────────────────────────────────────────────

def get_adapter(framework: str) -> FrameworkAdapter | None:
    """Return the adapter for a framework slug, or None if unknown."""
    return ADAPTERS.get(framework)


def all_adapters() -> list[FrameworkAdapter]:
    """Return all registered framework adapters."""
    return list(ADAPTERS.values())


def detect_framework(repo_path: str) -> FrameworkAdapter | None:
    """
    Inspect a cloned repository and return the best-matching adapter.

    Priority:
      1. Java / Spring Boot build files (pom.xml, build.gradle)
      2. Node: package.json dep match
      3. Python requirements/pyproject dep match
      4. Marker file presence
      5. Source pattern scan (first 150 source files)
      6. None — caller falls back to generic rules
    """
    import json
    import os
    from pathlib import Path

    root = Path(repo_path)

    # ── 1. Java / Spring Boot ─────────────────────────────────────────────────
    if (root / "pom.xml").exists() or (root / "build.gradle").exists() or (root / "build.gradle.kts").exists():
        return ADAPTERS.get("springboot")

    # ── 2. Node: package.json ─────────────────────────────────────────────────
    pkg = root / "package.json"
    if pkg.exists():
        try:
            data = json.loads(pkg.read_text(encoding="utf-8"))
            deps = {
                **data.get("dependencies", {}),
                **data.get("devDependencies", {}),
            }
            # Order matters: more specific first
            for slug in ("nestjs", "hono", "nextjs", "express"):
                adapter = ADAPTERS.get(slug)
                if adapter and any(d in deps for d in adapter.npm_deps):
                    return adapter
        except Exception:
            pass

    # ── 3. Python requirements ────────────────────────────────────────────────
    for req_file in ("requirements.txt", "pyproject.toml", "Pipfile"):
        req_path = root / req_file
        if req_path.exists():
            try:
                content = req_path.read_text(encoding="utf-8").lower()
                for slug in ("fastapi", "django", "flask"):
                    adapter = ADAPTERS.get(slug)
                    if adapter and any(dep in content for dep in adapter.py_deps):
                        return adapter
            except Exception:
                pass

    # ── 4. Marker files ───────────────────────────────────────────────────────
    for adapter in ADAPTERS.values():
        for marker in adapter.marker_files:
            if (root / marker).exists():
                return adapter

    # ── 5. Source pattern scan ────────────────────────────────────────────────
    _SKIP = {".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", "target", ".gradle"}
    _EXTS = {".py", ".ts", ".tsx", ".js", ".mjs", ".java"}
    scanned = 0

    for f in root.rglob("*"):
        if scanned >= 150:
            break
        if not f.is_file() or f.suffix not in _EXTS:
            continue
        if any(skip in f.parts for skip in _SKIP):
            continue
        try:
            sample = f.read_text(encoding="utf-8", errors="ignore")[:4000]
        except Exception:
            continue
        scanned += 1
        for adapter in ADAPTERS.values():
            for pat in adapter.source_patterns:
                if re.search(pat, sample):
                    return adapter

    return None


def all_path_variants(path: str, adapter: FrameworkAdapter | None) -> list[str]:
    """
    Return all path string variants to search for when locating an endpoint.
    Always includes the raw path plus any framework-specific transforms.
    """
    variants = [path]
    # trailing-slash variant
    if path.endswith("/"):
        variants.append(path[:-1])
    else:
        variants.append(path + "/")
    # framework-specific variants
    if adapter and adapter.path_variants_fn:
        for v in adapter.path_variants_fn(path):
            if v not in variants:
                variants.append(v)
    # Express-style :param conversion (always useful as a fallback for any Node framework)
    colon = re.sub(r"\{([^}]+)\}", r":\1", path)
    if colon not in variants:
        variants.append(colon)
    return variants
