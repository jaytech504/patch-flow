import unittest

from backend.core.patch_validation import PatchValidator


class PatchValidatorTests(unittest.TestCase):
    def test_valid_patch_passes(self):
        report = PatchValidator.validate({
            "file_path": "app/routes.py",
            "code_before": "return response",
            "code_after": "return safe_response",
            "imports_needed": ["from fastapi import HTTPException"],
        })
        self.assertEqual(report.status, "passed")

    def test_missing_replacement_fails(self):
        report = PatchValidator.validate({
            "file_path": "app/routes.py",
            "code_before": "return response",
            "code_after": "",
        })
        self.assertEqual(report.status, "failed")
        self.assertIn("missing_code_after", [check.code for check in report.checks])

    def test_path_traversal_fails(self):
        report = PatchValidator.validate({
            "file_path": "../../secrets.py",
            "code_before": "old",
            "code_after": "new",
        })
        self.assertEqual(report.status, "failed")
        self.assertIn("unsafe_file_path", [check.code for check in report.checks])

    def test_instruction_and_secret_patterns_warn(self):
        report = PatchValidator.validate({
            "file_path": "app/routes.py",
            "code_before": "old",
            "code_after": "# At line 3, add this\nkey = 'sk_live_abcdefghijklmnopqrst'",
        })
        self.assertEqual(report.status, "warnings")
        self.assertEqual(
            {check.code for check in report.checks},
            {"instruction_leakage", "possible_secret"},
        )


if __name__ == "__main__":
    unittest.main()
