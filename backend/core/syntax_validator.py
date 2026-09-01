"""Syntax validation utilities for multi-language source files.

Provides fast, isolated syntax checking across supported languages (Python,
TypeScript/JavaScript, Go, Ruby). Specifically handles TypeScript/TSX syntax
validation in environments where node_modules or third-party type definitions
are not present (e.g. freshly cloned ephemeral repos).
"""

from __future__ import annotations

import ast
import os
import re
import subprocess
import tempfile
from pathlib import Path
from loguru import logger


def filter_typescript_syntax_errors(output: str) -> tuple[bool, str]:
    """
    Parse tsc output and distinguish genuine syntactic/parsing errors from
    semantic/typechecking/module-resolution errors (e.g. missing node_modules).

    In TypeScript's compiler architecture:
    - TS1000..TS1999: Syntactic errors (parsing, lexing, missing brackets, unclosed literals)
    - TS17000..TS17999: JSX syntactic errors (unclosed JSX tags, malformed JSX)
    - TS2000+: Semantic diagnostics (type errors, missing modules TS2307, missing JSX
      runtime definitions TS2875/TS7026, implicit any TS7006, missing namespace TS2503, etc.)
    """
    if not output or not output.strip():
        return True, ""

    syntax_errors: list[str] = []

    # Pattern matching TypeScript diagnostic messages:
    # e.g., "src/file.tsx(10,5): error TS1005: ';' expected."
    # e.g., "error TS1005: ';' expected."
    ts_error_pattern = re.compile(r"(?:^|[\r\n])(.*?(?:error|warning)\s+TS(\d+):\s*(.*))", re.IGNORECASE)
    matches = list(ts_error_pattern.finditer(output))

    if matches:
        for match in matches:
            full_line = match.group(1).strip()
            code_str = match.group(2)
            try:
                code_num = int(code_str)
            except ValueError:
                continue

            # Check if this is a syntactic / parsing diagnostic
            is_syntax_code = (1000 <= code_num <= 1999) or (17000 <= code_num <= 17999)
            if is_syntax_code:
                syntax_errors.append(full_line)
    else:
        # If output does not match TSxxxx pattern, check for generic syntax error strings
        lines = [line.strip() for line in output.splitlines() if line.strip()]
        for line in lines:
            lower = line.lower()
            if "syntaxerror" in lower or "unexpected token" in lower or "parsing error" in lower:
                syntax_errors.append(line)
        # If no standard TS error pattern was found but the command failed with other errors,
        # check if it's an unrecognized error that is not a known type/module error
        if not syntax_errors and lines:
            if not any("cannot find module" in l.lower() or "ts2" in l.lower() or "ts7" in l.lower() for l in lines):
                syntax_errors.extend(lines)

    if syntax_errors:
        return False, "\n".join(syntax_errors)
    return True, ""


def run_syntax_command(command: list[str], label: str) -> tuple[bool, str]:
    """Execute an external syntax validation command safely."""
    try:
        proc = subprocess.run(command, capture_output=True, text=True, timeout=20)
    except FileNotFoundError:
        logger.warning(f"[{label}] syntax tool not available. Skipping strict syntax validation.")
        return True, ""
    except Exception as exc:
        return False, f"{label} syntax tool failed: {exc}"

    if proc.returncode == 0:
        return True, ""

    stderr = (proc.stderr or "").strip()
    stdout = (proc.stdout or "").strip()
    details = stderr or stdout or f"{label} syntax check failed with exit code {proc.returncode}."
    return False, details

def _lightweight_bracket_check(path: Path) -> tuple[bool, str]:
    """Fast structural validation for TS/TSX files.

    Checks bracket / brace / parenthesis balance while skipping characters
    inside string literals, template literals, and comments.  This catches
    the most common LLM-generated corruption (missing ``}``, extra ``{``,
    unmatched ``(``) without requiring node_modules or tsconfig context.
    """
    try:
        content = path.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        return False, f"File encoding error: {exc}"

    if not content.strip():
        return True, ""

    stack: list[str] = []
    openers = {"{": "}", "(": ")", "[": "]"}
    closers = {"}", ")", "]"}
    i = 0
    length = len(content)

    while i < length:
        c = content[i]

        # ── Skip single-line comments ──
        if c == "/" and i + 1 < length and content[i + 1] == "/":
            i = content.find("\n", i)
            if i == -1:
                break
            i += 1
            continue

        # ── Skip block comments ──
        if c == "/" and i + 1 < length and content[i + 1] == "*":
            end = content.find("*/", i + 2)
            i = end + 2 if end != -1 else length
            continue

        # ── Skip template literals ──
        if c == "`":
            i += 1
            depth = 0
            while i < length:
                tc = content[i]
                if tc == "\\" and i + 1 < length:
                    i += 2
                    continue
                if tc == "$" and i + 1 < length and content[i + 1] == "{":
                    depth += 1
                    i += 2
                    continue
                if tc == "}" and depth > 0:
                    depth -= 1
                    i += 1
                    continue
                if tc == "`" and depth == 0:
                    i += 1
                    break
                i += 1
            continue

        # ── Skip string literals ──
        if c in ('"', "'"):
            quote = c
            i += 1
            while i < length:
                sc = content[i]
                if sc == "\\" and i + 1 < length:
                    i += 2
                    continue
                if sc == quote:
                    i += 1
                    break
                if sc == "\n":
                    # Unterminated string on this line — stop scanning it
                    i += 1
                    break
                i += 1
            continue

        # ── Track brackets ──
        if c in openers:
            stack.append(openers[c])
            i += 1
            continue

        if c in closers:
            if not stack:
                # Find line number for error
                line_no = content[:i].count("\n") + 1
                return False, f"Unexpected closing '{c}' at line {line_no} with no matching opener."
            expected = stack.pop()
            if c != expected:
                line_no = content[:i].count("\n") + 1
                return False, f"Mismatched bracket at line {line_no}: expected '{expected}' but got '{c}'."
            i += 1
            continue

        i += 1

    if stack:
        remaining = "".join(stack)
        return False, f"Unclosed brackets at end of file — expected: {remaining}"

    return True, ""


def validate_file_syntax(file_path: Path | str) -> tuple[bool, str]:
    """Validate syntax of an existing file on disk for supported languages."""
    path = Path(file_path)
    if not path.exists():
        return False, f"File not found for syntax check: {file_path}"

    ext = path.suffix.lower()

    if ext == ".py":
        try:
            content = path.read_text(encoding="utf-8")
            ast.parse(content)
            return True, ""
        except SyntaxError as exc:
            return False, f"{exc.msg} at line {exc.lineno}, col {exc.offset}"
        except UnicodeDecodeError as exc:
            return False, f"File encoding error: {exc}"

    if ext in {".js", ".mjs", ".cjs"}:
        return run_syntax_command(["node", "--check", str(path)], "Node.js")

    if ext in {".ts", ".tsx"}:
        # ── Lightweight bracket-balance check ──────────────────────────────
        # Running `tsc --noEmit --noResolve` on an isolated file WITHOUT
        # node_modules, tsconfig.json, or type definitions consistently
        # rejects valid JSX/TSX code (generics like Record<string, never>
        # are misinterpreted as unclosed JSX tags).
        #
        # Instead we run a fast structural sanity check here and rely on
        # the downstream github_agent build gate (`npm run build` with full
        # project context) for authoritative compilation validation.
        return _lightweight_bracket_check(path)

    if ext == ".go":
        return run_syntax_command(["gofmt", "-e", str(path)], "gofmt")

    if ext == ".rb":
        return run_syntax_command(["ruby", "-c", str(path)], "ruby")

    # Unknown extension: do not block, rely on review checks.
    return True, ""


def validate_content_syntax(file_path: str, content: str) -> tuple[bool, str]:
    """Best-effort syntax check for proposed content string before writing or accepting."""
    ext = Path(file_path).suffix.lower()

    if ext == ".py":
        try:
            ast.parse(content)
            return True, ""
        except SyntaxError as exc:
            return False, f"{exc.msg} at line {exc.lineno}, col {exc.offset}"

    with tempfile.NamedTemporaryFile("w", suffix=ext or ".txt", encoding="utf-8", delete=False) as tmp:
        tmp.write(content)
        temp_path = tmp.name
    try:
        return validate_file_syntax(temp_path)
    finally:
        try:
            os.remove(temp_path)
        except Exception:
            pass


def validate_project_build(repo_path: Path | str, target_file: str | None = None) -> tuple[bool, str]:
    """
    Execute pre-merge build and compiler verification across project types.
    - For npm / Next.js / TypeScript projects: verifies TypeScript compiler / Node syntax.
    - For Python projects: verifies byte-compilation without syntax errors.
    """
    path = Path(repo_path)
    if not path.exists():
        return True, ""

    pkg_json = path / "package.json"
    if pkg_json.exists():
        # Node / npm / TypeScript project verification
        tsconfig = path / "tsconfig.json"
        if tsconfig.exists() or (target_file and Path(target_file).suffix.lower() in {".ts", ".tsx"}):
            # Use lightweight bracket check for TS/TSX — real build validation
            # happens downstream via `npm run build` in github_agent.
            if target_file:
                full_target = path / target_file
                if full_target.exists():
                    ok, msg = _lightweight_bracket_check(full_target)
                    if not ok:
                        return False, f"TypeScript structural check failed: {msg}"

        # If target file is JS/MJS/CJS, verify with node --check
        if target_file and Path(target_file).suffix.lower() in {".js", ".mjs", ".cjs"}:
            full_target = path / target_file
            if full_target.exists():
                ok, msg = run_syntax_command(["node", "--check", str(full_target)], "Node.js")
                if not ok:
                    return False, f"JavaScript build verification failed: {msg}"

    # Python project verification
    if target_file and Path(target_file).suffix.lower() == ".py":
        full_target = path / target_file
        if full_target.exists():
            try:
                import py_compile
                py_compile.compile(str(full_target), doraise=True)
            except Exception as exc:
                return False, f"Python compile verification failed: {exc}"

    return True, ""
