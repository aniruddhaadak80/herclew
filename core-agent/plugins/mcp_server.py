import sys
import json
from typing import Dict, Any, Callable

class MCPServer:
    def __init__(self):
        self.tools: Dict[str, Dict[str, Any]] = {}
        self.tool_handlers: Dict[str, Callable] = {}

    def register_tool(self, name: str, description: str, input_schema: Dict[str, Any], handler: Callable) -> None:
        self.tools[name] = {
            "name": name,
            "description": description,
            "inputSchema": input_schema
        }
        self.tool_handlers[name] = handler

    def run(self) -> None:
        """Standard Input/Output loop for MCP JSON-RPC protocol."""
        for line in sys.stdin:
            if not line.strip():
                continue
            try:
                request = json.loads(line)
                response = self.handle_rpc(request)
                if response:
                    print(json.dumps(response))
                    sys.stdout.flush()
            except Exception as e:
                err_resp = {
                    "jsonrpc": "2.0",
                    "error": {"code": -32603, "message": str(e)},
                    "id": None
                }
                print(json.dumps(err_resp))
                sys.stdout.flush()

    def handle_rpc(self, request: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        method = request.get("method")
        req_id = request.get("id")
        params = request.get("params", {})

        if not req_id:
            return None # Notifications aren't responded to

        if method == "initialize":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {"tools": {}},
                    "serverInfo": {"name": "herclew-mcp-server", "version": "1.0.0"}
                }
            }

        elif method == "tools/list":
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "tools": list(self.tools.values())
                }
            }

        elif method == "tools/call":
            name = params.get("name")
            arguments = params.get("arguments", {})
            if name in self.tool_handlers:
                try:
                    result = self.tool_handlers[name](**arguments)
                    return {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "content": [{"type": "text", "text": str(result)}]
                        }
                    }
                except Exception as e:
                    return {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32602, "message": f"Error running tool: {str(e)}"}
                    }
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {"code": -32601, "message": f"Tool '{name}' not found."}
            }

        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {"code": -32601, "message": f"Method '{method}' not found."}
        }
