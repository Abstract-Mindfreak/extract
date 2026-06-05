"""
Pydantic models for an agent that operates on react/my-app/.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ComponentType(str, Enum):
    FUNCTIONAL = "functional"
    HOOK = "hook"
    LAYOUT = "layout"
    PAGE = "page"
    PANEL = "panel"
    STORE = "store"
    UTILITY = "utility"


class FileLocation(BaseModel):
    path: str = Field(..., description="Path relative to extract root, e.g. react/my-app/src/App.js")
    line_start: Optional[int] = Field(None, description="1-based start line if known")
    line_end: Optional[int] = Field(None, description="1-based end line if known")


class ReactComponent(BaseModel):
    name: str = Field(..., description="Component or hook name")
    type: ComponentType = Field(..., description="Kind of React/runtime artifact")
    file_path: str = Field(..., description="Primary file path relative to extract root")
    description: Optional[str] = Field(None, description="Short description of the artifact")
    dependencies: List[str] = Field(default_factory=list, description="Direct dependencies or imports")
    props: Dict[str, Any] = Field(default_factory=dict, description="Known props or public API")


class EditOperation(BaseModel):
    file_path: str = Field(..., description="File to edit relative to extract root")
    operation: Literal["create", "replace", "insert", "delete", "refactor"] = Field(
        ..., description="Type of change"
    )
    description: str = Field(..., description="Human-readable purpose of the edit")
    search_string: Optional[str] = Field(None, description="Anchor text for replace/insert operations")
    new_string: Optional[str] = Field(None, description="Suggested replacement or inserted content")


class VerificationStep(BaseModel):
    kind: Literal["build", "lint", "manual", "test"] = Field(..., description="Verification type")
    command: Optional[str] = Field(None, description="Command to run when applicable")
    description: str = Field(..., description="What this verification checks")
    expected_result: Optional[str] = Field(None, description="Expected outcome")


class Constraint(BaseModel):
    kind: Literal["path_scope", "architecture", "dependency", "ui_behavior", "git_safety"] = Field(
        ..., description="Constraint category"
    )
    value: str = Field(..., description="Constraint text")


class AgentTask(BaseModel):
    task_id: str = Field(..., description="Unique task identifier")
    task_type: Literal[
        "create_component",
        "edit_component",
        "add_feature",
        "fix_bug",
        "refactor",
        "workspace_integration",
        "audio_fix",
    ] = Field(..., description="Task category")
    description: str = Field(..., description="Precise task statement")
    target_files: List[str] = Field(default_factory=list, description="Primary files expected to change")
    target_components: List[str] = Field(default_factory=list, description="Named components, hooks, or panels")
    acceptance_criteria: List[str] = Field(default_factory=list, description="Concrete definition of done")
    constraints: List[Constraint] = Field(default_factory=list, description="Implementation constraints")
    suggested_edits: List[EditOperation] = Field(default_factory=list, description="Optional preplanned edits")
    verification: List[VerificationStep] = Field(default_factory=list, description="Validation steps")
    context: Dict[str, Any] = Field(default_factory=dict, description="Additional task context")


class TaskResult(BaseModel):
    status: Literal["success", "partial", "failed"] = Field(..., description="Execution status")
    summary: str = Field(..., description="Short result summary")
    touched_files: List[str] = Field(default_factory=list, description="Files changed during execution")
    completed_edits: List[EditOperation] = Field(default_factory=list, description="Edits that were applied")
    verification_run: List[VerificationStep] = Field(default_factory=list, description="Verification that was run")
    warnings: List[str] = Field(default_factory=list, description="Residual risks or non-blocking issues")
    errors: List[str] = Field(default_factory=list, description="Blocking problems if any")
    next_steps: List[str] = Field(default_factory=list, description="Reasonable follow-up actions")


class ProjectContext(BaseModel):
    project_root: str = Field(..., description="Absolute path to extract root")
    app_root: str = Field(..., description="Absolute path to react/my-app")
    main_entry_file: str = Field(..., description="Primary app entry file")
    workspace_files: List[str] = Field(default_factory=list, description="Known flexlayout-related files")
    notes: List[str] = Field(default_factory=list, description="Project facts relevant to the agent")
