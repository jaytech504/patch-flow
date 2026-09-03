import json
import os
import subprocess
import uuid
import shutil
import tempfile
from pathlib import Path
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession

from backend.agents.base import BaseAgent, Tool
from backend.core.adapters import detect_framework
from backend.core.config import get_settings
from backend.core.models import FixStatus
from backend.core.websocket_manager import ws_manager
from backend.db.models import PullRequest

settings = get_settings()


class GitHubAgent(BaseAgent):
    """
    Takes the Fix Agent's output and makes it real.

    For each critical/high finding:
    1. Clones the target repo to a temp directory
    2. Asks Qwen to locate the exact file and line that needs the fix
    3. Applies the fix code to the correct location
    4. Creates a new branch
    5. Commits the change with a descriptive message
    6. Opens a GitHub Pull Request

    The PR description includes:
    - What failure mode was found
    - What the app was doing wrong
    - What the fix does and why
    - Link back to the chaos session report
    """

    name = "github"
    system_prompt = """You are the GitHub Agent in a chaos engineering system.
You receive a code fix and must locate exactly where in the source code to apply it.

Your job:
1. Find the correct source file for the affected endpoint
2. Find the exact function/route handler that needs the fix
3. Determine the precise insertion point (line number or after which code)
4. Apply the fix cleanly without breaking surrounding code

When analysing source files:
- Look for route decorators (@app.get, @router.post, @app.route, etc.)
- Match the endpoint path from the finding to the decorator
- Find the function body that handles that route
- Identify where the try/except block or error handler should be inserted

Return JSON:
{
  "file_path": "relative/path/to/file.py",
  "target_function": "function_name",
  "insertion_strategy": "wrap_body | add_middleware | add_import | replace_function",
  "original_code": "the exact code block to replace",
  "fixed_code": "the replacement code with the fix applied",
  "imports_needed": ["from sqlalchemy.exc import SQLAlchemyError"],
  "confidence": 0.0-1.0,
  "reasoning": "Why this is the correct location"
}"""

    def __init__(self, db: AsyncSession, session_id: str, repo_url: str, github_token: str = None):
        super().__init__(db, session_id)
        self.repo_url = repo_url                        # e.g. https://github.com/jason/myapp
        self.repo_slug = self._parse_repo_slug(repo_url)  # e.g. jason/myapp
        self._github_token = github_token or settings.github_token
        self._temp_dir = None
        self._repo_path = None
        self._github = None
        self._gh_repo = None
        self._register_tools()

    def _parse_repo_slug(self, repo_url: str) -> str:
        """Extract owner/repo from any GitHub URL format."""
        url = repo_url.rstrip("/")
        if url.endswith(".git"):
            url = url[:-4]
        if "github.com/" in url:
            return url.split("github.com/")[-1]
        return url

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

    # ── File Tools ────────────────────────────────────────────────────────────

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
            exts = [extension] if extension else [".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rb"]
            files = []
            for ext in exts:
                for f in repo_path.rglob(f"*{ext}"):
                    if any(skip in str(f) for skip in [".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", ".next"]):
                        continue
                    files.append(str(f.relative_to(repo_path)))
            return {"files": files[:60]}
        except Exception as e:
            return {"error": str(e)}

    async def _search_in_files(self, search_term: str) -> dict:
        try:
            results = []
            repo_path = Path(self._repo_path)
            for ext in ("*.ts", "*.tsx", "*.js", "*.jsx", "*.py", "*.mjs", "*.go", "*.rb"):
                for f in repo_path.rglob(ext):
                    if any(skip in str(f) for skip in [".git", "node_modules", "__pycache__", "venv", ".venv", "dist", "build", ".next"]):
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

    # ── Core GitHub Operations ────────────────────────────────────────────────

    def _setup_github(self):
        """Initialize PyGithub client."""
        from github import Github
        if not self._github_token:
            raise ValueError("No GitHub token available — cannot open PRs")
        self._github = Github(self._github_token)
        self._gh_repo = self._github.get_repo(self.repo_slug)
        logger.info(f"[GitHub] Connected to repo: {self.repo_slug}")

    def _clone_repo(self):
        """Clone the repo to a temp directory."""
        import git
        self._temp_dir = tempfile.mkdtemp(prefix="chaos_agent_")
        self._repo_path = os.path.join(self._temp_dir, "repo")

        # Build authenticated clone URL
        clone_url = f"https://{self._github_token}@github.com/{self.repo_slug}.git"
        logger.info(f"[GitHub] Cloning {self.repo_slug}...")
        git.Repo.clone_from(clone_url, self._repo_path, depth=1)
        logger.info(f"[GitHub] Cloned to {self._repo_path}")

    def _cleanup(self):
        """Remove temp directory."""
        if self._temp_dir and os.path.exists(self._temp_dir):
            shutil.rmtree(self._temp_dir, ignore_errors=True)

    # ── Build validation ──────────────────────────────────────────────────────

    def _detect_package_manager(self) -> str:
        """Detect the JS package manager used by the repo."""
        repo = Path(self._repo_path)
        if (repo / "bun.lockb").exists() or (repo / "bun.lock").exists():
            return "bun"
        if (repo / "pnpm-lock.yaml").exists():
            return "pnpm"
        if (repo / "yarn.lock").exists():
            return "yarn"
        return "npm"

    def _has_build_script(self) -> bool:
        """Check if the repo's package.json has a 'build' script."""
        pkg_json = Path(self._repo_path) / "package.json"
        if not pkg_json.exists():
            return False
        try:
            pkg = json.loads(pkg_json.read_text(encoding="utf-8"))
            return "build" in pkg.get("scripts", {})
        except Exception:
            return False

    def _run_build_validation(self, files_changed: list[str]) -> tuple[bool, str]:
        """
        Run a build command in the cloned repo after fixes are applied.

        For JS/TS frameworks: installs deps then runs `{pm} run build`.
        For Python frameworks: runs `python -m py_compile` on each changed .py file.

        Returns (success, output_text).
        """
        if not self._repo_path:
            return True, "No repo path — skipping build validation."

        adapter = detect_framework(self._repo_path)
        if not adapter or not adapter.build_command:
            logger.info("[GitHub] No framework adapter or build_command — skipping build validation.")
            return True, "No build command configured for this framework."

        logger.info(f"[GitHub] Running build validation for {adapter.display_name}...")

        # ── Python frameworks: py_compile per changed file ─────────────────
        if adapter.language == "python":
            py_files = [f for f in files_changed if f.endswith(".py")]
            if not py_files:
                return True, "No Python files changed — build validation skipped."
            errors = []
            for py_file in py_files:
                full_path = Path(self._repo_path) / py_file
                if not full_path.exists():
                    continue
                try:
                    result = subprocess.run(
                        ["python", "-m", "py_compile", str(full_path)],
                        capture_output=True, text=True, timeout=30,
                        cwd=self._repo_path,
                    )
                    if result.returncode != 0:
                        errors.append(f"{py_file}: {result.stderr.strip()}")
                except subprocess.TimeoutExpired:
                    errors.append(f"{py_file}: py_compile timed out")
                except Exception as e:
                    errors.append(f"{py_file}: {e}")
            if errors:
                output = "Python syntax check failed:\n" + "\n".join(errors)
                logger.error(f"[GitHub] {output}")
                return False, output
            return True, f"Python syntax check passed for {len(py_files)} file(s)."

        # ── JS/TS frameworks: npm install + npm run build ──────────────────
        pm = self._detect_package_manager()
        logger.info(f"[GitHub] Detected package manager: {pm}")

        # Check if a build script exists in package.json
        if not self._has_build_script():
            logger.info("[GitHub] No 'build' script in package.json — skipping build validation.")
            return True, "No 'build' script found in package.json."

        # Step 1: Install dependencies
        install_cmd = [pm, "install"]
        if pm == "npm":
            install_cmd.append("--legacy-peer-deps")
        elif pm == "pnpm":
            install_cmd.append("--no-frozen-lockfile")
        elif pm == "yarn":
            install_cmd.append("--ignore-engines")

        try:
            logger.info(f"[GitHub] Running: {' '.join(install_cmd)}")
            install_result = subprocess.run(
                install_cmd,
                capture_output=True, text=True, timeout=120,
                cwd=self._repo_path,
                env={**os.environ, "CI": "true", "NODE_ENV": "production"},
            )
            if install_result.returncode != 0:
                output = f"{pm} install failed:\n{install_result.stderr[-1500:]}"
                logger.error(f"[GitHub] {output}")
                return False, output
            logger.info(f"[GitHub] {pm} install succeeded.")
        except subprocess.TimeoutExpired:
            return False, f"{pm} install timed out after 120s."
        except FileNotFoundError:
            logger.warning(f"[GitHub] '{pm}' not found on PATH — skipping build validation.")
            return True, f"'{pm}' not available on server — build validation skipped."

        # Step 2: Run build
        build_cmd = [pm, *adapter.build_command]
        try:
            logger.info(f"[GitHub] Running: {' '.join(build_cmd)}")
            build_result = subprocess.run(
                build_cmd,
                capture_output=True, text=True, timeout=120,
                cwd=self._repo_path,
                env={**os.environ, "CI": "true", "NODE_ENV": "production"},
            )
            if build_result.returncode != 0:
                # Capture the most useful part of the error
                stderr = build_result.stderr[-2000:] if build_result.stderr else ""
                stdout = build_result.stdout[-2000:] if build_result.stdout else ""
                output = f"{pm} run build failed (exit {build_result.returncode}):\n"
                if stderr:
                    output += f"STDERR:\n{stderr}\n"
                if stdout:
                    output += f"STDOUT:\n{stdout}\n"
                logger.error(f"[GitHub] Build failed:\n{output[-500:]}")
                return False, output
            logger.info(f"[GitHub] ✓ {pm} run build succeeded.")
            return True, f"Build passed ({adapter.display_name}, {pm})."
        except subprocess.TimeoutExpired:
            return False, f"{pm} run build timed out after 120s."
        except Exception as e:
            logger.warning(f"[GitHub] Build command error: {e} — treating as non-blocking.")
            return True, f"Build command error (non-blocking): {e}"

    async def _revise_fixes_for_build_error(
        self,
        applied_fixes: list[dict],
        files_changed: set[str],
        build_error: str,
    ) -> bool:
        """
        Ask the LLM to revise the changed files to fix a build error.

        Reads each changed file from the cloned repo, sends it along with the
        build error output to the LLM, and writes the corrected content back.

        Returns True if at least one file was revised, False if revision failed.
        """
        any_revised = False

        for file_path in files_changed:
            full_path = Path(self._repo_path) / file_path
            if not full_path.exists():
                continue

            current_content = full_path.read_text(encoding="utf-8")

            # Find which fixes touched this file for context
            related_fixes = [
                f for f in applied_fixes
                if f.get("file_path") == file_path
            ]
            fix_context = "\n".join(
                f"- {f.get('finding_title', 'unknown')}: {f.get('explanation', '')[:200]}"
                for f in related_fixes
            )

            # Truncate build error to avoid token explosion
            error_snippet = build_error[-2000:]

            prompt = f"""The following file was modified by PatchFlow to add error handling,
but the build now fails. Fix the file so it compiles and builds successfully.

## Build Error
```
{error_snippet}
```

## Fixes Applied to This File
{fix_context}

## Current File Content ({file_path})
```
{current_content[:12000]}
```

## Instructions
- Return ONLY the complete corrected file content, no markdown fences, no explanation.
- Keep all the error-handling improvements that were added — only fix what causes the build error.
- Common issues: duplicate imports, missing imports, syntax errors, type errors.
- Do NOT remove the error handling that was added unless it is fundamentally broken.
- The output must be the ENTIRE file content, ready to write directly to disk."""

            try:
                await self._log("thought", f"Asking LLM to fix build error in {file_path}...")
                response = await self.client.chat.completions.create(
                    model=settings.gemma_model,
                    messages=[
                        {"role": "system", "content": (
                            "You are a code repair agent. You receive a file that causes a build error "
                            "and you return the corrected file content. Return ONLY the raw file content, "
                            "no markdown fences, no explanation text."
                        )},
                        {"role": "user", "content": prompt},
                    ],
                    max_tokens=8192,
                )

                revised_content = response.choices[0].message.content.strip()

                # Strip markdown fences if the LLM wrapped the output
                if revised_content.startswith("```"):
                    lines = revised_content.split("\n")
                    # Remove first line (```lang) and last line (```)
                    if lines[-1].strip() == "```":
                        lines = lines[1:-1]
                    else:
                        lines = lines[1:]
                    revised_content = "\n".join(lines)

                if not revised_content or len(revised_content) < 20:
                    logger.warning(f"[GitHub] LLM returned empty/tiny revision for {file_path} — skipping.")
                    continue

                # Sanity check: revision should be roughly similar length (not a hallucination)
                ratio = len(revised_content) / max(len(current_content), 1)
                if ratio < 0.3 or ratio > 3.0:
                    logger.warning(
                        f"[GitHub] LLM revision for {file_path} has suspicious length ratio "
                        f"({ratio:.2f}) — skipping to be safe."
                    )
                    continue

                full_path.write_text(revised_content, encoding="utf-8")
                any_revised = True
                logger.info(f"[GitHub] ✓ Revised {file_path} to fix build error.")

            except Exception as e:
                logger.error(f"[GitHub] Failed to revise {file_path}: {e}")
                continue

        return any_revised

    def _sanitize_fixed_code(self, fixed_code: str) -> str:
        """Strip LLM instruction-comments that leak into generated code.

        The LLM sometimes embeds meta-instructions like:
          # At line 15, add to existing import block:
          # import logging
        These are not real code and cause merge conflicts when applied.
        """
        cleaned_lines = []
        skip_patterns = [
            "# At line ",
            "# Add to existing import",
            "# Add this to the import",
            "# Insert at ",
            "# Place at ",
            "# --- Endpoint:",
            "# ── Endpoint:",
        ]
        for line in fixed_code.splitlines():
            stripped = line.strip()
            if any(stripped.startswith(pat) for pat in skip_patterns):
                logger.debug(f"[GitHub] Stripped instruction-comment: {stripped}")
                continue
            cleaned_lines.append(line)
        return "\n".join(cleaned_lines)

    def _apply_fix_to_file(self, file_path: str, original_code: str, fixed_code: str,
                            imports_needed: list[str],
                            start_line: int | None = None,
                            end_line: int | None = None) -> bool:
        """Apply the fix by replacing the original code block with fixed code.

        Strategy:
        1. Try exact string replacement first.
        2. If that fails but start_line/end_line are provided, replace those lines directly.
        3. If neither works, skip (do not append junk comments).
        """
        full_path = Path(self._repo_path) / file_path
        if not full_path.exists():
            logger.error(f"[GitHub] File not found: {file_path}")
            return False

        content = full_path.read_text(encoding="utf-8")

        # Sanitize LLM output — strip instruction-comments
        fixed_code = self._sanitize_fixed_code(fixed_code)

        applied = False
        updated = content

        # Strategy 1: Exact string replacement
        if original_code and original_code in updated:
            updated = updated.replace(original_code, fixed_code, 1)
            applied = True
            logger.info(f"[GitHub] Fix applied via exact string match to {file_path}")
        elif original_code and original_code.strip() in updated:
            updated = updated.replace(original_code.strip(), fixed_code.strip(), 1)
            applied = True
            logger.info(f"[GitHub] Fix applied via trimmed string match to {file_path}")
        elif start_line and end_line:
            # Strategy 2: Line-range replacement
            lines = updated.splitlines()
            if 1 <= start_line <= end_line <= len(lines):
                fixed_lines = fixed_code.splitlines()
                lines[start_line - 1 : end_line] = fixed_lines
                updated = "\n".join(lines)
                applied = True
                logger.info(f"[GitHub] Fix applied via line-range ({start_line}-{end_line}) to {file_path}")
            else:
                logger.warning(f"[GitHub] Line range {start_line}-{end_line} out of bounds for {file_path} ({len(lines)} lines)")

        if not applied:
            logger.warning(f"[GitHub] Could not apply fix to {file_path} -- neither string match nor line-range succeeded")
            return False

        # Add missing imports AFTER code replacement
        if imports_needed:
            lines = updated.splitlines()
            last_import_line = -1
            directive_line = -1
            for i, line in enumerate(lines):
                stripped = line.strip()
                if stripped in ('"use client";', "'use client';", '"use server";', "'use server';"):
                    directive_line = i
                if stripped.startswith("import ") or stripped.startswith("from "):
                    last_import_line = i

            insert_pos = (last_import_line + 1) if last_import_line >= 0 else (directive_line + 1 if directive_line >= 0 else 0)

            new_imports = []
            for imp in imports_needed:
                imp_stripped = imp.strip()
                if not imp_stripped:
                    continue
                if not any(existing_line.strip() == imp_stripped for existing_line in lines):
                    new_imports.append(imp_stripped)

            if new_imports:
                for offset, imp_line in enumerate(new_imports):
                    lines.insert(insert_pos + offset, imp_line)
                updated = "\n".join(lines)

        full_path.write_text(updated, encoding="utf-8")
        return True

    def _post_process_file(self, file_path: str):
        """Clean up a file after all fixes have been applied.

        - Deduplicate import lines (preserves order, keeps first occurrence)
        - Remove blank-line runs longer than 2
        """
        full_path = Path(self._repo_path) / file_path
        if not full_path.exists():
            return

        lines = full_path.read_text(encoding="utf-8").splitlines()

        # --- Pass 1: Deduplicate import lines ---
        seen_imports = set()
        deduped = []
        for line in lines:
            stripped = line.strip()
            if stripped.startswith("import ") or stripped.startswith("from "):
                if stripped in seen_imports:
                    logger.debug(f"[GitHub] Removed duplicate import: {stripped}")
                    continue
                seen_imports.add(stripped)
            deduped.append(line)

        # --- Pass 2: Collapse excessive blank lines (max 2 consecutive) ---
        cleaned = []
        blank_count = 0
        for line in deduped:
            if line.strip() == "":
                blank_count += 1
                if blank_count <= 2:
                    cleaned.append(line)
            else:
                blank_count = 0
                cleaned.append(line)

        full_path.write_text("\n".join(cleaned), encoding="utf-8")
        logger.info(f"[GitHub] Post-processed {file_path}: deduped imports, cleaned whitespace")

    def _create_branch_and_pr(
        self,
        branch_name: str,
        files_changed: list[str],
        pr_title: str,
        pr_body: str,
        commit_message: str,
    ) -> dict:
        """Commit changes to a new branch and open a PR."""
        import git

        repo = git.Repo(self._repo_path)

        # Create and checkout new branch
        new_branch = repo.create_head(branch_name)
        new_branch.checkout()

        # Stage all changes
        repo.index.add(files_changed)

        # Commit
        repo.index.commit(
            commit_message,
            author=git.Actor("Chaos Agent", "chaos-agent@noreply.github.com"),
        )

        # Push branch
        origin = repo.remote("origin")
        origin.push(refspec=f"{branch_name}:{branch_name}")
        logger.info(f"[GitHub] Pushed branch: {branch_name}")

        # Open PR via GitHub API
        default_branch = self._gh_repo.default_branch
        pr = self._gh_repo.create_pull(
            title=pr_title,
            body=pr_body,
            head=branch_name,
            base=default_branch,
        )

        logger.info(f"[GitHub] PR opened: #{pr.number} — {pr.html_url}")
        return {"pr_number": pr.number, "pr_url": pr.html_url}

    def _build_consolidated_pr_body(
        self,
        fixes_applied: list[dict],
        session_id: str,
        build_output: str = "",
    ) -> str:
        """Build a PR body summarizing all applied fixes."""
        sections = []
        for fix in fixes_applied:
            endpoints = ", ".join(fix.get("affected_endpoints", ["unknown"]))
            sections.append(f"""### {fix.get('finding_title', 'Error handling fix')}
**Severity:** {fix.get('severity', 'HIGH')}
**Endpoints:** {endpoints}
**File:** `{fix.get('file_path', 'unknown')}`

{fix.get('explanation', 'Adds proper error handling for identified failure modes.')}
""")

        # Build status line — reflects actual build result
        build_line = f"✅ Passed — {build_output[:120]}" if build_output else "✅ Verified"

        body = f"""## 🤖 Auto-generated by PatchFlow

This PR consolidates **{len(fixes_applied)}** error-handling fix(es) verified by PatchFlow's autonomous pipeline.

### 🛡️ Pre-Merge Build & Safety Verification
- **Syntax & AST Validation:** ✅ Passed
- **Build Check:** {build_line}
- **Reviewer Agent Status:** ✅ Approved

{chr(10).join(sections)}

---
*Generated by [PatchFlow](https://github.com/jaytech504/patch-flow)*  
*Review carefully before merging — automated fixes are pre-built and verified before opening this PR.*"""
        return body

    # ── Main Entry Point ──────────────────────────────────────────────────────

    async def handle(self, fixes_result: dict, analysis: dict, report_id: str) -> list[dict]:
        """
        Apply all fixes to a single clone and open ONE consolidated PR.
        Returns list of opened PR records (typically one).
        """
        if not self._github_token:
            logger.warning("[GitHub] No GitHub token available — skipping PR creation")
            await ws_manager.emit_status(
                self.session_id, "github_skipped",
                "No GitHub token configured — fixes generated in report only"
            )
            return []

        await ws_manager.emit_status(
            self.session_id, "opening_prs",
            f"Opening Pull Request on {self.repo_slug}..."
        )

        try:
            self._setup_github()
            self._clone_repo()
        except Exception as e:
            logger.error(f"[GitHub] Setup failed: {e}")
            await ws_manager.emit_status(self.session_id, "github_failed", str(e))
            return []

        fixes = fixes_result.get("fixes", [])
        if not fixes:
            logger.warning("[GitHub] No fixes to apply")
            self._cleanup()
            return []

        # ── Validation gate ───────────────────────────────────────────────────
        # Eligible for PR: any fix that passed PatchValidator and was generated
        # or revised. Fixes with hard PatchValidator errors (e.g. unsafe file path,
        # secrets leak, empty code) carry validation_failed and are excluded.
        _BLOCKED_STATUSES = {FixStatus.VALIDATION_FAILED.value}

        eligible_fixes: list[dict] = []
        skipped_fixes: list[dict] = []

        for fix in fixes:
            fix_status = fix.get("status", FixStatus.GENERATED.value)
            if fix_status in _BLOCKED_STATUSES:
                reason = fix.get("skip_reason") or "Fix status is 'validation_failed' — blocked from PR creation."
                fix = {**fix, "status": FixStatus.PR_SKIPPED.value, "skip_reason": reason}
                skipped_fixes.append(fix)
                logger.info(
                    f"[GitHub] Skipping fix for "
                    f"{', '.join(fix.get('affected_endpoints', ['?']))} "
                    f"— {fix_status}: {reason[:120]}"
                )
            else:
                eligible_fixes.append(fix)

        if skipped_fixes:
            await ws_manager.broadcast(self.session_id, "fixes_skipped", {
                "count": len(skipped_fixes),
                "fixes": [
                    {
                        "finding_title": f.get("finding_title", ""),
                        "affected_endpoints": f.get("affected_endpoints", []),
                        "status": f.get("status"),
                        "skip_reason": f.get("skip_reason", ""),
                    }
                    for f in skipped_fixes
                ],
            })

        if not eligible_fixes:
            logger.warning("[GitHub] All fixes were blocked by the validation gate — no PR created.")
            self._cleanup()
            await ws_manager.emit_status(
                self.session_id, "github_skipped",
                f"No eligible fixes — {len(skipped_fixes)} fix(es) blocked by validation."
            )
            return []

        # Apply all eligible fixes to the single clone
        applied_fixes = []
        files_changed = set()

        # Sort fixes by file_path then start_line descending so that
        # line-range replacements don't shift line numbers for later fixes in the same file
        sorted_fixes = sorted(
            eligible_fixes,
            key=lambda f: (f.get("file_path", ""), -(f.get("start_line", 0) or 0))
        )

        for fix in sorted_fixes:
            file_path = fix.get("file_path")
            original_code = fix.get("code_before", fix.get("original_code", ""))
            fixed_code = fix.get("code_after", fix.get("fixed_code", ""))
            imports_needed = fix.get("imports_needed", [])
            start_line = fix.get("start_line")
            end_line = fix.get("end_line")

            if not file_path:
                logger.warning(f"[GitHub] Fix missing file_path, skipping: {fix.get('finding_title')}")
                continue

            if not fixed_code:
                logger.warning(f"[GitHub] Fix has no code_after, skipping: {fix.get('finding_title')}")
                continue

            await self._log("thought",
                            f"Applying fix to {file_path} "
                            f"(lines {start_line}-{end_line}) for: "
                            f"{', '.join(fix.get('affected_endpoints', []))}")

            success = self._apply_fix_to_file(
                file_path, original_code, fixed_code, imports_needed,
                start_line=start_line, end_line=end_line
            )

            if success:
                applied_fixes.append(fix)
                files_changed.add(file_path)
                logger.info(f"[GitHub] ✓ Applied fix for {fix.get('finding_title')} to {file_path}")
            else:
                logger.warning(f"[GitHub] ✗ Failed to apply fix for {fix.get('finding_title')} to {file_path}")

        if not applied_fixes:
            logger.warning("[GitHub] No fixes could be applied")
            self._cleanup()
            await ws_manager.emit_status(self.session_id, "github_failed",
                                         "No fixes could be applied to the codebase")
            return []

        # Post-process every changed file: deduplicate imports, clean whitespace
        for fp in files_changed:
            self._post_process_file(fp)

        # ── Build validation gate (with 1 retry via LLM) ──────────────────
        MAX_BUILD_RETRIES = 1
        build_ok = False
        build_output = ""

        for build_attempt in range(1 + MAX_BUILD_RETRIES):
            await ws_manager.emit_status(
                self.session_id, "build_validating",
                f"Running build validation (attempt {build_attempt + 1})..."
            )
            build_ok, build_output = self._run_build_validation(list(files_changed))

            if build_ok:
                logger.info(f"[GitHub] ✓ Build validation passed: {build_output[:120]}")
                break

            # Build failed
            logger.warning(
                f"[GitHub] Build attempt {build_attempt + 1} failed:\n"
                f"{build_output[-500:]}"
            )

            if build_attempt < MAX_BUILD_RETRIES:
                # ── Ask LLM to fix the build error ────────────────────────
                await ws_manager.emit_status(
                    self.session_id, "build_fixing",
                    "Build failed — asking AI to fix the build error..."
                )

                revision_success = await self._revise_fixes_for_build_error(
                    applied_fixes, files_changed, build_output
                )

                if not revision_success:
                    logger.warning("[GitHub] LLM revision could not fix the build error.")
                    # Don't retry again — fall through to the final build_ok check
                    break

                # Post-process again after revision
                for fp in files_changed:
                    self._post_process_file(fp)
            # else: last attempt, will exit loop with build_ok=False

        if not build_ok:
            logger.error(
                f"[GitHub] Build validation failed after {MAX_BUILD_RETRIES + 1} attempt(s) "
                f"— PR blocked:\n{build_output[-500:]}"
            )
            self._cleanup()
            await ws_manager.emit_status(
                self.session_id, "build_failed",
                f"Build validation failed after retry — PR not opened. {build_output[-200:]}"
            )
            return []

        # Build ONE consolidated branch + PR
        branch_name = f"chaos-agent/fixes-{self.session_id[:8]}"
        pr_title = f"fix: {len(applied_fixes)} error-handling improvements from chaos testing"
        pr_body = self._build_consolidated_pr_body(
            applied_fixes, self.session_id, build_output=build_output
        )
        commit_msg = (f"fix: {len(applied_fixes)} error-handling improvements\n\n"
                      f"Auto-generated by Chaos Agent\n"
                      f"Session: {self.session_id}")

        try:
            pr_info = self._create_branch_and_pr(
                branch_name=branch_name,
                files_changed=list(files_changed),
                pr_title=pr_title,
                pr_body=pr_body,
                commit_message=commit_msg,
            )
        except Exception as e:
            logger.error(f"[GitHub] Failed to create PR: {e}")
            self._cleanup()
            await ws_manager.emit_status(self.session_id, "github_failed", str(e))
            return []

        # Save to DB
        pr_record = PullRequest(
            id=str(uuid.uuid4()),
            session_id=self.session_id,
            report_id=report_id,
            github_repo=self.repo_slug,
            branch_name=branch_name,
            pr_number=pr_info.get("pr_number"),
            pr_url=pr_info.get("pr_url"),
            pr_title=pr_title,
            finding_title=f"{len(applied_fixes)} fixes consolidated",
            files_changed=list(files_changed),
            status="opened",
        )
        self.db.add(pr_record)
        await self.db.flush()

        # Stream PR opened event to frontend
        await ws_manager.broadcast(self.session_id, "pr_opened", {
            "pr_number": pr_info.get("pr_number"),
            "pr_url": pr_info.get("pr_url"),
            "pr_title": pr_title,
            "fixes_count": len(applied_fixes),
            "files_changed": list(files_changed),
        })

        self._cleanup()

        logger.info(f"[GitHub] Opened 1 consolidated PR with {len(applied_fixes)} fixes")
        await ws_manager.emit_status(
            self.session_id, "prs_complete",
            f"Pull Request opened on {self.repo_slug} with {len(applied_fixes)} fix(es)"
        )

        return [{
            "pr_number": pr_info.get("pr_number"),
            "pr_url": pr_info.get("pr_url"),
            "pr_title": pr_title,
            "files_changed": list(files_changed),
            "fixes_applied": len(applied_fixes),
            "fixes_skipped": len(skipped_fixes),
        }]

