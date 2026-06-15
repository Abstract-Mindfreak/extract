from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, Field, model_validator


class MistralProviderConfig(BaseModel):
    provider: Literal["mistral"] = "mistral"
    base_url: str = Field(default="https://api.mistral.ai/v1")
    model: str = Field(default="mistral-large-latest")
    temperature: float = Field(default=0.35, ge=0.0, le=2.0)
    timeout_seconds: float = Field(default=120.0, ge=5.0, le=600.0)


class OllamaProviderConfig(BaseModel):
    provider: Literal["ollama"] = "ollama"
    base_url: str = Field(default="http://localhost:3456/api/ollama/generate")
    model: str = Field(default="gemma2b-mmss-dense")
    temperature: float = Field(default=0.2, ge=0.0, le=2.0)
    timeout_seconds: float = Field(default=600.0, ge=5.0, le=900.0)
    enable_db: bool = Field(default=True)


class FlowmusicAgentRequest(BaseModel):
    intent: str = Field(default="", description="Main generation brief")
    title_hint: str | None = Field(default=None)
    genres: list[str] = Field(default_factory=list)
    moods: list[str] = Field(default_factory=list)
    sonic_focus: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)
    negative_constraints: list[str] = Field(default_factory=list)
    output_language: str = Field(default="en")
    include_library_context: bool = Field(default=True)
    library_limit: int = Field(default=6, ge=0, le=12)
    provider: Annotated[MistralProviderConfig | OllamaProviderConfig, Field(discriminator="provider")] = Field(default_factory=MistralProviderConfig)

    @model_validator(mode="after")
    def validate_minimum_input(self) -> "FlowmusicAgentRequest":
        signal_fields = [
            self.intent,
            self.title_hint or "",
            " ".join(self.genres),
            " ".join(self.moods),
            " ".join(self.sonic_focus),
            " ".join(self.constraints),
            " ".join(self.negative_constraints),
        ]
        if not any(str(value).strip() for value in signal_fields):
            raise ValueError(
                "At least one of intent, title_hint, genres, moods, sonic_focus, constraints, or negative_constraints must be provided"
            )
        return self


class ContextBlockSummary(BaseModel):
    id: str
    name: str
    category: str | None = None
    tags: list[str] = Field(default_factory=list)
    score: float = 0.0
    excerpt: str = ""


class PlannerOutput(BaseModel):
    title: str
    retrieval_queries: list[str] = Field(default_factory=list)
    style_tags: list[str] = Field(default_factory=list)
    sonic_targets: list[str] = Field(default_factory=list)
    structure_outline: list[str] = Field(default_factory=list)
    risks: list[str] = Field(default_factory=list)
    production_notes: list[str] = Field(default_factory=list)


class FlowmusicSection(BaseModel):
    label: str
    purpose: str
    prompt_fragment: str


class ComposerOutput(BaseModel):
    title: str
    prompt: str
    negative_prompt: str = ""
    style_tags: list[str] = Field(default_factory=list)
    sections: list[FlowmusicSection] = Field(default_factory=list)
    production_notes: list[str] = Field(default_factory=list)
    vocal_notes: list[str] = Field(default_factory=list)
    arrangement_notes: list[str] = Field(default_factory=list)
    bpm_hint: int | None = Field(default=None, ge=40, le=240)
    key_hint: str | None = None
    energy_curve: list[str] = Field(default_factory=list)
    seed_terms: list[str] = Field(default_factory=list)


class CriticOutput(BaseModel):
    approved: bool
    confidence: float = Field(ge=0.0, le=1.0)
    strengths: list[str] = Field(default_factory=list)
    issues: list[str] = Field(default_factory=list)
    revision_instructions: list[str] = Field(default_factory=list)


class NormalizerOutput(BaseModel):
    title: str
    prompt: str
    negative_prompt: str = ""
    style_tags: list[str] = Field(default_factory=list)
    sections: list[FlowmusicSection] = Field(default_factory=list)
    production_notes: list[str] = Field(default_factory=list)
    vocal_notes: list[str] = Field(default_factory=list)
    arrangement_notes: list[str] = Field(default_factory=list)
    bpm_hint: int | None = Field(default=None, ge=40, le=240)
    key_hint: str | None = None
    energy_curve: list[str] = Field(default_factory=list)
    seed_terms: list[str] = Field(default_factory=list)
    final_checks: list[str] = Field(default_factory=list)


class AgentPassTrace(BaseModel):
    agent: Literal["planner", "composer", "critic", "normalizer"]
    model: str
    status: Literal["ok", "fallback", "error"]
    summary: str
    payload: dict
    tools_used: list[str] = Field(default_factory=list)


class FlowmusicPromptPayload(BaseModel):
    title: str
    prompt: str
    negative_prompt: str = ""
    style_tags: list[str] = Field(default_factory=list)
    genres: list[str] = Field(default_factory=list)
    moods: list[str] = Field(default_factory=list)
    sonic_focus: list[str] = Field(default_factory=list)
    sections: list[FlowmusicSection] = Field(default_factory=list)
    production_notes: list[str] = Field(default_factory=list)
    vocal_notes: list[str] = Field(default_factory=list)
    arrangement_notes: list[str] = Field(default_factory=list)
    bpm_hint: int | None = None
    key_hint: str | None = None
    energy_curve: list[str] = Field(default_factory=list)
    seed_terms: list[str] = Field(default_factory=list)
    source_blocks: list[str] = Field(default_factory=list)
    source_block_ids: list[str] = Field(default_factory=list)
    generated_by: dict = Field(default_factory=dict)


class FlowmusicGenerationResponse(BaseModel):
    ok: bool = True
    provider: str
    model: str
    request: FlowmusicAgentRequest
    context_blocks: list[ContextBlockSummary] = Field(default_factory=list)
    archive_tracks: list[dict] = Field(default_factory=list)
    traces: list[AgentPassTrace] = Field(default_factory=list)
    final_payload: FlowmusicPromptPayload
    library_block: dict
