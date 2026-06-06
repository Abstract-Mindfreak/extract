from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .flowmusic_agent_models import FlowmusicAgentRequest
from .flowmusic_agent_service import FlowmusicAgentService

app = FastAPI(title="Flowmusic Multi-Agent Service", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = FlowmusicAgentService()


@app.get("/health")
async def health() -> dict:
    try:
        return await service.get_health()
    except Exception as error:
        raise HTTPException(status_code=503, detail=str(error)) from error


@app.post("/generate-flowmusic")
async def generate_flowmusic(request: FlowmusicAgentRequest) -> dict:
    try:
        result = await service.generate(request)
        return result.model_dump(mode="json")
    except Exception as error:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/archives/tracks")
async def get_archive_tracks() -> dict:
    try:
        return await service.get_archive_tracks()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/archives/sessions")
async def get_archive_sessions() -> dict:
    try:
        return await service.get_archive_sessions()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/library/catalog")
async def get_library_catalog() -> dict:
    try:
        return await service.get_library_catalog()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error


@app.get("/library/blocks")
async def get_library_blocks() -> dict:
    try:
        return await service.get_library_blocks()
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error
