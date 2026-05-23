class CoderAgent:
    def __init__(self, context: str):
        self.context = context
        self.history = []

    def process_message(self, message: str) -> str:
        self.history.append({"role": "user", "content": message})
        # Mock logic for the coder agent
        response = f"[Coder Agent] I understand the context: '{self.context}'. I will generate the code for: {message}"
        self.history.append({"role": "assistant", "content": response})
        return response
