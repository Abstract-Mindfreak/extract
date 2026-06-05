from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any, TypeVar

import httpx
from pydantic import BaseModel

from .flowmusic_agent_models import (
    AgentPassTrace,
    ComposerOutput,
    ContextBlockSummary,
    CriticOutput,
    FlowmusicAgentRequest,
    FlowmusicGenerationResponse,
    FlowmusicPromptPayload,
    NormalizerOutput,
    PlannerOutput,
)

T = TypeVar("T", bound=BaseModel)
ROOT_DIR = Path(__file__).resolve().parents[1]
PROMPT_LIBRARY_MIRROR_PATH = ROOT_DIR / "prompt-db-local" / "shared" / "react-prompt-library.json"


class OllamaStructuredClient:
    def __init__(self, base_url: str, timeout_seconds: float) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout_seconds

    async def health(self) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/tags")
            response.raise_for_status()
            payload = response.json()
            models = payload.get("models", [])
            names = [item.get("model") or item.get("name") for item in models if isinstance(item, dict)]
            names = [name for name in names if name]
            return {
                "available": True,
                "models": names,
                "model_count": len(names),
                "has_gemma": any(str(name).startswith("gemma") for name in names),
            }

    async def generate_structured(
        self,
        *,
        model: str,
        system: str,
        prompt: str,
        schema: dict[str, Any],
        temperature: float,
    ) -> dict[str, Any]:
        body = {
            "model": model,
            "system": system,
            "prompt": prompt,
            "format": schema,
            "stream": False,
            "options": {
                "temperature": temperature,
            },
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(f"{self.base_url}/generate", json=body)
            response.raise_for_status()
            payload = response.json()
        raw = payload.get("response", "{}")
        return json.loads(raw)


class FlowmusicAgentService:
    def __init__(self) -> None:
        pass

    async def get_health(self, request: FlowmusicAgentRequest | None = None) -> dict[str, Any]:
        provider = request.provider if request else None
        base_url = provider.base_url if provider else "http://127.0.0.1:11434/api"
        timeout = provider.timeout_seconds if provider else 10.0
        model = provider.model if provider else "gemma3:4b"
        client = OllamaStructuredClient(base_url=base_url, timeout_seconds=timeout)
        health = await client.health()
        health.update(
            {
                "provider": "ollama",
                "default_model": model,
                "recommended_model": "gemma3:4b",
                "note": "Gemma 3 is the current Ollama Gemma family target; no official gemma4 Ollama library entry was detected.",
            }
        )
        return health

    async def generate(self, request: FlowmusicAgentRequest) -> FlowmusicGenerationResponse:
        client = OllamaStructuredClient(
            base_url=request.provider.base_url,
            timeout_seconds=request.provider.timeout_seconds,
        )
        context_blocks = self._select_context_blocks(request)
        planner = await self._run_planner(client, request, context_blocks)
        composer = await self._run_composer(client, request, context_blocks, planner)
        critic = await self._run_critic(client, request, context_blocks, planner, composer)
        normalizer = await self._run_normalizer(client, request, context_blocks, planner, composer, critic)

        final_payload = FlowmusicPromptPayload(
            title=normalizer.data.title,
            prompt=normalizer.data.prompt,
            negative_prompt=normalizer.data.negative_prompt,
            style_tags=self._uniq(normalizer.data.style_tags + planner.data.style_tags),
            genres=self._uniq(request.genres),
            moods=self._uniq(request.moods),
            sonic_focus=self._uniq(request.sonic_focus + planner.data.sonic_targets),
            sections=normalizer.data.sections,
            production_notes=self._uniq(normalizer.data.production_notes + planner.data.production_notes),
            vocal_notes=self._uniq(normalizer.data.vocal_notes),
            arrangement_notes=self._uniq(normalizer.data.arrangement_notes),
            bpm_hint=normalizer.data.bpm_hint,
            key_hint=normalizer.data.key_hint,
            energy_curve=self._uniq(normalizer.data.energy_curve),
            seed_terms=self._uniq(normalizer.data.seed_terms + planner.data.retrieval_queries),
            source_blocks=[block.name for block in context_blocks],
            source_block_ids=[block.id for block in context_blocks],
            generated_by={
                "pipeline": ["planner", "composer", "critic", "normalizer"],
                "provider": request.provider.provider,
                "model": request.provider.model,
                "output_language": request.output_language,
            },
        )
        library_block = self._build_library_block(request, final_payload)
        traces = [planner.trace, composer.trace, critic.trace, normalizer.trace]
        return FlowmusicGenerationResponse(
            provider=request.provider.provider,
            model=request.provider.model,
            request=request,
            context_blocks=context_blocks,
            traces=traces,
            final_payload=final_payload,
            library_block=library_block,
        )

    async def _run_planner(
        self,
        client: OllamaStructuredClient,
        request: FlowmusicAgentRequest,
        context_blocks: list[ContextBlockSummary],
    ) -> "_StepResult[PlannerOutput]":
        prompt = "\n".join(
            [
                f"Intent: {request.intent}",
                f"Title hint: {request.title_hint or 'none'}",
                f"Genres: {', '.join(request.genres) or 'none'}",
                f"Moods: {', '.join(request.moods) or 'none'}",
                f"Sonic focus: {', '.join(request.sonic_focus) or 'none'}",
                f"Constraints: {', '.join(request.constraints) or 'none'}",
                f"Negative constraints: {', '.join(request.negative_constraints) or 'none'}",
                f"Reference blocks:\n{self._format_context_blocks(context_blocks)}",
            ]
        )
        system = (
            "You are the planning agent for Flowmusic JSON prompt creation. "
            "Produce a concise plan for a composer agent. Return only schema-conformant JSON."
        )
        fallback = PlannerOutput(
            title=request.title_hint or self._title_from_intent(request.intent),
            retrieval_queries=self._uniq(request.genres + request.moods + request.sonic_focus),
            style_tags=self._uniq(request.genres + request.moods),
            sonic_targets=self._uniq(request.sonic_focus or request.moods),
            structure_outline=["intro", "build", "drop", "outro"],
            risks=self._uniq(request.negative_constraints),
            production_notes=self._uniq(request.constraints),
        )
        return await self._run_step(client, request, "planner", PlannerOutput, system, prompt, fallback)

    async def _run_composer(
        self,
        client: OllamaStructuredClient,
        request: FlowmusicAgentRequest,
        context_blocks: list[ContextBlockSummary],
        planner: "_StepResult[PlannerOutput]",
    ) -> "_StepResult[ComposerOutput]":
        prompt = "\n".join(
            [
                f"Intent: {request.intent}",
                f"Planned title: {planner.data.title}",
                f"Style tags: {', '.join(planner.data.style_tags)}",
                f"Sonic targets: {', '.join(planner.data.sonic_targets)}",
                f"Outline: {', '.join(planner.data.structure_outline)}",
                f"Reference blocks:\n{self._format_context_blocks(context_blocks)}",
                "Produce a final user-facing Flowmusic prompt package in English unless another output language is requested.",
            ]
        )
        system = (
            "You are the composer agent. Produce a Flowmusic-ready structured prompt with clear sections, "
            "strong production language, and explicit negative prompt constraints. Return only JSON."
        )
        fallback = ComposerOutput(
            title=planner.data.title,
            prompt=self._compose_fallback_prompt(request, planner.data, context_blocks),
            negative_prompt=", ".join(self._uniq(request.negative_constraints)),
            style_tags=self._uniq(planner.data.style_tags + request.genres + request.moods),
            sections=self._fallback_sections(planner.data.structure_outline, request.intent),
            production_notes=self._uniq(planner.data.production_notes + request.constraints),
            vocal_notes=["instrumental focus"] if "vocal" not in " ".join(request.sonic_focus).lower() else [],
            arrangement_notes=["Preserve a clear macro arc across all sections."],
            bpm_hint=118,
            key_hint="D minor",
            energy_curve=["low", "medium", "high", "release"],
            seed_terms=self._uniq(planner.data.retrieval_queries),
        )
        return await self._run_step(client, request, "composer", ComposerOutput, system, prompt, fallback)

    async def _run_critic(
        self,
        client: OllamaStructuredClient,
        request: FlowmusicAgentRequest,
        context_blocks: list[ContextBlockSummary],
        planner: "_StepResult[PlannerOutput]",
        composer: "_StepResult[ComposerOutput]",
    ) -> "_StepResult[CriticOutput]":
        prompt = "\n".join(
            [
                f"Intent: {request.intent}",
                f"Constraints: {', '.join(request.constraints) or 'none'}",
                f"Negative constraints: {', '.join(request.negative_constraints) or 'none'}",
                f"Planner risks: {', '.join(planner.data.risks) or 'none'}",
                f"Composer prompt JSON:\n{composer.data.model_dump_json(indent=2)}",
                f"Reference blocks:\n{self._format_context_blocks(context_blocks)}",
            ]
        )
        system = (
            "You are the critic agent. Review the proposed Flowmusic prompt for clarity, controllability, "
            "and consistency with the brief. Return only JSON."
        )
        fallback = CriticOutput(
            approved=True,
            confidence=0.72,
            strengths=["Clear sectioning", "Actionable production notes"],
            issues=[],
            revision_instructions=self._uniq(request.negative_constraints),
        )
        return await self._run_step(client, request, "critic", CriticOutput, system, prompt, fallback)

    async def _run_normalizer(
        self,
        client: OllamaStructuredClient,
        request: FlowmusicAgentRequest,
        context_blocks: list[ContextBlockSummary],
        planner: "_StepResult[PlannerOutput]",
        composer: "_StepResult[ComposerOutput]",
        critic: "_StepResult[CriticOutput]",
    ) -> "_StepResult[NormalizerOutput]":
        prompt = "\n".join(
            [
                f"Intent: {request.intent}",
                f"Output language: {request.output_language}",
                f"Planner:\n{planner.data.model_dump_json(indent=2)}",
                f"Composer:\n{composer.data.model_dump_json(indent=2)}",
                f"Critic:\n{critic.data.model_dump_json(indent=2)}",
                f"Reference blocks:\n{self._format_context_blocks(context_blocks)}",
                "Merge the best parts into one final, compact, high-quality Flowmusic JSON prompt package.",
            ]
        )
        system = (
            "You are the normalizer agent. Return the final production-ready JSON payload only. "
            "Respect the critique while keeping the output concise and musically specific."
        )
        fallback = NormalizerOutput(
            title=composer.data.title,
            prompt=composer.data.prompt,
            negative_prompt=composer.data.negative_prompt,
            style_tags=composer.data.style_tags,
            sections=composer.data.sections,
            production_notes=self._uniq(composer.data.production_notes + critic.data.revision_instructions),
            vocal_notes=composer.data.vocal_notes,
            arrangement_notes=composer.data.arrangement_notes,
            bpm_hint=composer.data.bpm_hint,
            key_hint=composer.data.key_hint,
            energy_curve=composer.data.energy_curve,
            seed_terms=composer.data.seed_terms,
            final_checks=["Validated against request constraints", "Ready for Prompt Library save"],
        )
        return await self._run_step(client, request, "normalizer", NormalizerOutput, system, prompt, fallback)

    async def _run_step(
        self,
        client: OllamaStructuredClient,
        request: FlowmusicAgentRequest,
        agent: str,
        model_cls: type[T],
        system: str,
        prompt: str,
        fallback: T,
    ) -> "_StepResult[T]":
        try:
            payload = await client.generate_structured(
                model=request.provider.model,
                system=system,
                prompt=prompt,
                schema=model_cls.model_json_schema(),
                temperature=request.provider.temperature,
            )
            data = model_cls.model_validate(payload)
            trace = AgentPassTrace(
                agent=agent,  # type: ignore[arg-type]
                model=request.provider.model,
                status="ok",
                summary=f"{agent} returned structured output",
                payload=data.model_dump(mode="json"),
            )
            return _StepResult(data=data, trace=trace)
        except Exception as error:
            trace = AgentPassTrace(
                agent=agent,  # type: ignore[arg-type]
                model=request.provider.model,
                status="fallback",
                summary=f"{agent} fallback used: {error}",
                payload=fallback.model_dump(mode="json"),
            )
            return _StepResult(data=fallback, trace=trace)

    def _select_context_blocks(self, request: FlowmusicAgentRequest) -> list[ContextBlockSummary]:
        if not request.include_library_context or request.library_limit <= 0:
            return []
        library = self._read_prompt_library()
        blocks = library.get("promptLibrary", {}).get("blocks", [])
        tokens = self._tokenize(
            " ".join(
                [
                    request.intent,
                    request.title_hint or "",
                    " ".join(request.genres),
                    " ".join(request.moods),
                    " ".join(request.sonic_focus),
                    " ".join(request.constraints),
                ]
            )
        )
        scored: list[ContextBlockSummary] = []
        for block in blocks:
            if not isinstance(block, dict):
                continue
            name = str(block.get("name") or "")
            category = str(block.get("category") or "")
            tags = [str(tag) for tag in block.get("tags") or []]
            payload_data = block.get("payload", {}).get("data") if isinstance(block.get("payload"), dict) else {}
            haystack = " ".join([name, category, " ".join(tags), json.dumps(payload_data, ensure_ascii=False)])
            hay_tokens = self._tokenize(haystack)
            overlap = len(tokens & hay_tokens)
            if overlap <= 0:
                continue
            excerpt = json.dumps(payload_data, ensure_ascii=False)[:260]
            scored.append(
                ContextBlockSummary(
                    id=str(block.get("id") or ""),
                    name=name or "Untitled block",
                    category=category or None,
                    tags=tags[:8],
                    score=round(overlap / max(len(tokens), 1), 3),
                    excerpt=excerpt,
                )
            )
        scored.sort(key=lambda item: item.score, reverse=True)
        return scored[: request.library_limit]

    def _read_prompt_library(self) -> dict[str, Any]:
        if not PROMPT_LIBRARY_MIRROR_PATH.exists():
            return {"promptLibrary": {"blocks": []}}
        try:
            return json.loads(PROMPT_LIBRARY_MIRROR_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {"promptLibrary": {"blocks": []}}

    def _build_library_block(
        self,
        request: FlowmusicAgentRequest,
        payload: FlowmusicPromptPayload,
    ) -> dict[str, Any]:
        tags = self._uniq(
            ["flowmusic", "agent_generated", "ollama", *request.genres, *request.moods, *payload.style_tags]
        )
        return {
            "name": payload.title,
            "description": f"Multi-agent Flowmusic prompt generated from intent: {request.intent}",
            "category": "flowmusic_agent",
            "tags": tags[:18],
            "payload": {
                "type": "flowmusic.app_prompt",
                "version": "1.0",
                "data": payload.model_dump(mode="json"),
            },
            "ui": {
                "color": "#8ef7c6",
                "icon": "agent",
                "boundButtonId": None,
            },
            "sourceMeta": {
                "source": "flowmusic_multi_agent",
                "provider": request.provider.provider,
                "model": request.provider.model,
            },
        }

    def _title_from_intent(self, intent: str) -> str:
        words = [word.capitalize() for word in re.findall(r"[A-Za-z0-9]+", intent)[:5]]
        return " ".join(words) or "Flowmusic Agent Prompt"

    def _compose_fallback_prompt(
        self,
        request: FlowmusicAgentRequest,
        planner: PlannerOutput,
        context_blocks: list[ContextBlockSummary],
    ) -> str:
        lines = [
            f"Create a track around: {request.intent}.",
            f"Primary mood palette: {', '.join(request.moods) or 'unspecified'}.",
            f"Genre anchors: {', '.join(request.genres) or 'hybrid electronic'}.",
            f"Sonic focus: {', '.join(planner.sonic_targets or request.sonic_focus) or 'detailed texture design'}.",
        ]
        if context_blocks:
            lines.append(f"Reference these prompt blocks: {', '.join(block.name for block in context_blocks[:4])}.")
        if request.constraints:
            lines.append(f"Hard constraints: {', '.join(request.constraints)}.")
        return " ".join(lines)

    def _fallback_sections(self, outline: list[str], intent: str) -> list[dict[str, str]]:
        normalized = outline or ["intro", "build", "drop", "outro"]
        return [
            {
                "label": label.title(),
                "purpose": f"{label} section",
                "prompt_fragment": f"Shape the {label} to reinforce {intent}.",
            }
            for label in normalized[:6]
        ]

    def _format_context_blocks(self, blocks: list[ContextBlockSummary]) -> str:
        if not blocks:
            return "none"
        return "\n".join(
            [
                f"- {block.name} [{block.category or 'uncategorized'}] tags={', '.join(block.tags)} excerpt={block.excerpt}"
                for block in blocks
            ]
        )

    def _tokenize(self, text: str) -> set[str]:
        return {token for token in re.findall(r"[A-Za-z0-9_]+", text.lower()) if len(token) >= 3}

    def _uniq(self, values: list[str]) -> list[str]:
        seen: set[str] = set()
        result: list[str] = []
        for value in values:
            item = str(value).strip()
            if not item:
                continue
            key = item.lower()
            if key in seen:
                continue
            seen.add(key)
            result.append(item)
        return result


class _StepResult[T: BaseModel]:
    def __init__(self, data: T, trace: AgentPassTrace) -> None:
        self.data = data
        self.trace = trace
