class ResearcherAgent:
    def __init__(self, context: str):
        self.context = context
        self.history = []

    def process_message(self, message: str) -> str:
        self.history.append({"role": "user", "content": message})
        # Mock logic for the researcher agent
        response = f"[Researcher Agent] Based on context '{self.context}', my research findings for '{message}' are..."
        self.history.append({"role": "assistant", "content": response})
        return response
