@echo off
d:\WORK\CLIENTS\extract\venv\Scripts\python.exe -m uvicorn react_agent.flowmusic_agent_server:app --reload --port 8766 --app-dir d:\WORK\CLIENTS\extract
pause
