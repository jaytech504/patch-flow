import unittest

from backend.agents.base import BaseAgent
from backend.agents.fix_agent import FixAgent


class _AgentHarness(BaseAgent):
    async def handle(self, *args, **kwargs):
        return {}


class GemmaOutputParsingTests(unittest.TestCase):
    def setUp(self):
        self.agent = object.__new__(_AgentHarness)

    def test_uses_final_channel_and_discards_thought_channel(self):
        response = (
            "<|channel|>thought\n"
            "I considered {not: valid JSON}.\n"
            "<|channel|>final\n"
            '{"code_after": "return safe_response"}'
        )
        self.assertEqual(
            self.agent._parse_conclusion(response),
            {"code_after": "return safe_response"},
        )

    def test_rejects_non_json_response(self):
        result = self.agent._parse_conclusion("I cannot provide the requested format.")
        self.assertIn("_parse_error", result)

    def test_unwraps_a_targeted_fix_from_a_fixes_response(self):
        result = FixAgent._normalise_fix_candidate({
            "fixes": [{
                "code_before": "return old",
                "code_after": "return new",
                "imports_needed": [],
            }]
        })
        self.assertEqual(result["code_after"], "return new")

    def test_normalises_legacy_fixed_code_field(self):
        result = FixAgent._normalise_fix_candidate({"fixed_code": "return new"})
        self.assertEqual(result["code_after"], "return new")


if __name__ == "__main__":
    unittest.main()
