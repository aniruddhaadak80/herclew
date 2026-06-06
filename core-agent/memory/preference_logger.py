import os
import json
import time
from typing import Dict, Any, List

class PreferenceLogger:
    def __init__(self, log_dir: str = "memory/datasets"):
        self.log_dir = log_dir
        os.makedirs(self.log_dir, exist_ok=True)
        self.dataset_path = os.path.join(self.log_dir, "dpo_preferences.jsonl")

    def log_preference(self, prompt: str, chosen: str, rejected: str, metadata: Dict[str, Any] = None) -> None:
        record = {
            "timestamp": time.time(),
            "prompt": prompt,
            "chosen": chosen,
            "rejected": rejected,
            "metadata": metadata or {}
        }
        
        with open(self.dataset_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(record) + "\n")

    def load_dataset(self) -> List[Dict[str, Any]]:
        dataset = []
        if not os.path.exists(self.dataset_path):
            return dataset
        
        with open(self.dataset_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip():
                    dataset.append(json.loads(line))
        return dataset
