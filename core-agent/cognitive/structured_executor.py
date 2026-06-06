import json
from typing import Dict, Any, Type, Optional, Tuple
from pydantic import BaseModel, ValidationError

class StructuredExecutor:
    def __init__(self, model_client: Any = None):
        self.model_client = model_client

    def validate_json(self, raw_text: str, schema: Type[BaseModel]) -> Tuple[bool, Optional[BaseModel], str]:
        # Clean text to extract outer JSON object
        clean_text = raw_text.strip()
        if not (clean_text.startswith("{") or clean_text.startswith("[")):
            # Try to extract using regex
            import re
            match = re.search(r"(\{.*\}|\[.*\])", clean_text, re.DOTALL)
            if match:
                clean_text = match.group(1)
        
        try:
            parsed = json.loads(clean_text)
            validated = schema.model_validate(parsed) if hasattr(schema, "model_validate") else schema.parse_obj(parsed)
            return True, validated, ""
        except json.JSONDecodeError as je:
            return False, None, f"JSON Decode Error: {str(je)}"
        except ValidationError as ve:
            return False, None, f"Schema Validation Error: {str(ve)}"

    def repair_json_output(self, raw_text: str, schema: Type[BaseModel], error_msg: str) -> Optional[BaseModel]:
        # In a real agent setup, we would query the LLM to fix this output.
        # Here we implement a mock repair parser that attempts to fix quotes and brackets,
        # plus logs the error details.
        print(f"Repairing JSON due to: {error_msg}")
        try:
            # Simple balancing of curly braces as a heuristic
            cleaned = raw_text.strip()
            if not cleaned.endswith("}"):
                cleaned += "}"
            parsed = json.loads(cleaned)
            return schema.model_validate(parsed) if hasattr(schema, "model_validate") else schema.parse_obj(parsed)
        except Exception:
            return None
