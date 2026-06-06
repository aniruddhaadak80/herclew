import pytest
from event_stream import EventStream, Event
from cognitive.prompting.hermes_parser import HermesParser
from sandbox.docker_runtime import DockerSandbox

def test_event_stream():
    stream = EventStream()
    received_events = []
    
    def on_event(event):
        received_events.append(event)
        
    stream.subscribe(on_event, event_types=["action"])
    
    # Publish match type
    evt1 = Event(name="test_action", source="agent", event_type="action", payload={"cmd": "ls"})
    stream.publish(evt1)
    
    # Publish non-match type
    evt2 = Event(name="test_observation", source="environment", event_type="observation", payload={"result": "ok"})
    stream.publish(evt2)
    
    assert len(received_events) == 1
    assert received_events[0].name == "test_action"

def test_hermes_parser():
    sample_text = (
        "<SCRATCHPAD>Create a plan to fix the database.</SCRATCHPAD>\n"
        "<INNER_MONOLOGUE>I must be careful about SQL injection here.</INNER_MONOLOGUE>\n"
        "<tool_call>{\"name\": \"run_tests\", \"arguments\": {\"path\": \"tests/\"}}</tool_call>"
    )
    
    scratch = HermesParser.extract_scratchpad(sample_text)
    monologue = HermesParser.extract_inner_monologue(sample_text)
    tool = HermesParser.parse_tool_call(sample_text)
    
    assert scratch == "Create a plan to fix the database."
    assert monologue == "I must be careful about SQL injection here."
    assert tool is not None
    assert tool["name"] == "run_tests"
    assert tool["arguments"]["path"] == "tests/"

def test_docker_sandbox_fallback():
    sandbox = DockerSandbox(container_name="test-herclew-sandbox-temp")
    # We test the execute_command function. If docker is not available, it should fallback to local execution safely.
    code, output = sandbox.execute_command("echo hello_world")
    assert code == 0
    assert "hello_world" in output
