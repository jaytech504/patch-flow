"""Deterministic, framework-neutral checks for generated code patches.

These checks intentionally run in report-only mode first. They make patch
quality observable without changing the current PR workflow, and become the
shared contract that later validation gates can enforce.
"""

from __future__ import annotations

import re
from pathlib import PurePosixPath
from typing import Literal, Mapping

from pydantic import BaseModel, Field


class PatchValidationCheck(BaseModel):
    code: str
    severity: Literal["warning", "error"]
    message: str


class PatchValidationReport(BaseModel):
    status: Literal["passed", "warnings", "failed"]
    checks: list[PatchValidationCheck] = Field(default_factory=list)


class PatchValidator:
    """Validate the shape and basic safety of a generated patch."""

    _INSTRUCTION_MARKERS = (
        "```",
        "<thought>",
        "<|channel|>",
        "# at line ",
        "# add to existing import",
        "# insert at ",
        "# place at ",
    )
    _SECRET_PATTERNS = (
        r"\bgh[pousr]_[A-Za-z0-9_]{20,}\b",
        r"\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b",
        r"\bAKIA[0-9A-Z]{16}\b",
        r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----",
    )

    @classmethod
    def validate(cls, patch: Mapping[str, object]) -> PatchValidationReport:
        checks: list[PatchValidationCheck] = []
        file_path = str(patch.get("file_path") or "").replace("\\", "/")
        code_before = patch.get("code_before") or patch.get("original_code") or ""
        code_after = patch.get("code_after") or patch.get("fixed_code") or ""
        imports_needed = patch.get("imports_needed") or []

        if not file_path:
            checks.append(cls._check("missing_file_path", "error", "Patch has no target file path."))
        elif cls._is_unsafe_path(file_path):
            checks.append(cls._check("unsafe_file_path", "error", "Patch target must be a relative repository path."))

        if not isinstance(code_before, str) or not code_before.strip():
            checks.append(cls._check("missing_code_before", "error", "Patch has no original code block."))
        if not isinstance(code_after, str) or not code_after.strip():
            checks.append(cls._check("missing_code_after", "error", "Patch has no replacement code block."))

        if isinstance(code_before, str) and isinstance(code_after, str):
            if code_before.strip() and code_before == code_after:
                checks.append(cls._check("no_effect", "warning", "Replacement code is identical to the original block."))
            lower_code = code_after.lower()
            if any(marker in lower_code for marker in cls._INSTRUCTION_MARKERS):
                checks.append(cls._check("instruction_leakage", "warning", "Replacement code appears to include model instructions or formatting."))
            if any(re.search(pattern, code_after) for pattern in cls._SECRET_PATTERNS):
                checks.append(cls._check("possible_secret", "warning", "Replacement code may contain a credential; inspect before creating a PR."))

        if not isinstance(imports_needed, list):
            checks.append(cls._check("invalid_imports", "warning", "imports_needed should be a list of import statements."))
        else:
            for import_line in imports_needed:
                if not isinstance(import_line, str) or not cls._looks_like_import(import_line):
                    checks.append(cls._check("invalid_import", "warning", f"Not a recognised import statement: {import_line!r}"))

        status: Literal["passed", "warnings", "failed"]
        if any(check.severity == "error" for check in checks):
            status = "failed"
        elif checks:
            status = "warnings"
        else:
            status = "passed"
        return PatchValidationReport(status=status, checks=checks)

    @staticmethod
    def _check(code: str, severity: Literal["warning", "error"], message: str) -> PatchValidationCheck:
        return PatchValidationCheck(code=code, severity=severity, message=message)

    @staticmethod
    def _is_unsafe_path(file_path: str) -> bool:
        path = PurePosixPath(file_path)
        return path.is_absolute() or ".." in path.parts or bool(re.match(r"^[A-Za-z]:/", file_path))

    @staticmethod
    def _looks_like_import(import_line: str) -> bool:
        line = import_line.strip()
        return bool(re.match(
            r"^(?:from\s+\S+\s+import\s+.+|import\s+.+|"
            r"(?:const|let|var)\s+.+?=\s*require\(.+\)|"
            r"import\s+.+?from\s+.+|using\s+.+;)$",
            line,
        ))
