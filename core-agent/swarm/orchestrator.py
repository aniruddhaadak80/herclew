import uuid
import logging
from typing import Dict, Any, Callable

logger = logging.getLogger(__name__)

class SwarmOrchestrator:
    def __init__(self, main_agent):
        self.main_agent = main_agent
        self.active_agents: Dict[str, Any] = {}
        self.agent_types: Dict[str, Callable] = {}

    def register_agent_type(self, name: str, factory: Callable):
        self.agent_types[name] = factory
        logger.info(f"Registered swarm agent type: {name}")

    def spawn_agent(self, agent_type: str, context: str) -> str:
        if agent_type not in self.agent_types:
            raise ValueError(f"Unknown agent type: {agent_type}")
        
        agent_id = str(uuid.uuid4())
        agent_instance = self.agent_types[agent_type](context)
        self.active_agents[agent_id] = agent_instance
        logger.info(f"Spawned {agent_type} agent with ID: {agent_id}")
        return agent_id

    def communicate(self, agent_id: str, message: str) -> str:
        if agent_id not in self.active_agents:
            raise ValueError(f"Agent {agent_id} not found.")
        
        agent = self.active_agents[agent_id]
        return agent.process_message(message)
