import os
import shutil
import pytest
from pydantic import BaseModel
from cognitive.structured_executor import StructuredExecutor
from memory.preference_logger import PreferenceLogger

class SimpleModel(BaseModel):
    name: str
    score: int

def test_structured_executor():
    executor = StructuredExecutor()
    raw_json = '{"name": "agent_test", "score": 99}'
    
    success, validated, err = executor.validate_json(raw_json, SimpleModel)
    assert success is True
    assert validated.name == "agent_test"
    assert validated.score == 99

    # Test invalid json repair
    raw_invalid = '{"name": "agent_test", "score": 99' # missing close brace
    repaired = executor.repair_json_output(raw_invalid, SimpleModel, "Missing closing brace")
    assert repaired is not None
    assert repaired.name == "agent_test"

def test_preference_logger():
    temp_dir = "tests/temp_datasets_dir"
    logger = PreferenceLogger(log_dir=temp_dir)
    
    prompt = "Write a hello world function."
    chosen = "def hello():\n    print('hello world')"
    rejected = "def hello(): print('hello')"
    
    logger.log_preference(prompt, chosen, rejected, {"task_id": "test_1"})
    
    dataset = logger.load_dataset()
    assert len(dataset) == 1
    assert dataset[0]["prompt"] == prompt
    assert dataset[0]["chosen"] == chosen
    assert dataset[0]["rejected"] == rejected
    assert dataset[0]["metadata"]["task_id"] == "test_1"
    
    # Cleanup temp directory
    shutil.rmtree(temp_dir, ignore_errors=True)
