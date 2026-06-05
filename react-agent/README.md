# React Agent

Minimal Pydantic-backed agent kit for tasks against `react/my-app/`.

## Files
- `AGENT_PROMPT.md` - operating prompt for the agent
- `models.py` - Pydantic task and response schema
- `example_task.json` - example task payload
- `__init__.py` - package entrypoint

## Intended use
1. Load `AGENT_PROMPT.md` into the agent system prompt
2. Validate incoming task payloads with `AgentTask` from `models.py`
3. Execute repository changes inside `react/my-app/`
4. Return `TaskResult`

## Example
```python
from react_agent import AgentTask, TaskResult

task = AgentTask.model_validate_json(open("react-agent/example_task.json", "r", encoding="utf-8").read())
print(task.task_type, task.description)
```
