import ast
import os
import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.agents.base import BaseAgent, Tool
from backend.core.config import get_settings
from backend.db.models import FailureResult, ChaosSession, SessionStatus, Report

settings = get_settings()


class FixAgent(BaseAgent):
    """
    The most technically impressive agent.
    Takes unhandled failures and generates actual, usable error handling code.
    Not generic advice — specific code patches for the exact gaps found.
    """
    name = "fix"
    system_prompt = """You are the Fix Agent in a chaos engineering system.
You generate specific, production-ready error handling code for identified gaps.

Rules:
- Generate actual code, not advice
- Match the framework (FastAPI, Express, Django, etc.) detected in discovery
- Each fix must be copy-paste ready
- Include the before (broken) and after (fixed) code
- Add comments explaining WHY this fix handles the specific failure

For FastAPI/Python, use patterns like:
- httpx.TimeoutException handling with retry logic
- try/except blocks with specific exception types
- HTTPException with appropriate status codes
- Dependency injection for circuit breakers

Return JSON:
{
  "fixes": [
    {
      "finding_title": "Database errors leak internal details",
      "failure_modes": ["db_connection_drop", "db_timeout"],
      "affected_endpoints": ["/users"],
      "severity": "CRITICAL",
      "explanation": "Why this is dangerous and what the fix does",
      "code_before": "# vulnerable code example",
      "code_after": "# fixed code with proper error handling",
      "language": "python",
      "fix_type": "exception_handler | middleware | decorator | circuit_breaker",
      "file_path": "app/main.py",
      "imports_needed": ["from sqlalchemy.exc import SQLAlchemyError"]
    }
  ],
  "global_fixes": [
    {
      "title": "Add global exception handler",
      "code": "# middleware/handler code",
      "explanation": "Apply this globally to catch all unhandled exceptions"
    }
  ]
}"""

    def __init__(self, db: AsyncSession, session_id: str, repo_url: str = None, github_token: str = None, framework: str = "fastapi"):
        super().__init__(db, session_id)
        # Fix generation is expensive; keep outputs concise and reduce loops.
        self.max_iterations = 5
        self.max_tokens_per_call = 4096
        self.framework = framework
        self.repo_url = repo_url
        self.repo_slug = self._parse_repo_slug(repo_url) if repo_url else None
        self._github_token = github_token or settings.github_token
        self._temp_dir = None
        self._repo_path = None
        self.language = "python"
        self.detected_framework = framework

    async def handle(self, analysis: dict, failure_results: list[dict]) -> dict:
        await self._update_session_status(SessionStatus.FIXING)

        critical_findings = analysis.get("critical_findings", [])
        all_findings = analysis.get("all_findings", [])

        # The LLM sometimes puts HIGH-severity issues only in all_findings,
        # leaving critical_findings empty.  Merge both lists so we never
        # skip actionable findings.  Keep CRITICAL and HIGH; cap at 5.
        seen_titles = set()
        actionable_findings = []
        for f in critical_findings + all_findings:
            sev = (f.get("severity") or "").upper()
            title = f.get("title", "")
            if sev in ("CRITICAL", "HIGH") and title not in seen_titles:
                seen_titles.add(title)
                actionable_findings.append(f)
        actionable_findings = actionable_findings[:5]

        if not actionable_findings:
            logger.warning("[Fix] No CRITICAL or HIGH findings — nothing to fix.")

        # Try to clone repo if provided
        cloned_successfully = False
        if self.repo_url and self._github_token:
            try:
                self._clone_repo()
                self._register_tools()
                cloned_successfully = True
            except Exception as e:
                logger.error(f"[Fix] Failed to clone repo {self.repo_url}: {e}")

        fixes = []
        global_fixes = []

        if cloned_successfully:
            # Process each critical/high finding — split by individual endpoint
            for finding in actionable_findings:
                affected_endpoints = finding.get("affected_endpoints", [])
                if not affected_endpoints:
                    # No specific endpoints — generate a single vacuum fix
                    fallback_fix = await self._generate_vacuum_fix(finding)
                    if fallback_fix:
                        fixes.extend(fallback_fix)
                    continue

                # Process each endpoint individually
                for endpoint_path in affected_endpoints[:5]:
                    try:
                        await self._log("thought", f"Locating endpoint {endpoint_path} for finding: {finding.get('title')}")

                        # Try to find the method for this endpoint path from the DB
                        method = "GET"  # fallback
                        try:
                            from backend.db.models import Endpoint
                            from sqlalchemy import select
                            stmt = select(Endpoint).where(Endpoint.session_id == self.session_id).where(Endpoint.path == endpoint_path)
                            res = await self.db.execute(stmt)
                            ep_record = res.scalar_one_or_none()
                            if ep_record:
                                method = ep_record.method
                        except Exception as db_err:
                            logger.warning(f"[Fix] Failed to lookup method for {endpoint_path}: {db_err}")

                        # Try to locate programmatically first to save tokens
                        location = self._locate_endpoint_programmatically(endpoint_path, method)

                        if location:
                            await self._log(
                                "thought",
                                f"Programmatically located endpoint {endpoint_path} ({method}) in "
                                f"{location['file_path']} (lines {location['start_line']}-{location['end_line']})"
                            )
                        else:
                            await self._log("thought", f"Could not programmatically locate {endpoint_path}. Falling back to LLM locator...")
                            # Step 1: Locate the single endpoint's code block
                            location = await self.run(
                                task=f"""Find the source code for ONE specific endpoint handler.

Endpoint to find: {endpoint_path}
Framework: {self.detected_framework}

Steps:
1. Search for route decorators matching "{endpoint_path}" (e.g. @app.get("{endpoint_path}") or @router.get("{endpoint_path}"))
2. Read the file containing this endpoint
3. Identify the COMPLETE function (decorator + def line + full body until the next decorator or top-level definition)
4. Return the start and end line numbers

IMPORTANT: Return ONLY this single endpoint's function. Do NOT include other endpoints.

Return JSON:
{{
  "file_path": "relative/path/to/file.py",
  "target_function": "function_name",
  "start_line": 42,
  "end_line": 58,
  "original_code": "the exact lines from start_line to end_line, copied character for character",
  "reasoning": "Why this is the correct location"
}}""",
                                context={"endpoint": endpoint_path, "finding_title": finding.get("title")}
                            )

                        file_path = location.get("file_path")
                        original_code = location.get("original_code")
                        start_line = location.get("start_line")
                        end_line = location.get("end_line")

                        if not file_path or not original_code:
                            logger.warning(f"[Fix] Could not locate {endpoint_path}. Skipping.")
                            continue

                        generation_error = ""
                        max_attempts = 3
                        tailored_result = None

                        for attempt in range(1, max_attempts + 1):
                            # Always read latest file before generating each attempt
                            current_file_state = ""
                            raw_file_state = ""
                            try:
                                raw_file_state = self._get_repo_file_content(file_path)
                            except Exception:
                                raw_file_state = ""
                            if raw_file_state:
                                current_file_state = self._build_compact_file_context(
                                    raw_content=raw_file_state,
                                    start_line=start_line,
                                    end_line=end_line,
                                )

                            await self._log(
                                "thought",
                                f"Generating fix for {endpoint_path} in {file_path}:{start_line}-{end_line} (attempt {attempt}/{max_attempts})"
                            )
                            lang_rules = self._get_lang_rules()
                            retry_block = (
                                f"\nPrevious attempt failed due to syntax error:\n{generation_error}\n"
                                "You MUST correct the syntax and structure issues."
                                if generation_error
                                else ""
                            )
                            candidate = await self.run(
                                task=f"""Generate a production-ready error handling fix for this SINGLE endpoint.

Endpoint: {endpoint_path}
Finding: {finding.get('title')}
Framework: {self.detected_framework}
File: {file_path} (lines {start_line}-{end_line})
Failure modes: {finding.get('failure_modes', [])}

Original Code (lines {start_line}-{end_line}):
{original_code}

Current Full File State:
{current_file_state if current_file_state else "(file not available)"}

Rules:
- Replace ONLY this endpoint's function. Do NOT include other endpoints.
- The code_before MUST be the exact original code above, character for character.
- The code_after must be a drop-in replacement with proper error handling added.
- CRITICAL: Do NOT call any function that does not exist in the file. If you need a helper, define it inline or inside the function.
{lang_rules}
- CRITICAL: Do NOT invent helper functions like `_get_cached()` or `_store_result()`. Inline the logic instead.
- Do NOT add section dividers or comment headers like "# --- Endpoint: ... ---"
- Do NOT include meta-instruction comments like "# At line X, add..." or "# Add to existing import block". These are NOT code.
- Put ALL needed imports in the "imports_needed" array. Do NOT put import statements inside code_after.
- The imports_needed array must contain ONLY actual import lines (e.g. "import logging", "from fastapi import HTTPException"). Do NOT include non-import setup like "logger = logging.getLogger(__name__)" — put those in code_after if needed.
- Generate against the CURRENT full file state above (not a stale snapshot).{retry_block}

IMPORTANT: Output ONLY the JSON below. Do NOT write lengthy analysis or reasoning. Go straight to the JSON.

Return JSON:
{{
  "finding_title": "{finding.get('title')}",
  "failure_modes": {finding.get('failure_modes', [])},
  "affected_endpoints": ["{endpoint_path}"],
  "severity": "{finding.get('severity', 'HIGH')}",
  "explanation": "What was wrong and what the fix does",
  "code_before": "exact original code to replace",
  "code_after": "fixed code with proper error handling",
  "language": "{self.language}",
  "fix_type": "exception_handler",
  "imports_needed": ["list of imports/setup lines needed, e.g. packages/modules"]
}}""",
                                context={"endpoint": endpoint_path, "original_code": original_code}
                            )

                            # Reject candidates with no actual fix code
                            if not candidate.get("code_after", "").strip():
                                generation_error = "LLM returned no code_after in response."
                                logger.warning(f"[Fix] Empty code_after for {endpoint_path}, retrying...")
                                continue

                            # Ensure metadata is correctly set
                            candidate["file_path"] = file_path
                            candidate["start_line"] = start_line
                            candidate["end_line"] = end_line
                            candidate["affected_endpoints"] = [endpoint_path]
                            if not candidate.get("code_before"):
                                candidate["code_before"] = original_code

                            # Apply candidate to current file state sequentially
                            applied, error_msg = self._apply_fix_to_repo_file(
                                file_path=file_path,
                                original_code=candidate.get("code_before", ""),
                                fixed_code=candidate.get("code_after", ""),
                                imports_needed=candidate.get("imports_needed", []),
                                start_line=start_line,
                                end_line=end_line,
                            )
                            if not applied:
                                generation_error = error_msg or "Failed to apply generated replacement to current file state."
                                logger.warning(f"[Fix] Candidate fix could not be applied for {endpoint_path}: {generation_error}")
                                continue

                            # Validate full updated file syntax for Python before accepting
                            valid_syntax, syntax_err = self._validate_repo_file_syntax(file_path)
                            if not valid_syntax:
                                generation_error = syntax_err
                                if raw_file_state:
                                    self._set_repo_file_content(file_path, raw_file_state)
                                logger.warning(f"[Fix] Syntax validation failed for {file_path}: {syntax_err}")
                                continue

                            tailored_result = candidate
                            break

                        if not tailored_result:
                            logger.warning(f"[Fix] Could not generate a valid syntax-safe fix for {endpoint_path}. Skipping.")
                            continue

                        fixes.append(tailored_result)
                        logger.info(f"[Fix] Generated fix for {endpoint_path} @ {file_path}:{start_line}-{end_line}")

                    except Exception as e:
                        logger.error(f"[Fix] Failed fix for endpoint '{endpoint_path}': {e}")
                        continue

            self._cleanup()
        else:
            # Fallback: vacuum-style generate fixes for all critical findings in one go
            logger.info("[Fix] No repo clone or token, falling back to vacuum-style fix generation.")
            vacuum_result = await self._generate_vacuum_all_fixes(analysis, actionable_findings, all_findings)
            fixes = vacuum_result.get("fixes", [])
            global_fixes = vacuum_result.get("global_fixes", [])

        fixes_result = {
            "fixes": fixes,
            "global_fixes": global_fixes
        }

        # Update FailureResult records with fix code
        await self._attach_fixes_to_results(fixes, failure_results)

        # Build and save final report
        report = await self._save_report(analysis, fixes_result)

        logger.info(f"[Fix] Generated {len(fixes)} fixes. Report: {report.id}")
        return {
            "report_id": report.id,
            "fixes_count": len(fixes),
            "fixes": fixes,
            "global_fixes": global_fixes,
        }

    def _get_repo_file_content(self, file_path: str) -> str:
        full_path = Path(self._repo_path) / file_path
        return full_path.read_text(encoding="utf-8")

    def _set_repo_file_content(self, file_path: str, content: str):
        full_path = Path(self._repo_path) / file_path
        full_path.write_text(content, encoding="utf-8")

    def _build_compact_file_context(
        self,
        raw_content: str,
        start_line: int | None = None,
        end_line: int | None = None,
        max_chars: int = 9000,
    ) -> str:
        """
        Build token-efficient context: full file when small, otherwise
        imports/header + targeted window around the endpoint.
        """
        if len(raw_content) <= max_chars:
            return raw_content

        lines = raw_content.splitlines()
        total_lines = len(lines)
        start_idx = max((start_line or 1) - 1, 0)
        end_idx = min(end_line or total_lines, total_lines)

        # Keep a broad local window around target block
        window_before = max(start_idx - 120, 0)
        window_after = min(end_idx + 120, total_lines)
        window = "\n".join(lines[window_before:window_after])

        # Keep top imports/module header for symbol resolution context
        header_lines = lines[: min(80, total_lines)]
        header = "\n".join(header_lines)

        compact = (
            "# File too large; compact context provided for token efficiency.\n"
            f"# Total lines: {total_lines}\n"
            f"# Focus window: lines {window_before + 1}-{window_after}\n\n"
            "## Module Header / Imports\n"
            f"{header}\n\n"
            "## Focused Region\n"
            f"{window}"
        )
        return compact[:max_chars]

    def _apply_fix_to_repo_file(
        self,
        file_path: str,
        original_code: str,
        fixed_code: str,
        imports_needed: list[str] | None = None,
        start_line: int | None = None,
        end_line: int | None = None,
    ) -> tuple[bool, str]:
        """Apply one fix directly to the cloned repo file and persist it."""
        if not self._repo_path:
            return False, "Repo is not cloned."

        full_path = Path(self._repo_path) / file_path
        if not full_path.exists():
            return False, f"File not found: {file_path}"

        content = full_path.read_text(encoding="utf-8")
        updated = content

        if imports_needed:
            lines = updated.splitlines()
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

        if original_code and original_code in updated:
            updated = updated.replace(original_code, fixed_code, 1)
        elif start_line and end_line:
            lines = updated.splitlines()
            if not (1 <= start_line <= end_line <= len(lines)):
                return False, f"Line range {start_line}-{end_line} out of bounds for {file_path} ({len(lines)} lines)."
            lines[start_line - 1:end_line] = (fixed_code or "").splitlines()
            updated = "\n".join(lines)
        else:
            return False, "Neither exact code match nor valid line range replacement available."

        full_path.write_text(updated, encoding="utf-8")
        return True, ""

    def _validate_repo_file_syntax(self, file_path: str) -> tuple[bool, str]:
        """Validate updated file syntax for multiple languages, best-effort."""
        if not self._repo_path:
            return True, ""

        full_path = Path(self._repo_path) / file_path
        if not full_path.exists():
            return False, f"File not found for syntax check: {file_path}"

        content = full_path.read_text(encoding="utf-8")
        ext = full_path.suffix.lower()

        if ext == ".py":
            try:
                ast.parse(content)
                return True, ""
            except SyntaxError as exc:
                return False, f"{exc.msg} at line {exc.lineno}, col {exc.offset}"

        if ext in {".js", ".mjs", ".cjs"}:
            return self._run_syntax_command(["node", "--check", str(full_path)], "Node.js")

        if ext in {".ts", ".tsx"}:
            ok, msg = self._run_syntax_command(["npx", "--yes", "tsc", "--noEmit", str(full_path)], "TypeScript")
            if ok:
                return True, ""
            # Fallback to Node check when TS toolchain is unavailable.
            fallback_ok, fallback_msg = self._run_syntax_command(["node", "--check", str(full_path)], "Node.js")
            if fallback_ok:
                return True, ""
            return False, msg or fallback_msg

        if ext == ".go":
            return self._run_syntax_command(["gofmt", "-e", str(full_path)], "gofmt")

        if ext == ".rb":
            return self._run_syntax_command(["ruby", "-c", str(full_path)], "ruby")

        # Unknown extension: do not block, rely on review checks.
        return True, ""

    def _run_syntax_command(self, command: list[str], label: str) -> tuple[bool, str]:
        try:
            proc = subprocess.run(command, capture_output=True, text=True, timeout=20)
        except FileNotFoundError:
            logger.warning(f"[Fix] {label} syntax tool not available. Skipping strict syntax validation.")
            return True, ""
        except Exception as exc:
            return False, f"{label} syntax tool failed: {exc}"

        if proc.returncode == 0:
            return True, ""

        stderr = (proc.stderr or "").strip()
        stdout = (proc.stdout or "").strip()
        details = stderr or stdout or f"{label} syntax check failed with exit code {proc.returncode}."
        return False, details

    async def revise_fixes(self, fixes_needing_revision: list[dict]) -> list[dict]:
        """
        Re-generate fixes that failed review, using the reviewer's feedback.

        Each fix in the list has:
        - All the original fix fields (code_before, code_after, file_path, etc.)
        - review_feedback: str — specific instructions from the ReviewAgent
        - review_issues: list[str] — list of issues found

        Returns a list of revised fixes.
        """
        if not fixes_needing_revision:
            return []

        # Clone repo to read file context for revision
        cloned = False
        if self.repo_url and self._github_token:
            try:
                self._clone_repo()
                self._register_tools()
                cloned = True
            except Exception as e:
                logger.error(f"[Fix] Failed to clone repo for revision: {e}")

        revised_fixes = []

        for fix in fixes_needing_revision:
            endpoint_label = ", ".join(fix.get("affected_endpoints", ["unknown"]))
            await self._log(
                "thought",
                f"Revising fix for {endpoint_label} based on review feedback"
            )

            # Read the full file for context
            file_content = ""
            if cloned and fix.get("file_path"):
                try:
                    raw = self._get_repo_file_content(fix["file_path"])
                    file_content = self._build_compact_file_context(
                        raw_content=raw,
                        start_line=fix.get("start_line"),
                        end_line=fix.get("end_line"),
                    )
                except Exception:
                    pass

            review_feedback = fix.get("review_feedback", "")
            review_issues = fix.get("review_issues", [])

            try:
                lang_rules = self._get_lang_rules()
                revised = await self.run(
                    task=f"""A senior code reviewer has REJECTED your previous fix and provided specific feedback.
You MUST address ALL of the reviewer's issues and generate a corrected fix.

## Original Code (what is currently in the file)
```
{fix.get('code_before', '')}
```

## Your Previous Fix (REJECTED)
```
{fix.get('code_after', '')}
```

## Reviewer's Issues
{chr(10).join(f'- {issue}' for issue in review_issues)}

## Reviewer's Instructions
{review_feedback}

## Full File Context
```
{file_content if file_content else '(file not available)'}
```

## Requirements
- Fix ALL issues identified by the reviewer
- The code_before MUST remain exactly the same (it's the original code to replace)
- The code_after must address every reviewer issue
- CRITICAL: Do NOT call any function that is not defined in the file. If you need a helper function, define it INSIDE the endpoint function or inline the logic.
{lang_rules}
- CRITICAL: Do NOT invent helper functions like `_get_cached()`, `_store_result()` — either define them in the file or inline the logic.
- Make sure all imports are accounted for — either already in the file or in imports_needed
- Do NOT introduce any dead code or unreachable branches
- Match the coding style of the rest of the file

Return JSON:
{{
  "finding_title": "{fix.get('finding_title', '')}",
  "failure_modes": {fix.get('failure_modes', [])},
  "affected_endpoints": {fix.get('affected_endpoints', [])},
  "severity": "{fix.get('severity', 'HIGH')}",
  "explanation": "Updated explanation of what the fix does",
  "code_before": "exact original code (unchanged)",
  "code_after": "corrected fix addressing all reviewer feedback",
  "language": "{self.language}",
  "fix_type": "exception_handler",
  "imports_needed": ["list of ALL imports/setup lines needed by the fix"]
}}""",
                    context={
                        "review_feedback": review_feedback,
                        "original_fix": fix,
                    }
                )

                # Preserve metadata from the original fix
                revised["file_path"] = fix.get("file_path")
                revised["start_line"] = fix.get("start_line")
                revised["end_line"] = fix.get("end_line")
                revised["affected_endpoints"] = fix.get("affected_endpoints", [])

                # Make sure code_before is preserved exactly
                if not revised.get("code_before"):
                    revised["code_before"] = fix.get("code_before", "")

                revised["revision_attempt"] = fix.get("revision_attempt", 0) + 1
                revised_fixes.append(revised)

                logger.info(f"[Fix] Revised fix for {endpoint_label}")
                await self._log("result", f"✅ Revised fix for {endpoint_label}")

            except Exception as e:
                logger.error(f"[Fix] Failed to revise fix for {endpoint_label}: {e}")
                # Keep the original fix as-is if revision fails
                fix["review_status"] = "revision_failed"
                revised_fixes.append(fix)

        if cloned:
            self._cleanup()

        return revised_fixes

    async def _generate_vacuum_fix(self, finding: dict) -> list[dict]:
        """Generate a fallback isolated template fix for a single finding."""
        result = await self.run(
            task=f"""Generate production-ready error handling code fixes for this finding.

Framework: {self.framework}
Finding:
- Severity: {finding.get('severity', 'UNKNOWN')}
- Title: {finding.get('title', 'Unnamed finding')}
- Endpoints: {finding.get('affected_endpoints', [])}
- Failure modes: {finding.get('failure_modes', [])}

Return JSON with a 'fixes' list, matching:
{{
  "fixes": [
    {{
      "finding_title": "{finding.get('title')}",
      "failure_modes": {finding.get('failure_modes', [])},
      "affected_endpoints": {finding.get('affected_endpoints', [])},
      "severity": "{finding.get('severity', 'UNKNOWN')}",
      "explanation": "Why this is dangerous and what the fix does",
      "code_before": "# vulnerable code example",
      "code_after": "# fixed code with proper error handling",
      "language": "python",
      "fix_type": "exception_handler"
    }}
  ]
}}""",
            context={"finding": finding}
        )
        return result.get("fixes", [])

    async def _generate_vacuum_all_fixes(self, analysis: dict, critical_findings: list[dict], all_findings: list[dict]) -> dict:
        """Existing implementation of FixAgent running in a vacuum."""
        fixes_result = await self.run(
            task=f"""Generate production-ready error handling code fixes for these findings.

Framework: {self.framework}
Risk Score: {analysis.get('risk_score', 'unknown')}

Critical findings requiring fixes:
{self._format_findings(critical_findings)}

All findings:
{self._format_findings(all_findings[:8])}

Patterns identified:
{chr(10).join(analysis.get('patterns', []))}

Generate specific, copy-paste ready code fixes for each finding.
Prioritise the CRITICAL and HIGH severity findings first.""",
            context={
                "framework": self.framework,
                "risk_score": analysis.get("risk_score"),
                "findings_count": len(critical_findings) + len(all_findings),
            }
        )
        return fixes_result

    def _parse_repo_slug(self, repo_url: str) -> str:
        """Extract owner/repo from any GitHub URL format."""
        url = repo_url.rstrip("/")
        if url.endswith(".git"):
            url = url[:-4]
        if "github.com/" in url:
            return url.split("github.com/")[-1]
        return url

    def _clone_repo(self):
        """Clone the repo to a temp directory."""
        import git
        self._temp_dir = tempfile.mkdtemp(prefix="chaos_agent_fix_")
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
            logger.info(f"[Fix] Token looks like placeholder. Cloning public repo {self.repo_slug} without token...")
        else:
            clone_url = f"https://{token}@github.com/{self.repo_slug}.git"
            logger.info(f"[Fix] Cloning {self.repo_slug} with token...")

        try:
            git.Repo.clone_from(clone_url, self._repo_path, depth=1)
        except Exception as e:
            if not is_placeholder:
                logger.warning(f"[Fix] Failed to clone with token: {e}. Retrying without token...")
                clone_url = f"https://github.com/{self.repo_slug}.git"
                git.Repo.clone_from(clone_url, self._repo_path, depth=1)
            else:
                raise

        logger.info(f"[Fix] Cloned to {self._repo_path}")
        self._detect_framework_and_language()

    def _detect_framework_and_language(self):
        if not self._repo_path or not os.path.exists(self._repo_path):
            return

        import json

        # 1. Check for Node.js (JavaScript/TypeScript)
        package_json_path = os.path.join(self._repo_path, "package.json")
        if os.path.exists(package_json_path):
            self.language = "javascript"
            self.detected_framework = "express"  # default fallback for node
            try:
                with open(package_json_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    deps = {**data.get("dependencies", {}), **data.get("devDependencies", {})}
                    if "express" in deps:
                        self.detected_framework = "express"
                    elif "fastify" in deps:
                        self.detected_framework = "fastify"
                    elif "@nestjs/core" in deps:
                        self.detected_framework = "nestjs"
                    elif "next" in deps:
                        self.detected_framework = "nextjs"
            except Exception as e:
                logger.error(f"[Fix] Error reading package.json: {e}")

            # Check if typescript is used
            tsconfig = os.path.join(self._repo_path, "tsconfig.json")
            if os.path.exists(tsconfig):
                self.language = "typescript"
            return

        # 2. Check for Python
        py_indicators = ["requirements.txt", "pyproject.toml", "Pipfile", "setup.py"]
        has_py_file = any(os.path.exists(os.path.join(self._repo_path, ind)) for ind in py_indicators)
        if not has_py_file:
            # Check if any .py files exist in the repo
            for root, dirs, files in os.walk(self._repo_path):
                if any(f.endswith(".py") for f in files):
                    has_py_file = True
                    break

        if has_py_file:
            self.language = "python"
            self.detected_framework = "fastapi"  # default fallback
            # Try to read requirements.txt to detect framework
            req_path = os.path.join(self._repo_path, "requirements.txt")
            if os.path.exists(req_path):
                try:
                    with open(req_path, "r", encoding="utf-8") as f:
                        content = f.read().lower()
                        if "fastapi" in content:
                            self.detected_framework = "fastapi"
                        elif "flask" in content:
                            self.detected_framework = "flask"
                        elif "django" in content:
                            self.detected_framework = "django"
                except Exception as e:
                    logger.error(f"[Fix] Error reading requirements.txt: {e}")
            return

        # 3. Check for Go
        if os.path.exists(os.path.join(self._repo_path, "go.mod")):
            self.language = "go"
            self.detected_framework = "standard"
            return

        # 4. Check for Ruby
        if os.path.exists(os.path.join(self._repo_path, "Gemfile")):
            self.language = "ruby"
            self.detected_framework = "rails"
            return

    def _get_lang_rules(self) -> str:
        if self.language == "python":
            return """- CRITICAL: If you use `logger`, you MUST include BOTH `import logging` AND `logger = logging.getLogger(__name__)` in imports_needed. The import alone is NOT enough.
- Use `if value is not None:` instead of `if value:` when the value could legitimately be 0."""
        elif self.language in ("javascript", "typescript"):
            return """- CRITICAL: If you use a logger (like `console` or a logging library), make sure any required imports or setups are in imports_needed.
- Use strict equality checks `value !== null && value !== undefined` instead of `if (value)` when the value could legitimately be 0 or an empty string."""
        elif self.language == "go":
            return """- CRITICAL: Make sure all packages needed (e.g. "log", "fmt") are included in imports_needed.
- Handle zero values correctly according to Go idiom (e.g. checking for nil vs empty structs)."""
        else:
            return "- CRITICAL: Ensure all required external libraries/modules/packages are included in imports_needed."

    def _locate_endpoint_programmatically(self, endpoint_path: str, method: str) -> dict:
        """
        Attempts to programmatically find the file, start_line, end_line, and original_code
        of the given endpoint using file scanning and simple AST/regex heuristics.
        Returns a dict with keys: file_path, start_line, end_line, original_code
        or None if not found.
        """
        if not self._repo_path or not os.path.exists(self._repo_path):
            return None

        # Format endpoint path for lookup (standardizing trailing slashes)
        path = endpoint_path.strip()
        path_variants = [path]
        if path.endswith("/"):
            path_variants.append(path[:-1])
        else:
            path_variants.append(path + "/")

        # For Node/Express, path might have :param instead of {param}
        # e.g., /users/{user_id} -> /users/:user_id
        import re
        express_path = re.sub(r'\{([^}]+)\}', r':\1', path)
        if express_path not in path_variants:
            path_variants.append(express_path)

        repo_path = Path(self._repo_path)
        
        # Scan source files
        extensions = (".py", ".js", ".ts", ".tsx", ".go", ".java", ".rb")
        for ext in extensions:
            for f in repo_path.rglob(f"*{ext}"):
                if any(p in str(f) for p in [".git", "node_modules", "__pycache__", "venv", "backend", "frontend", ".gemini", "artifacts", "scratch", "brain"]):
                    continue
                try:
                    content = f.read_text(encoding="utf-8")
                    # Check if any path variant is in the file content
                    if not any(variant in content for variant in path_variants):
                        continue

                    import re
                    lines = content.splitlines()
                    for idx, line in enumerate(lines):
                        # Extract quoted strings in the line to match the path precisely
                        quoted_strings = re.findall(r'["\']([^"\']+)["\']', line)
                        path_matched = False
                        if quoted_strings:
                            for q in quoted_strings:
                                q_clean = q.strip().rstrip('/')
                                for variant in path_variants:
                                    v_clean = variant.rstrip('/')
                                    if q_clean == v_clean:
                                        path_matched = True
                                        break
                                if path_matched:
                                    break
                        else:
                            if any(variant in line for variant in path_variants):
                                path_matched = True

                        if path_matched:
                            # Let's verify if the method matches (case-insensitive check)
                            # e.g. app.get, @router.post, r.GET, GetMapping
                            lower_line = line.lower()
                            method_call = f".{method.lower()}("
                            method_call_upper = f".{method.upper()}("
                            is_route = (
                                "@" in line or
                                "app." in lower_line or
                                "router." in lower_line or
                                "route" in lower_line or
                                method_call in line or
                                method_call_upper in line
                            )
                            if is_route and (method.lower() in lower_line or any(m in lower_line for m in [".route", "request"])):
                                # We found the decorator/definition line!
                                start_idx = idx
                                # Now backtrack to find any leading decorators/annotations
                                while start_idx > 0:
                                    prev_line = lines[start_idx - 1].strip()
                                    if prev_line.startswith("@") or prev_line.startswith("["):
                                        start_idx -= 1
                                    else:
                                        break
                                
                                # Now find the end of the function/block
                                end_idx = idx
                                if ext == ".py":
                                    # For python, read until the indentation level goes back to <= start line indentation
                                    # Find the def line first to get base indentation (matching def or async def)
                                    def_line_idx = idx
                                    while def_line_idx < len(lines) and not lines[def_line_idx].strip().startswith(("def ", "async def ")):
                                        def_line_idx += 1
                                    if def_line_idx >= len(lines):
                                        def_line_idx = idx # fallback
                                    
                                    # Get base indentation
                                    def_line = lines[def_line_idx]
                                    base_indent = len(def_line) - len(def_line.lstrip())
                                    
                                    end_idx = def_line_idx + 1
                                    while end_idx < len(lines):
                                        curr_line = lines[end_idx]
                                        if not curr_line.strip():
                                            end_idx += 1
                                            continue
                                        curr_indent = len(curr_line) - len(curr_line.lstrip())
                                        # If indentation is less than or equal to def base indentation, we hit the end
                                        if curr_indent <= base_indent and not curr_line.strip().startswith((")", "]", "}")):
                                            break
                                        end_idx += 1
                                else:
                                    # For JS/Go/Java, match braces { and }
                                    brace_count = 0
                                    found_braces = False
                                    for scan_idx in range(idx, len(lines)):
                                        scan_line = lines[scan_idx]
                                        brace_count += scan_line.count("{") - scan_line.count("}")
                                        if "{" in scan_line:
                                            found_braces = True
                                        if found_braces and brace_count <= 0:
                                            end_idx = scan_idx + 1
                                            break
                                    if end_idx == idx:
                                        # Fallback: scan 30 lines
                                        end_idx = min(len(lines), idx + 30)

                                original_lines = lines[start_idx:end_idx]
                                return {
                                    "file_path": str(f.relative_to(repo_path)).replace("\\", "/"),
                                    "target_function": "",
                                    "start_line": start_idx + 1,
                                    "end_line": end_idx,
                                    "original_code": "\n".join(original_lines),
                                    "reasoning": f"Programmatically matched path '{endpoint_path}' and method '{method}' in {f.name}"
                                }
                except Exception as e:
                    logger.warning(f"[Fix] Error scanning file {f} for programmatic search: {e}")
                    continue
        return None

    def _cleanup(self):
        """Remove temp directory."""
        if self._temp_dir and os.path.exists(self._temp_dir):
            shutil.rmtree(self._temp_dir, ignore_errors=True)

    def _register_tools(self):
        self.register_tool(Tool(
            name="read_source_file",
            description="Read a source file from the cloned repository. You can read the entire file or a specific range of lines.",
            parameters={
                "type": "object",
                "properties": {
                    "relative_path": {
                        "type": "string",
                        "description": "Path relative to repo root, e.g. 'app/main.py'"
                    },
                    "start_line": {
                        "type": "integer",
                        "description": "Optional 1-indexed starting line number",
                        "default": 1
                    },
                    "end_line": {
                        "type": "integer",
                        "description": "Optional 1-indexed ending line number"
                    }
                },
                "required": ["relative_path"],
            },
            func=self._read_source_file,
        ))

        self.register_tool(Tool(
            name="list_source_files",
            description="List all Python/JS source files in the repository",
            parameters={
                "type": "object",
                "properties": {
                    "extension": {
                        "type": "string",
                        "description": "File extension to filter by, e.g. '.py' or '.ts'",
                        "default": ".py"
                    }
                },
            },
            func=self._list_source_files,
        ))

        self.register_tool(Tool(
            name="search_in_files",
            description="Search for a string across all source files",
            parameters={
                "type": "object",
                "properties": {
                    "search_term": {
                        "type": "string",
                        "description": "String to search for, e.g. '@app.get(\"/users\"'"
                    }
                },
                "required": ["search_term"],
            },
            func=self._search_in_files,
        ))

    async def _read_source_file(self, relative_path: str, start_line: int = 1, end_line: int | None = None) -> dict:
        """Read a source file, with optional windowing to avoid token blowout."""
        DEFAULT_WINDOW = 300
        try:
            full_path = Path(self._repo_path) / relative_path
            if not full_path.exists():
                return {"error": f"File not found: {relative_path}"}
            content = full_path.read_text(encoding="utf-8")
            all_lines = content.splitlines()
            total = len(all_lines)

            # Standardise line bounds
            start = max(1, start_line)
            if end_line is None:
                if start == 1:
                    end = min(total, DEFAULT_WINDOW)
                else:
                    end = min(total, start + DEFAULT_WINDOW - 1)
            else:
                end = min(total, max(start, end_line))

            display_lines = all_lines[start - 1 : end]
            # Return with line numbers so Qwen can reference them
            numbered = "\n".join(
                f"{i + start:4d} | {line}"
                for i, line in enumerate(display_lines)
            )
            
            truncated = total > end or start > 1
            if truncated:
                numbered += f"\n\n... (Showing lines {start}-{end} of {total} total lines. Specify start_line and end_line parameters to read other parts, or use search_in_files to locate specific code.)"
            return {"path": relative_path, "content": numbered, "lines": total, "start_line": start, "end_line": end, "truncated": truncated}
        except Exception as e:
            return {"error": str(e)}

    async def _list_source_files(self, extension: str = None) -> dict:
        try:
            repo_path = Path(self._repo_path)
            # If the caller asks for the default ".py" but the detected language is different,
            # we should adjust the default to match the detected language.
            if extension is None or extension == ".py":
                if self.language != "python":
                    if self.language in ("javascript", "typescript"):
                        extension = ".js"
                    elif self.language == "go":
                        extension = ".go"
                    elif self.language == "ruby":
                        extension = ".rb"
                    else:
                        extension = ".py"
            if extension is None:
                extension = ".py"
                
            files = [
                str(f.relative_to(repo_path))
                for f in repo_path.rglob(f"*{extension}")
                if ".git" not in str(f) and "node_modules" not in str(f)
                and "__pycache__" not in str(f) and "venv" not in str(f)
            ]
            return {"files": files[:50]}
        except Exception as e:
            return {"error": str(e)}

    async def _search_in_files(self, search_term: str) -> dict:
        try:
            results = []
            repo_path = Path(self._repo_path)
            # Scan common source file extensions
            for ext in ("*.py", "*.js", "*.ts", "*.tsx", "*.go", "*.rb", "*.java", "*.kt", "*.cs"):
                for f in repo_path.rglob(ext):
                    if ".git" in str(f) or "__pycache__" in str(f) or "node_modules" in str(f):
                        continue
                    try:
                        content = f.read_text(encoding="utf-8")
                        if search_term in content:
                            lines = content.splitlines()
                            matches = [
                                {"line": i + 1, "content": line.strip()}
                                for i, line in enumerate(lines)
                                if search_term in line
                             ]
                            results.append({
                                "file": str(f.relative_to(repo_path)),
                                "matches": matches,
                            })
                    except Exception:
                        continue
            return {"results": results}
        except Exception as e:
            return {"error": str(e)}

    async def _attach_fixes_to_results(self, fixes: list[dict], failure_results: list[dict]):
        """Link fix code to the specific FailureResult records."""
        for fix in fixes:
            affected_modes = fix.get("failure_modes", [])
            # Normalize paths: strip trailing slashes for comparison
            affected_paths_norm = {p.rstrip("/") for p in fix.get("affected_endpoints", [])}

            for result in failure_results:
                result_path_norm = result["endpoint_path"].rstrip("/")
                if (result["failure_mode"] in affected_modes and
                        result_path_norm in affected_paths_norm):
                    db_result = await self.db.get(FailureResult, result["id"])
                    if db_result:
                        db_result.fix_generated = True
                        db_result.fix_code = fix.get("code_after", "")
                        db_result.fix_explanation = fix.get("explanation", "")
                        await self.db.flush()

    async def _save_report(self, analysis: dict, fixes_result: dict) -> Report:
        session = await self.db.get(ChaosSession, self.session_id)

        fixes = fixes_result.get("fixes", [])
        fix_count = len(fixes)

        # Keep status as FIXING — the orchestrator will set COMPLETE
        # after Review and GitHub agents finish.  Setting COMPLETE here
        # was premature and caused the UI to show "completed" before
        # PRs were actually opened.
        if session:
            session.fixes_generated = fix_count
            await self.db.flush()

        report = Report(
            id=str(uuid.uuid4()),
            session_id=self.session_id,
            summary=analysis.get("summary", ""),
            critical_findings=analysis.get("critical_findings", []),
            all_findings=analysis.get("all_findings", []),
            fixes=fixes + fixes_result.get("global_fixes", []),
            risk_score=analysis.get("risk_score", 0),
        )
        self.db.add(report)
        await self.db.flush()

        return report

    def _format_findings(self, findings: list[dict]) -> str:
        if not findings:
            return "None"
        lines = []
        for f in findings:
            lines.append(
                f"- [{f.get('severity', 'UNKNOWN')}] {f.get('title', 'Unnamed finding')}\n"
                f"  Endpoints: {f.get('affected_endpoints', [])}\n"
                f"  Failure modes: {f.get('failure_modes', [])}"
            )
        return "\n".join(lines)

    async def _update_session_status(self, status: SessionStatus):
        session = await self.db.get(ChaosSession, self.session_id)
        if session:
            session.status = status
            await self.db.flush()
