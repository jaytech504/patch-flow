import unittest
from backend.core.syntax_validator import (
    filter_typescript_syntax_errors,
    validate_content_syntax,
    validate_file_syntax,
)


class SyntaxValidatorTests(unittest.TestCase):
    def test_typescript_filter_ignores_module_and_type_errors(self):
        # Sample output with typical missing module / unresolved types from isolated tsc run
        tsc_output = """
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(1,29): error TS2307: Cannot find module 'react-router-dom' or its corresponding type declarations.
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(2,24): error TS2307: Cannot find module 'framer-motion' or its corresponding type declarations.
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(33,50): error TS2503: Cannot find namespace 'React'.
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(53,7): error TS2875: This JSX tag requires the module path 'react/jsx-runtime' to exist, but none could be found.
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(54,9): error TS7026: JSX element implicitly has type 'any' because no interface 'JSX.IntrinsicElements' exists.
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(156,31): error TS7006: Parameter 'e' implicitly has an 'any' type.
../../../../tmp/chaos_agent_fix_uvpu2wv1/repo/src/pages/Notes.tsx(117,28): error TS7053: Element implicitly has an 'any' type because expression of type 'any' can't be used to index type '{ pdf: any; }'.
"""
        ok, msg = filter_typescript_syntax_errors(tsc_output)
        self.assertTrue(ok)
        self.assertEqual(msg, "")

    def test_typescript_filter_catches_syntactic_errors(self):
        tsc_output = """
src/pages/Notes.tsx(140,21): error TS1005: ';' expected.
src/pages/Notes.tsx(170,11): error TS17002: Expected corresponding JSX closing tag for 'div'.
src/pages/Notes.tsx(1,29): error TS2307: Cannot find module 'react-router-dom'.
"""
        ok, msg = filter_typescript_syntax_errors(tsc_output)
        self.assertFalse(ok)
        self.assertIn("TS1005", msg)
        self.assertIn("TS17002", msg)
        self.assertNotIn("TS2307", msg)

    def test_typescript_empty_output_passes(self):
        ok, msg = filter_typescript_syntax_errors("")
        self.assertTrue(ok)
        self.assertEqual(msg, "")

    def test_python_valid_syntax(self):
        code = "def add(a: int, b: int) -> int:\n    return a + b\n"
        ok, msg = validate_content_syntax("app/main.py", code)
        self.assertTrue(ok)
        self.assertEqual(msg, "")

    def test_python_invalid_syntax(self):
        code = "def add(a, b\n    return a + b\n"
        ok, msg = validate_content_syntax("app/main.py", code)
        self.assertFalse(ok)
        self.assertIn("line 1", msg)

    def test_unknown_extension_passes(self):
        ok, msg = validate_content_syntax("notes.txt", "Some random content @#$")
        self.assertTrue(ok)
        self.assertEqual(msg, "")


if __name__ == "__main__":
    unittest.main()
