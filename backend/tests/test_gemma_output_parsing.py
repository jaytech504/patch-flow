import unittest

from backend.agents.base import BaseAgent


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


if __name__ == "__main__":
    unittest.main()
