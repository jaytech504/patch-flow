import ast
import os
import re
import shutil
import subprocess
import tempfile
from pathlib import Path
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.base import BaseAgent, Tool
from backend.core.config import get_settings

settings = get_settings()


class ReviewAgent(BaseAgent):
    """
    Senior-developer code reviewer that validates generated fixes
    before they are committed to a PR.

    Reviews each fix in the context of the ENTIRE file where it will be applied,
    checking for correctness, completeness, and production-readiness.

    Returns either "validated" (fix is good) or "revision_needed" with
    specific feedback to send back to the FixAgent.
    """

    name = "review"
    system_prompt = """You are a SENIOR SOFTWARE ENGINEER performing a rigorous code review.

You are reviewing auto-generated error-handling fixes before they are committed to a production codebase. The codebase could be in any language or framework.

Your job is to review EACH proposed fix in the context of the FULL source file and determine whether it is correct, complete, and production-ready.

## Review Checklist — check EVERY item:

1. **SYMBOL RESOLUTION** — Go through every identifier in code_after (function calls, variable references, method calls, class instantiations). For each one, verify it exists by checking:
   - Is it defined or assigned somewhere in the FULL FILE?
   - Is it a language builtin or standard library symbol?
   - Is it imported at the top of the file?
   - Is it listed in imports_needed?
   - Does using an import require additional setup (e.g. importing a module is not the same as creating an instance — `import logging` does not give you a `logger` variable)?
   If ANY symbol is referenced but cannot be resolved → verdict MUST be "revision_needed".

2. **COMPLETENESS** — The fix must be fully self-contained. If code_after references helper functions, caching mechanisms, utility methods, or configuration variables, those MUST already exist in the file. If they don't, the fix is incomplete.

3. **SYNTAX & STRUCTURE** — The fix must be syntactically valid in the file's language. Indentation, brackets, and nesting must match the surrounding code.

4. **LOGICAL CORRECTNESS** — Trace through the control flow. Check for:
   - Dead code or unreachable branches
   - Variables assigned inside conditional blocks but used outside them
   - Return values that never get used
   - Early returns that skip necessary cleanup
   - Truthiness checks that fail on legitimate zero/empty values

5. **DROP-IN COMPATIBILITY** — The fix must have the same function signature, decorators, and indentation level as the original code. It must not break callers.

6. **INFORMATION SAFETY** — Error responses must never expose internal details (stack traces, connection strings, internal paths, raw exception messages).

7. **CONSISTENCY** — The fix should follow the conventions, patterns, and style already present in the file. If the file uses a particular error handling pattern, logging library, or naming convention, the fix should match.

8. **EDGE CASES** — Consider boundary conditions: null/None/undefined values, zero, empty collections, missing dictionary keys, type mismatches, concurrent access.

For EACH fix, respond with ONE of:
- "validated" — The fix passes all checks and is ready to commit.
- "revision_needed" — The fix has issues. List every issue found and provide specific instructions for how to correct them.

Return JSON:
{
  "verdict": "validated" | "revision_needed",
  "issues": ["specific issue descriptions"],
  "revision_instructions": "Detailed, actionable instructions for correction. Only present if revision_needed."
}"""

    def __init__(
        self,
        db: AsyncSession,
        session_id: str,
        repo_url: str = None,
        github_token: str = None,
    ):
        super().__init__(db, session_id)
        # Review quality remains guarded by deterministic prechecks; reduce LLM budget.
        self.max_iterations = 6
        self.max_tokens_per_call = 900
        self.repo_url = repo_url
        self.repo_slug = self._parse_repo_slug(repo_url) if repo_url else None
        self._github_token = github_token or settings.github_token
        self._temp_dir = None
        self._repo_path = None

    async def handle(self, fix_result: dict) -> dict:
        """
        Review all fixes. Returns the fix_result dict with fixes updated:
        - Validated fixes pass through unchanged
        - Fixes needing revision are tagged with review feedback

        Returns:
            dict with same structure as fix_result, plus:
            - Each fix gets "review_status": "validated" | "revision_needed"
            - Fixes needing revision get "review_feedback": str
        """
        fixes = fix_result.get("fixes", [])
        if not fixes:
            logger.info("[Review] No fixes to review")
            return fix_result

        # Clone repo to read full file context
        cloned = False
        if self.repo_url and self._github_token:
            try:
                self._clone_repo()
                cloned = True
            except Exception as e:
                logger.error(f"[Review] Failed to clone repo: {e}")

        reviewed_fixes = []
        needs_revision = []

        for i, fix in enumerate(fixes):
            file_path = fix.get("file_path")
            code_before = fix.get("code_before", "")
            code_after = fix.get("code_after", "")
            imports_needed = fix.get("imports_needed", [])
            endpoints = fix.get("affected_endpoints", [])

            endpoint_label = ", ".join(endpoints) if endpoints else "unknown"
            await self._log(
                "thought",
                f"Reviewing fix {i+1}/{len(fixes)}: {fix.get('finding_title', 'unnamed')} "
                f"({endpoint_label})"
            )

            # Read the full file for context
            file_content = ""
            if cloned and file_path:
                file_content = self._read_file(file_path, with_line_numbers=False)

            if not file_content:
                # Without full-file context, this review must fail closed.
                logger.warning(f"[Review] Cannot read {file_path} — revision required")
                fix["review_status"] = "revision_needed"
                fix["review_feedback"] = (
                    "Review requires full-file context. Could not read target file; "
                    "regenerate fix with valid file_path and coherent replacement block."
                )
                fix["review_issues"] = ["Missing full-file context for review."]
                needs_revision.append(fix)
                continue

            precheck = self._precheck_fix(
                file_path=file_path,
                file_content=file_content,
                code_before=code_before,
                code_after=code_after,
                imports_needed=imports_needed,
                start_line=fix.get("start_line"),
                end_line=fix.get("end_line"),
            )
            if precheck:
                logger.info(
                    f"[Review] Fix for {endpoint_label} failed deterministic checks: "
                    f"{'; '.join(precheck)}"
                )
                fix["review_status"] = "revision_needed"
                fix["review_feedback"] = (
                    "Fix deterministic structural/syntax issues before resubmitting: "
                    + "; ".join(precheck)
                )
                fix["review_issues"] = precheck
                needs_revision.append(fix)
                continue

            llm_file_context = self._build_compact_review_context(
                file_content=file_content,
                code_before=code_before,
                code_after=code_after,
                start_line=fix.get("start_line"),
                end_line=fix.get("end_line"),
            )

            # Ask the LLM to review the fix in context of the full file
            review_result = await self.run(
                task=f"""Review this proposed code fix. You are looking at the COMPLETE file where the fix will be applied.

## Fix Details
- **Finding:** {fix.get('finding_title', 'Unknown')}
- **Severity:** {fix.get('severity', 'UNKNOWN')}
- **Endpoint(s):** {endpoint_label}
- **File:** {file_path}
- **Lines:** {fix.get('start_line', '?')}-{fix.get('end_line', '?')}

## Proposed imports to add
{imports_needed if imports_needed else "(none)"}

## Original Code (to be replaced)
```
{code_before}
```

## Proposed Fix (replacement)
```
{code_after}
```

## FULL FILE CONTENT (for context)
```
{llm_file_context}
```

Review the proposed fix against the FULL FILE above. Perform your review checklist systematically:

1. **Symbol Resolution**: Go through code_after line by line. For every identifier (function call, variable, method, class), search the full file for where it is defined, imported, or assigned. If any symbol cannot be resolved, the fix is incomplete — reject it and list every unresolved symbol. Remember that importing a module is not the same as creating an instance or variable from it.

2. **Completeness**: Does the fix reference any functions, classes, or variables that don't exist in the file? If so, the fix is incomplete.

3. **Logic Trace**: Trace through each code path. Are there branches that can never execute? Variables that could be undefined when referenced? Truthiness checks that fail on valid edge-case values like zero or empty string?

4. **Exception-Structure Checks (explicit)**:
   - Reject duplicate except handlers that catch the same exception type in the same try block.
   - Reject orphaned or malformed exception handling structure (code outside intended try/except scope).
   - Reject unreachable statements after return/raise in the same block.
   - For Python fixes, mentally run ast.parse() on the proposed merged file and reject if it would fail.

5. **Drop-in Fit**: Does the replacement have the same function signature, decorators, and indentation as the original?

6. **Information Safety**: Do any error responses leak internal details?

7. **Style Consistency**: Does the fix follow the conventions already used in this file?

Return your verdict as JSON:
{{
  "verdict": "validated" | "revision_needed",
  "issues": ["list of specific issues found, or empty if validated"],
  "revision_instructions": "Detailed instructions for what to change. Only if revision_needed."
}}""",
                context={
                    "file_path": file_path,
                    "finding_title": fix.get("finding_title"),
                }
            )

            verdict = review_result.get("verdict", "validated").lower()
            issues = review_result.get("issues", [])

            if verdict == "revision_needed" and issues:
                logger.info(
                    f"[Review] Fix for {endpoint_label} NEEDS REVISION: "
                    f"{'; '.join(issues)}"
                )
                await self._log(
                    "result",
                    f"❌ Revision needed for {endpoint_label}: {'; '.join(issues)}"
                )
                fix["review_status"] = "revision_needed"
                fix["review_feedback"] = review_result.get(
                    "revision_instructions",
                    "; ".join(issues)
                )
                fix["review_issues"] = issues
                needs_revision.append(fix)
            else:
                logger.info(f"[Review] Fix for {endpoint_label} VALIDATED ✓")
                await self._log("result", f"✅ Validated fix for {endpoint_label}")
                fix["review_status"] = "validated"
                reviewed_fixes.append(fix)

        # Cleanup clone
        self._cleanup()

        # Return updated fix_result
        fix_result["fixes"] = reviewed_fixes
        fix_result["needs_revision"] = needs_revision
        fix_result["review_stats"] = {
            "total": len(fixes),
            "validated": len(reviewed_fixes),
            "revision_needed": len(needs_revision),
        }

        logger.info(
            f"[Review] Done: {len(reviewed_fixes)} validated, "
            f"{len(needs_revision)} need revision"
        )

        return fix_result

    # ── File reading helpers ──────────────────────────────────────────────────

    def _read_file(self, relative_path: str, with_line_numbers: bool = True) -> str:
        """Read a file from the cloned repo. Returns content or empty string."""
        try:
            full_path = Path(self._repo_path) / relative_path
            if not full_path.exists():
                logger.warning(f"[Review] File not found: {relative_path}")
                return ""
            content = full_path.read_text(encoding="utf-8")
            if with_line_numbers:
                numbered = "\n".join(
                    f"{i+1:4d} | {line}"
                    for i, line in enumerate(content.splitlines())
                )
                return numbered
            return content
        except Exception as e:
            logger.error(f"[Review] Error reading {relative_path}: {e}")
            return ""

    def _precheck_fix(
        self,
        file_path: str,
        file_content: str,
        code_before: str,
        code_after: str,
        imports_needed: list[str],
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> list[str]:
        """
        Deterministic pre-checks across languages:
        - syntax validation on merged proposed file (language-specific best-effort)
        - duplicate exception/catch handler pattern checks
        - unreachable statements after return/raise/throw (heuristic for non-Python)
        """
        proposed_content, apply_error = self._build_proposed_file_content(
            file_content=file_content,
            code_before=code_before,
            code_after=code_after,
            imports_needed=imports_needed,
            start_line=start_line,
            end_line=end_line,
        )
        if apply_error:
            return [apply_error]

        ext = Path(file_path).suffix.lower()
        issues: list[str] = []
        syntax_ok, syntax_msg = self._validate_content_syntax(file_path, proposed_content)
        if not syntax_ok:
            return [f"Syntax validation failed after applying fix: {syntax_msg}"]

        if ext == ".py":
            # Calculate any line number shift from inserting new imports at the top
            shift = 0
            if imports_needed:
                lines = file_content.splitlines()
                last_import_line = 0
                for i, line in enumerate(lines):
                    if line.startswith("import ") or line.startswith("from "):
                        last_import_line = i
                new_imports = [imp for imp in imports_needed if imp and imp.strip() and not any(existing.strip() == imp.strip() for existing in lines)]
                shift = len(new_imports)

            if start_line is not None:
                adjusted_start = start_line + shift
                lines_after = len((code_after or "").splitlines())
                # Define range of modified lines with a 3-line safety margin
                valid_range = range(adjusted_start - 3, adjusted_start + lines_after + 4)
            else:
                valid_range = None

            tree = ast.parse(proposed_content)
            for node in ast.walk(tree):
                if isinstance(node, ast.Try):
                    node_lineno = getattr(node, "lineno", 0)
                    # Only check try blocks that intersect with the modified lines
                    if valid_range is not None and node_lineno not in valid_range:
                        continue
                    seen = set()
                    for handler in node.handlers:
                        exc_key = self._except_type_key(handler.type)
                        if exc_key in seen:
                            issues.append(
                                f"Duplicate except handler for {exc_key} in the same try block."
                            )
                        else:
                            seen.add(exc_key)

            for block in self._iter_statement_blocks(tree):
                found_terminator = False
                for stmt in block:
                    stmt_lineno = getattr(stmt, 'lineno', 0)
                    if found_terminator:
                        # Only report unreachable statements inside our modified range
                        if valid_range is None or stmt_lineno in valid_range:
                            issues.append(
                                f"Unreachable statement after return/raise at line {stmt_lineno}."
                            )
                            break
                    if isinstance(stmt, (ast.Return, ast.Raise)):
                        found_terminator = True
        else:
            issues.extend(self._generic_exception_structure_checks(proposed_content))
            issues.extend(self._generic_unreachable_checks(proposed_content))

        return issues

    def _build_compact_review_context(
        self,
        file_content: str,
        code_before: str,
        code_after: str,
        start_line: int | None = None,
        end_line: int | None = None,
        max_chars: int = 10000,
    ) -> str:
        """Token-efficient context for LLM review while keeping key signals."""
        if len(file_content) <= max_chars:
            return file_content

        lines = file_content.splitlines()
        total_lines = len(lines)
        start_idx = max((start_line or 1) - 1, 0)
        end_idx = min(end_line or total_lines, total_lines)

        if code_before and code_before in file_content:
            before_line = file_content[:file_content.index(code_before)].count("\n")
            before_len = len(code_before.splitlines())
            start_idx = max(before_line - 1, 0)
            end_idx = min(before_line + before_len, total_lines)

        window_before = max(start_idx - 150, 0)
        window_after = min(end_idx + 150, total_lines)
        window = "\n".join(lines[window_before:window_after])
        header = "\n".join(lines[: min(100, total_lines)])

        compact = (
            "# File too large; compact review context.\n"
            f"# Total lines: {total_lines}\n"
            f"# Focus window: lines {window_before + 1}-{window_after}\n\n"
            "## Module Header / Imports\n"
            f"{header}\n\n"
            "## Current Target Region\n"
            f"{window}\n\n"
            "## Replacement Pair\n"
            "### code_before\n"
            f"{code_before}\n\n"
            "### code_after\n"
            f"{code_after}"
        )
        return compact[:max_chars]

    def _validate_content_syntax(self, file_path: str, content: str) -> tuple[bool, str]:
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
            if ext in {".js", ".mjs", ".cjs"}:
                return self._run_syntax_command(["node", "--check", temp_path], "Node.js")
            if ext in {".ts", ".tsx"}:
                ok, msg = self._run_syntax_command(["npx", "--yes", "tsc", "--noEmit", temp_path], "TypeScript")
                if ok:
                    return True, ""
                fallback_ok, fallback_msg = self._run_syntax_command(["node", "--check", temp_path], "Node.js")
                if fallback_ok:
                    return True, ""
                return False, msg or fallback_msg
            if ext == ".go":
                return self._run_syntax_command(["gofmt", "-e", temp_path], "gofmt")
            if ext == ".rb":
                return self._run_syntax_command(["ruby", "-c", temp_path], "ruby")
            return True, ""
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

    def _run_syntax_command(self, command: list[str], label: str) -> tuple[bool, str]:
        try:
            proc = subprocess.run(command, capture_output=True, text=True, timeout=20)
        except FileNotFoundError:
            logger.warning(f"[Review] {label} syntax tool not available. Skipping strict syntax validation.")
            return True, ""
        except Exception as exc:
            return False, f"{label} syntax tool failed: {exc}"

        if proc.returncode == 0:
            return True, ""
        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        return False, stderr or stdout or f"{label} syntax check failed with exit code {proc.returncode}."

    def _generic_exception_structure_checks(self, content: str) -> list[str]:
        issues = []
        except_hits = re.findall(r"^\s*except\s+([^\s:]+)", content, flags=re.MULTILINE)
        for exc_name in set(except_hits):
            if except_hits.count(exc_name) > 1:
                issues.append(f"Potential duplicate except handlers detected for {exc_name}.")

        catch_hits = re.findall(r"^\s*catch\s*\(([^)]+)\)", content, flags=re.MULTILINE)
        for catch_expr in set(catch_hits):
            if catch_hits.count(catch_expr) > 1:
                issues.append(f"Potential duplicate catch handlers detected for {catch_expr.strip()}.")
        return issues

    def _generic_unreachable_checks(self, content: str) -> list[str]:
        issues = []
        lines = content.splitlines()
        for idx, line in enumerate(lines[:-1]):
            stripped = line.strip()
            if stripped.startswith(("return", "raise", "throw")):
                next_line = lines[idx + 1].strip()
                if next_line and not next_line.startswith(("}", "except", "catch", "elif", "else", "finally")):
                    issues.append(f"Potential unreachable statement after terminator near line {idx + 2}.")
        return issues

    def _build_proposed_file_content(
        self,
        file_content: str,
        code_before: str,
        code_after: str,
        imports_needed: list[str],
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> tuple[str, str]:
        updated = file_content
        lines = updated.splitlines()
        if imports_needed:
            last_import_line = 0
            for i, line in enumerate(lines):
                if line.startswith("import ") or line.startswith("from "):
                    last_import_line = i
            new_imports = []
            for imp in imports_needed:
                imp_line = (imp or "").strip()
                if not imp_line:
                    continue
                if not any(existing.strip() == imp_line for existing in lines):
                    new_imports.append(imp_line)
            for offset, imp_line in enumerate(new_imports):
                lines.insert(last_import_line + 1 + offset, imp_line)
            updated = "\n".join(lines)

        if code_before and code_before in updated:
            return updated.replace(code_before, code_after, 1), ""

        if start_line and end_line:
            line_list = updated.splitlines()
            if 1 <= start_line <= end_line <= len(line_list):
                line_list[start_line - 1:end_line] = (code_after or "").splitlines()
                return "\n".join(line_list), ""
            return updated, f"Proposed replacement line range {start_line}-{end_line} is out of bounds."

        return updated, "Could not map fix into file content (no exact match and no usable line range)."

    def _except_type_key(self, node: ast.AST | None) -> str:
        if node is None:
            return "bare"
        if isinstance(node, ast.Name):
            return node.id
        if isinstance(node, ast.Attribute):
            parts = []
            cur = node
            while isinstance(cur, ast.Attribute):
                parts.append(cur.attr)
                cur = cur.value
            if isinstance(cur, ast.Name):
                parts.append(cur.id)
            return ".".join(reversed(parts))
        if isinstance(node, ast.Tuple):
            return "|".join(sorted(self._except_type_key(elt) for elt in node.elts))
        return ast.dump(node, include_attributes=False)

    def _iter_statement_blocks(self, tree: ast.AST):
        for node in ast.walk(tree):
            for attr in ("body", "orelse", "finalbody"):
                block = getattr(node, attr, None)
                if isinstance(block, list) and block and all(isinstance(s, ast.stmt) for s in block):
                    yield block

    # ── Repo management (shared pattern with FixAgent) ────────────────────────

    def _parse_repo_slug(self, repo_url: str) -> str:
        url = repo_url.rstrip("/")
        if url.endswith(".git"):
            url = url[:-4]
        if "github.com/" in url:
            return url.split("github.com/")[-1]
        return url

    def _clone_repo(self):
        import git
        self._temp_dir = tempfile.mkdtemp(prefix="chaos_agent_review_")
        self._repo_path = os.path.join(self._temp_dir, "repo")

        # Determine if token looks like a placeholder
        token = self._github_token
        is_placeholder = (
            not token or
            "token" in token.lower() or
            "placeholder" in token.lower() or
            token == "mock_token"
        )

        if is_placeholder:
            clone_url = f"https://github.com/{self.repo_slug}.git"
            logger.info(f"[Review] Token looks like placeholder. Cloning public repo {self.repo_slug} without token...")
        else:
            clone_url = f"https://{token}@github.com/{self.repo_slug}.git"
            logger.info(f"[Review] Cloning {self.repo_slug} for review with token...")

        try:
            git.Repo.clone_from(clone_url, self._repo_path, depth=1)
        except Exception as e:
            if not is_placeholder:
                logger.warning(f"[Review] Failed to clone with token: {e}. Retrying without token...")
                clone_url = f"https://github.com/{self.repo_slug}.git"
                git.Repo.clone_from(clone_url, self._repo_path, depth=1)
            else:
                raise

        logger.info(f"[Review] Cloned to {self._repo_path}")

    def _cleanup(self):
        if self._temp_dir and os.path.exists(self._temp_dir):
            shutil.rmtree(self._temp_dir, ignore_errors=True)
