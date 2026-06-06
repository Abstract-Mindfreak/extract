import os
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from extract_agent.orchestrator import MistralAgentOrchestrator

app = FastAPI(title="Extract Data Agent API", version="1.0.0")

MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "mock-key-if-testing")
orchestrator = MistralAgentOrchestrator(api_key=MISTRAL_API_KEY)

class UserPromptRequest(BaseModel):
    prompt: str

@app.post("/api/v1/agent/run")
async def run_agent_command(request: UserPromptRequest):
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Запрос пользователя не может быть пустым.")
    
    try:
        result = orchestrator.generate_agent_decision(request.prompt)
        return result
    except ValueError as val_err:
        raise HTTPException(status_code=422, detail=str(val_err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Внутренняя ошибка сервера при работе агента: {str(err)}")
