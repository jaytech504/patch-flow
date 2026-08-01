import unittest

from backend.agents.orchestrator import ChaosOrchestrator
from backend.agents.review_agent import ReviewAgent


class _ReviewAgentHarness(ReviewAgent):
    """Minimal harness to test review flow without external services."""

    def __init__(self, file_content: str = ""):
        self.repo_url = None
        self.repo_slug = None
        self._github_token = None
        self._temp_dir = None
        self._repo_path = None
        self._file_content = file_content

    async def _log(self, *args, **kwargs):
        return None

    def _cleanup(self):
        return None

    def _read_file(self, relative_path: str, with_line_numbers: bool = True) -> str:
        if not self._file_content:
            return ""
        if not with_line_numbers:
            return self._file_content
        return "\n".join(
            f"{idx + 1:4d} | {line}"
            for idx, line in enumerate(self._file_content.splitlines())
        )

    async def run(self, task: str, context: dict = None) -> dict:
        return {"verdict": "validated", "issues": []}


class _MalformedReviewAgentHarness(_ReviewAgentHarness):
    async def run(self, task: str, context: dict = None) -> dict:
        return {"status": "invalid_model_output"}


class OrchestratorMergeTests(unittest.TestCase):
    def setUp(self):
        self.orch = ChaosOrchestrator(db=None, session_id="test-session")

    def test_merge_revised_fixes_replaces_rejected(self):
        validated = [
            {
                "file_path": "app.py",
                "affected_endpoints": ["/health"],
                "finding_title": "Health check safe errors",
                "severity": "HIGH",
                "code_after": "old-validated",
            }
        ]
        rejected = [
            {
                "file_path": "app.py",
                "affected_endpoints": ["/users"],
                "finding_title": "User timeout handling",
                "severity": "CRITICAL",
                "code_after": "old-broken-version",
            }
        ]
        revised = [
            {
                "file_path": "app.py",
                "affected_endpoints": ["/users"],
                "finding_title": "User timeout handling",
                "severity": "CRITICAL",
                "code_after": "new-revised-version",
            }
        ]

        merged = self.orch._merge_revised_fixes(validated, rejected, revised)
        self.assertEqual(len(merged), 2)
        self.assertEqual(sum(1 for f in merged if f["finding_title"] == "User timeout handling"), 1)
        self.assertIn("new-revised-version", [f["code_after"] for f in merged])
        self.assertNotIn("old-broken-version", [f["code_after"] for f in merged])

    def test_merge_does_not_duplicate_unmatched_revisions(self):
        validated = []
        rejected = [
            {
                "file_path": "demo_app.py",
                "affected_endpoints": ["/notes"],
                "finding_title": "Note timeout",
                "severity": "HIGH",
            }
        ]
        revised = [
            {
                "file_path": "demo_app.py",
                "affected_endpoints": ["/notes"],
                "finding_title": "Note timeout",
                "severity": "HIGH",
            },
            {
                "file_path": "demo_app.py",
                "affected_endpoints": ["/payments/charge"],
                "finding_title": "Payment timeout",
                "severity": "HIGH",
            },
        ]

        merged = self.orch._merge_revised_fixes(validated, rejected, revised)
        self.assertEqual(len(merged), 2)
        self.assertEqual(sum(1 for f in merged if f["finding_title"] == "Note timeout"), 1)
        self.assertEqual(sum(1 for f in merged if f["finding_title"] == "Payment timeout"), 1)


class ReviewAgentRegressionTests(unittest.IsolatedAsyncioTestCase):
    async def test_review_fails_closed_for_malformed_model_output(self):
        reviewer = _MalformedReviewAgentHarness(file_content="def handler():\n    return 1\n")
        result = await reviewer.handle({
            "fixes": [{
                "finding_title": "Safe handler",
                "file_path": "app.py",
                "code_before": "def handler():\n    return 1\n",
                "code_after": "def handler():\n    return 1\n",
                "affected_endpoints": ["/health"],
            }]
        })
        self.assertEqual(len(result["fixes"]), 0)
        self.assertEqual(len(result["needs_revision"]), 1)
        self.assertEqual(result["needs_revision"][0]["review_status"], "revision_needed")

    async def test_review_requires_full_file_context(self):
        reviewer = _ReviewAgentHarness(file_content="")
        fix_result = {
            "fixes": [
                {
                    "finding_title": "User timeout handling",
                    "file_path": "app.py",
                    "code_before": "old",
                    "code_after": "new",
                    "affected_endpoints": ["/users"],
                }
            ]
        }

        result = await reviewer.handle(fix_result)
        self.assertEqual(len(result["fixes"]), 0)
        self.assertEqual(len(result["needs_revision"]), 1)
        self.assertEqual(result["needs_revision"][0]["review_status"], "revision_needed")

    def test_precheck_python_catches_duplicate_except_and_unreachable(self):
        reviewer = _ReviewAgentHarness()
        file_content = (
            "def handler():\n"
            "    try:\n"
            "        return 1\n"
            "    except ValueError:\n"
            "        raise\n"
        )
        code_after = (
            "def handler():\n"
            "    try:\n"
            "        raise ValueError('x')\n"
            "        y = 1\n"
            "    except ValueError:\n"
            "        pass\n"
            "    except ValueError:\n"
            "        pass\n"
        )
        issues = reviewer._precheck_fix(
            file_path="app.py",
            file_content=file_content,
            code_before=file_content,
            code_after=code_after,
            imports_needed=[],
        )
        self.assertTrue(any("Duplicate except handler" in issue for issue in issues))
        self.assertTrue(any("Unreachable statement" in issue for issue in issues))


if __name__ == "__main__":
    unittest.main()
