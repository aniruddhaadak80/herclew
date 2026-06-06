import time
import json
import uuid
from typing import Dict, Any, List, Callable

class Event:
    def __init__(self, name: str, source: str, event_type: str, payload: Dict[str, Any]):
        self.id = str(uuid.uuid4())
        self.timestamp = time.time()
        self.name = name
        self.source = source
        self.event_type = event_type
        self.payload = payload

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timestamp": self.timestamp,
            "name": self.name,
            "source": self.source,
            "event_type": self.event_type,
            "payload": self.payload
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Event':
        event = cls(
            name=data["name"],
            source=data["source"],
            event_type=data["event_type"],
            payload=data["payload"]
        )
        event.id = data["id"]
        event.timestamp = data["timestamp"]
        return event

class EventStream:
    def __init__(self):
        self.events: List[Event] = []
        self.subscribers: List[Dict[str, Any]] = []

    def publish(self, event: Event) -> None:
        self.events.append(event)
        for sub in self.subscribers:
            event_types = sub.get("event_types")
            if not event_types or event.event_type in event_types:
                sub["callback"](event)

    def subscribe(self, callback: Callable[[Event], None], event_types: List[str] = None) -> str:
        sub_id = str(uuid.uuid4())
        self.subscribers.append({
            "id": sub_id,
            "callback": callback,
            "event_types": event_types
        })
        return sub_id

    def unsubscribe(self, sub_id: str) -> None:
        self.subscribers = [s for s in self.subscribers if s["id"] != sub_id]

    def get_history(self) -> List[Dict[str, Any]]:
        return [e.to_dict() for e in self.events]

    def save_to_json(self, file_path: str) -> None:
        with open(file_path, "w") as f:
            json.dump(self.get_history(), f, indent=2)

    def load_from_json(self, file_path: str) -> None:
        try:
            with open(file_path, "r") as f:
                data = json.load(f)
                self.events = [Event.from_dict(d) for d in data]
        except FileNotFoundError:
            self.events = []
