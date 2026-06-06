#!/usr/bin/env python3
import os

content = '''from .models import (
    AgentTask,
    ComponentType,
    Constraint,
    EditOperation,
    FileLocation,
    ProjectContext,
    ReactComponent,
    TaskResult,
    VerificationStep,
)
from .flowmusic_agent_models import FlowmusicAgentRequest, FlowmusicGenerationResponse, MistralProviderConfig

__all__ = [
    "AgentTask",
    "ComponentType",
    "Constraint",
    "EditOperation",
    "FileLocation",
    "ProjectContext",
    "ReactComponent",
    "TaskResult",
    "VerificationStep",
    "FlowmusicAgentRequest",
    "FlowmusicGenerationResponse",
    "MistralProviderConfig",
]
'''

file_path = r'd:\WORK\CLIENTS\extract\react_agent\__init__.py'
with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"File written to {file_path}")
