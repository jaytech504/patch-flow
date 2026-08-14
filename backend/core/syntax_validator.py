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
        ok, msg = run_syntax_command([
            "npx", "--yes", "tsc", "--noEmit",
            "--skipLibCheck",
            "--noResolve",
            "--jsx", "react-jsx",
            "--target", "esnext",
            "--allowJs",
            "--allowSyntheticDefaultImports",
            str(path)
        ], "TypeScript")
        if ok:
            return True, ""
        return filter_typescript_syntax_errors(msg)

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
