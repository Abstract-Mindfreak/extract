# React Agent

Minimal Pydantic-backed agent kit for tasks against `react/my-app/`.

## Files
- `AGENT_PROMPT.md` - operating prompt for the agent
- `models.py` - Pydantic task and response schema
- `requirements.txt` - Python runtime dependencies for the local agent service
- `example_task.json` - example task payload
- `__init__.py` - package entrypoint

## Intended use
1. Load `AGENT_PROMPT.md` into the agent system prompt
2. Validate incoming task payloads with `AgentTask` from `models.py`
3. Execute repository changes inside `react/my-app/`
4. Return `TaskResult`

## Flowmusic multi-agent service
The importable package `react_agent/` also exposes a local FastAPI service for coordinated
Flowmusic JSON generation with Ollama:

```bash
d:\WORK\CLIENTS\extract\venv\Scripts\python.exe -m uvicorn react_agent.flowmusic_agent_server:app --reload --port 8766 --app-dir d:\WORK\CLIENTS\extract
```

Default model target: `gemma3:4b` via local Ollama at `http://127.0.0.1:11434/api`.
If you specifically want "Gemma 4", note that the current Ollama library target wired here is
the official `gemma3` family, because no official `gemma4` Ollama library entry was detected.

## Example
```python
from react_agent import AgentTask, TaskResult

task = AgentTask.model_validate_json(open("react-agent/example_task.json", "r", encoding="utf-8").read())
print(task.task_type, task.description)
```
