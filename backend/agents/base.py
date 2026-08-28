import json
import re
import uuid
from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List
from openai import AsyncOpenAI
from loguru import logger

from backend.core.config import get_settings
from backend.core.websocket_manager import ws_manager
from backend.db.models import AgentStep

import ast

settings = get_settings()

def robust_json_loads(s: str) -> dict:
    s = s.strip()
    try:
        return json.loads(s, strict=False)
    except Exception:
        pass

    try:
        val = ast.literal_eval(s)
        if isinstance(val, dict):
            return val
    except Exception:
        pass

    try:
        cleaned = s.replace("True", "true").replace("False", "false").replace("None", "null")
        return json.loads(cleaned, strict=False)
    except Exception:
        pass
        
    try:
        pythonified = s.replace("true", "True").replace("false", "False").replace("null", "None")
        val = ast.literal_eval(pythonified)
        if isinstance(val, dict):
            return val
    except Exception:
        pass

    raise ValueError(f"Could not parse JSON. Snippet: {s[:200]}")


class Tool:
    def __init__(self, name: str, description: str, parameters: dict, func: Callable):
        self.name = name
        self.description = description
        self.parameters = parameters
        self.func = func

    def to_schema(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class BaseAgent(ABC):
    name: str = "base"
    system_prompt: str = ""

    def __init__(self, db_session=None, session_id: str = None):
        self.db = db_session
        self.session_id = session_id
        self.client = AsyncOpenAI(
            api_key=settings.gemma_api_key,
            base_url=settings.gemma_base_url,
            timeout=60.0,
        )
        self._tools: Dict[str, Tool] = {}
        # Tunable per-agent budgets to control token usage.
        self.max_iterations = 12
        self.max_tokens_per_call = 2048

    def register_tool(self, tool: Tool):
        self._tools[tool.name] = tool

    async def run(self, task: str, context: dict = None) -> dict:
        logger.info(f"[{self.name}] Starting: {task[:60]}...")
        messages = self._build_messages(task, context)
        max_iterations = self.max_iterations

        for i in range(max_iterations):
            try:
                response = await self._call_gemma(messages)
            except Exception as exc:
                logger.error(f"[{self.name}] LLM execution failed after retries: {exc}")
                return {
                    "status": "error",
                    "_parse_error": f"LLM call failed in {self.name}: {exc}",
                }

            message = response.choices[0].message
            raw_content = message.content or ""
            content = self._extract_final_content(raw_content)

            # Do not persist or stream raw model reasoning.
            if raw_content:
                await self._log("model_output", "Structured model response received.")

            if message.tool_calls:
                # Sanitize tool call arguments before adding to history.
                sanitized_tool_calls = []
                for tc in message.tool_calls:
                    try:
                        parsed = robust_json_loads(tc.function.arguments)
                        clean_args = json.dumps(parsed)
                    except Exception:
                        logger.warning(
                            f"[{self.name}] Sanitizing malformed tool args for "
                            f"{tc.function.name}: {tc.function.arguments[:120]}"
                        )
                        clean_args = json.dumps({
                            "error": "malformed_arguments",
                            "raw_snippet": tc.function.arguments[:200],
                        })
                    sanitized_tool_calls.append({
                        "id": tc.id,
                        "type": "function",
                        "function": {
                            "name": tc.function.name,
                            "arguments": clean_args,
                        },
                    })

                messages.append({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": sanitized_tool_calls,
                })

                for tc in message.tool_calls:
                    try:
                        args = robust_json_loads(tc.function.arguments)
                        result = await self._execute_tool(tc.function.name, args)
                    except Exception as e:
                        logger.error(f"[{self.name}] Failed to parse/execute tool {tc.function.name}: {e}")
                        result = {"error": f"Failed to parse tool arguments or execute tool: {e}"}

                    result_str = json.dumps(result)
                    MAX_TOOL_RESULT_CHARS = 8000
                    if len(result_str) > MAX_TOOL_RESULT_CHARS:
                        result_str = result_str[:MAX_TOOL_RESULT_CHARS] + '..."}'

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": result_str,
                    })
                continue

            # No tool calls = conclusion
            conclusion = self._parse_conclusion(content)
            if conclusion.get("_parse_error"):
                logger.warning(f"[{self.name}] Invalid structured response; requesting a JSON-only retry.")
                messages.extend([
                    {"role": "assistant", "content": content},
                    {
                        "role": "user",
                        "content": (
                            "Your previous response was not a valid JSON object. "
                            "Return only the requested JSON object, with no reasoning, "
                            "thought blocks, Markdown fences, or surrounding text."
                        ),
                    },
                ])
                continue

            await self._log("conclusion", "Structured response parsed successfully.")
            logger.info(f"[{self.name}] Done in {i+1} iterations.")
            return conclusion

        return {
            "status": "invalid_model_output",
            "_parse_error": "The model did not return valid JSON within the retry budget.",
        }

    async def _call_gemma(self, messages: List[dict]):
        tools = [t.to_schema() for t in self._tools.values()]
        approx_chars = self._estimate_message_chars(messages)
        logger.info(
            f"[{self.name}] Gemma call budget: ~{approx_chars} prompt chars, "
            f"max_tokens={self.max_tokens_per_call}, tools={len(tools)}"
        )
        kwargs = {
            "model": settings.gemma_model,
            "messages": messages,
            "max_tokens": self.max_tokens_per_call,
            "extra_body": {
                "extra_body": {
                    "google": {
                        "thinking_config": {
                            "thinking_level": settings.gemma_thinking_level,
                            "include_thoughts": False,
                        }
                    }
                },
            },
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        import asyncio as _asyncio
        import re as _re

        max_retries = 3
        for attempt in range(max_retries + 1):
            try:
                response = await self.client.chat.completions.create(**kwargs)
                if hasattr(response, "usage") and response.usage:
                    u = response.usage
                    logger.info(
                        f"[{self.name}] Token usage: "
                        f"prompt={u.prompt_tokens}, completion={u.completion_tokens}, "
                        f"total={u.total_tokens}"
                    )
                return response
            except Exception as e:
                err_str = str(e)
                # 1. Handle Rate Limiting (429)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str:
                    wait = 60
                    delay_match = _re.search(r"retry in (\d+(?:\.\d+)?)s", err_str, _re.IGNORECASE)
                    if delay_match:
                        wait = int(float(delay_match.group(1))) + 2
                    else:
                        wait = 30 * (attempt + 1)

                    if attempt < max_retries:
                        logger.warning(
                            f"[{self.name}] Rate limited (429). "
                            f"Waiting {wait}s before retry {attempt + 1}/{max_retries}..."
                        )
                        await _asyncio.sleep(wait)
                        continue
                    raise

                # 2. Handle transient 5xx server errors, timeouts, and connection errors
                is_transient = any(
                    code in err_str
                    for code in ("500", "502", "503", "504", "timeout", "ConnectionError", "ConnectError")
                )
                if is_transient and attempt < max_retries:
                    backoff = (2 ** attempt) + 1  # 2s, 3s, 5s
                    logger.warning(
                        f"[{self.name}] Transient LLM error ({err_str[:100]}). "
                        f"Retrying in {backoff}s ({attempt + 1}/{max_retries})..."
                    )
                    await _asyncio.sleep(backoff)
                    continue

                raise

    def _estimate_message_chars(self, messages: List[dict]) -> int:
        total = 0
        for msg in messages:
            content = msg.get("content", "")
            if isinstance(content, str):
                total += len(content)
            elif isinstance(content, list):
                total += len(json.dumps(content))
            tool_calls = msg.get("tool_calls")
            if tool_calls:
                total += len(json.dumps(tool_calls))
        return total

    async def _execute_tool(self, tool_name: str, arguments: dict) -> Any:
        await self._log("tool_call", f"Calling: {tool_name}", tool_name=tool_name, tool_input=arguments)
        tool = self._tools.get(tool_name)
        if not tool:
            result = {"error": f"Unknown tool: {tool_name}"}
        else:
            try:
                result = await tool.func(**arguments)
            except Exception as e:
                result = {"error": str(e)}
                logger.error(f"[{self.name}] Tool {tool_name} failed: {e}")
        await self._log("observation", f"Result: {str(result)[:300]}", tool_name=tool_name, tool_output=result)
        return result

    async def _log(self, step_type: str, content: str,
                   tool_name: str = None, tool_input: dict = None, tool_output=None):
        # Stream to frontend
        await ws_manager.emit_agent_step(
            session_id=self.session_id or "system",
            agent=self.name,
            step_type=step_type,
            content=content,
            tool_name=tool_name,
            tool_output=tool_output,
        )
        # Persist to DB
        if self.db and self.session_id:
            step = AgentStep(
                id=str(uuid.uuid4()),
                session_id=self.session_id,
                agent=self.name,
                step_type=step_type,
                content=content,
                tool_name=tool_name,
                tool_input=tool_input,
                tool_output=tool_output if isinstance(tool_output, (dict, list)) else None,
            )
            self.db.add(step)
            await self.db.flush()

    def _build_messages(self, task: str, context: dict = None) -> List[dict]:
        system = self.system_prompt
        if context:
            system += f"\n\nContext:\n{json.dumps(context, indent=2)}"
        return [
            {"role": "system", "content": system},
            {"role": "user", "content": task},
        ]

    def _parse_conclusion(self, content: str) -> dict:
        if not content:
            return {"_parse_error": "Model returned no content."}

        cleaned = self._extract_final_content(content)

        # 2. Try fenced ```json { ... } ``` block first
        fenced_match = re.search(r"```(?:json)?\s*(\{[\s\S]*?\})\s*```", cleaned, re.DOTALL)
        if fenced_match:
            try:
                return robust_json_loads(fenced_match.group(1))
            except Exception:
                pass

        # 3. Decode from every possible object start. This avoids treating a
        # brace in explanatory text as part of the final JSON object.
        decoder = json.JSONDecoder(strict=False)
        for match in re.finditer(r"\{", cleaned):
            try:
                value, _ = decoder.raw_decode(cleaned[match.start():])
                if isinstance(value, dict):
                    return value
            except Exception:
                pass

        return {"_parse_error": "Model response did not contain a valid JSON object."}

    @staticmethod
    def _extract_final_content(content: str) -> str:
        """Return Gemma's final channel, never its reasoning channel."""
        if not content:
            return ""

        # Hosted and local Gemma responses can use either explicit XML-like
        # thought tags or Gemma's channel tokens. Prefer only the final channel.
        final_match = re.search(
            r"<\|channel\|>\s*final\s*(.*)$", content,
            flags=re.DOTALL | re.IGNORECASE,
        )
        if final_match:
            content = final_match.group(1)

        content = re.sub(r"<thought>.*?</thought>", "", content, flags=re.DOTALL | re.IGNORECASE)
        content = re.sub(
            r"<\|channel\|>\s*(?:thought|analysis)\b.*?(?=<\|channel\|>|$)",
            "",
            content,
            flags=re.DOTALL | re.IGNORECASE,
        )
        return content.strip()

    @abstractmethod
    async def handle(self, *args, **kwargs) -> dict:
        pass
