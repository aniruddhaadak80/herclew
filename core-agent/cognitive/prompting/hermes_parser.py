import re
import json
from typing import Dict, Any, Optional, Tuple

class HermesParser:
    @staticmethod
    def extract_scratchpad(text: str) -> Optional[str]:
        match = re.search(r"<SCRATCHPAD>(.*?)</SCRATCHPAD>", text, re.DOTALL | re.IGNORECASE)
        return match.group(1).strip() if match else None

    @staticmethod
    def extract_inner_monologue(text: str) -> Optional[str]:
        match = re.search(r"<INNER_MONOLOGUE>(.*?)</INNER_MONOLOGUE>", text, re.DOTALL | re.IGNORECASE)
        return match.group(1).strip() if match else None

    @staticmethod
    def parse_tool_call(text: str) -> Optional[Dict[str, Any]]:
        # JSON inside tool_call tag
        match_json = re.search(r"<tool_call>(.*?)</tool_call>", text, re.DOTALL | re.IGNORECASE)
        if match_json:
            content = match_json.group(1).strip()
            try:
                return json.loads(content)
            except json.JSONDecodeError:
                # Try simple key-value extraction or parameter matching if not strict JSON
                pass

        # XML attributes pattern: <tool_call name="xyz">...</tool_call>
        match_xml = re.search(r'<tool_call\s+name="([^"]+)"[^>]*>(.*?)</tool_call>', text, re.DOTALL | re.IGNORECASE)
        if match_xml:
            name = match_xml.group(1)
            inner_content = match_xml.group(2).strip()
            args = {}
            # Parse simple nested tags as arguments: <param>value</param>
            param_matches = re.findall(r"<([^>]+)>(.*?)</\1>", inner_content, re.DOTALL)
            for p_name, p_val in param_matches:
                args[p_name] = p_val.strip()
            return {"name": name, "arguments": args}
        
        return None

    @staticmethod
    def format_tool_response(response_id: str, content: Any) -> str:
        serialized = json.dumps(content) if not isinstance(content, str) else content
        return f'<tool_response id="{response_id}">{serialized}</tool_response>'

    @staticmethod
    def get_system_prompt() -> str:
        return (
            "You are Hermes 3, a neutrally-aligned, highly steerable and self-improving reasoning engine.\n"
            "When executing complex tasks, you MUST use the following XML tags for structured reasoning:\n"
            "1. <SCRATCHPAD>: Plan your actions, breakdown complex requests, and design code layouts.\n"
            "2. <INNER_MONOLOGUE>: Perform self-reflection, address any gaps in instructions, and sanity-check your reasoning.\n"
            "3. <tool_call>: Invoke tools using JSON format. Example:\n"
            "   <tool_call>{\"name\": \"run_command\", \"arguments\": {\"command\": \"pytest\"}}</tool_call>\n"
        )
