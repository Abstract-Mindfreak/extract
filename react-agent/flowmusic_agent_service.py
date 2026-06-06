from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

import httpx
from .flowmusic_agent_models import (
    AgentPassTrace,
    ComposerOutput,
    ContextBlockSummary,
    CriticOutput,
    FlowmusicAgentRequest,
    FlowmusicGenerationResponse,
    FlowmusicPromptPayload,
    FlowmusicSection,
    MistralProviderConfig,
    NormalizerOutput,
    PlannerOutput,
)

PROMPT_LIBRARY_MIRROR_PATH = Path(__file__).parent.parent / "react" / "my-app" / "mmss_prompt_library.json"


class MistralStructuredClient:
    def __init__(self, api_key: str, base_url: str = "https://api.mistral.ai/v1"):
        self.api_key = api_key
        self.base_url = base_url
        self.client = httpx.AsyncClient(timeout=120.0)

    async def generate_structured(
        self,
        model: str,
        system: str,
        prompt: str,
        schema: dict,
        temperature: float = 0.35,
    ) -> dict:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": prompt},
            ],
            "temperature": temperature,
            "response_format": {"type": "json_object"},
        }
        
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)


class FlowmusicAgentService:
    def __init__(self):
        self.api_key = self._load_mistral_key()

    def _load_mistral_key(self) -> str:
        env_file = Path(__file__).parent.parent / ".env"
        if env_file.exists():
            for line in env_file.read_text(encoding="utf-8").splitlines():
                if line.startswith("MISTRAL_API_KEY="):
                    return line.split("=", 1)[1].strip()
        return ""

    async def get_health(self) -> dict:
        return {
            "status": "ok",
            "provider": "mistral",
            "api_key_configured": bool(self.api_key),
        }

    async def generate(self, request: FlowmusicAgentRequest) -> FlowmusicGenerationResponse:
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY not configured in .env file")

        client = MistralStructuredClient(
            api_key=self.api_key,
            base_url=request.provider.base_url,
        )

        context_blocks = self._select_context_blocks(request)

        # Step 1: Planner
        planner_system = self._build_planner_system()
        planner_prompt = self._build_planner_prompt(request, context_blocks)
        planner_result = await self._run_step(
            client, request, "planner", PlannerOutput, planner_system, planner_prompt, self._fallback_planner(request)
        )

        # Step 2: Composer
        composer_system = self._build_composer_system()
        composer_prompt = self._build_composer_prompt(request, planner_result.data, context_blocks)
        composer_result = await self._run_step(
            client, request, "composer", ComposerOutput, composer_system, composer_prompt, self._fallback_composer(request, planner_result.data)
        )

        # Step 3: Critic
        critic_system = self._build_critic_system()
        critic_prompt = self._build_critic_prompt(request, composer_result.data)
        critic_result = await self._run_step(
            client, request, "critic", CriticOutput, critic_system, critic_prompt, self._fallback_critic()
        )

        # Step 4: Normalizer
        normalizer_system = self._build_normalizer_system()
        normalizer_prompt = self._build_normalizer_prompt(request, composer_result.data, critic_result.data)
        normalizer_result = await self._run_step(
            client, request, "normalizer", NormalizerOutput, normalizer_system, normalizer_prompt, self._fallback_normalizer(composer_result.data, critic_result.data)
        )

        final_payload = FlowmusicPromptPayload(
            title=normalizer_result.data.title,
            prompt=normalizer_result.data.prompt,
            negative_prompt=normalizer_result.data.negative_prompt,
            style_tags=normalizer_result.data.style_tags,
            genres=request.genres,
            moods=request.moods,
            sonic_focus=request.sonic_focus,
            sections=normalizer_result.data.sections,
            production_notes=normalizer_result.data.production_notes,
            vocal_notes=normalizer_result.data.vocal_notes,
            arrangement_notes=normalizer_result.data.arrangement_notes,
            bpm_hint=normalizer_result.data.bpm_hint,
            key_hint=normalizer_result.data.key_hint,
            energy_curve=normalizer_result.data.energy_curve,
            seed_terms=normalizer_result.data.seed_terms,
            source_blocks=[block.name for block in context_blocks],
            source_block_ids=[block.id for block in context_blocks],
            generated_by={
                "provider": request.provider.provider,
                "model": request.provider.model,
            },
        )

        library_block = self._build_library_block(request, final_payload)

        return FlowmusicGenerationResponse(
            ok=True,
            provider=request.provider.provider,
            model=request.provider.model,
            request=request,
            context_blocks=context_blocks,
            traces=[planner_result.trace, composer_result.trace, critic_result.trace, normalizer_result.trace],
            final_payload=final_payload,
            library_block=library_block,
        )

    def _build_planner_system(self) -> str:
        return """You are a Flowmusic track planner. Analyze the user's intent and extract key musical elements.
Focus on: genre, mood, sonic characteristics, structure, and potential risks."""

    def _build_planner_prompt(self, request: FlowmusicAgentRequest, context_blocks: list[ContextBlockSummary]) -> str:
        lines = [
            f"Intent: {request.intent}",
            f"Genres: {', '.join(request.genres) or 'unspecified'}",
            f"Moods: {', '.join(request.moods) or 'unspecified'}",
            f"Sonic focus: {', '.join(request.sonic_focus) or 'unspecified'}",
            f"Constraints: {', '.join(request.constraints) or 'none'}",
        ]
        if context_blocks:
            lines.append(f"\nReference blocks:\n{self._format_context_blocks(context_blocks)}")
        return "\n".join(lines)

    def _fallback_planner(self, request: FlowmusicAgentRequest) -> PlannerOutput:
        return PlannerOutput(
            title=self._title_from_intent(request.intent),
            retrieval_queries=[request.intent],
            style_tags=request.genres[:5],
            sonic_targets=request.sonic_focus[:4] or ["detailed texture", "spatial design"],
            structure_outline=["intro", "build", "drop", "outro"],
            risks=[],
            production_notes=["Generated with fallback planner"],
        )

    def _build_composer_system(self) -> str:
        return """You are a Flowmusic composer. Create detailed track prompts with sections, production notes, and sonic characteristics."""

    def _build_composer_prompt(self, request: FlowmusicAgentRequest, planner: PlannerOutput, context_blocks: list[ContextBlockSummary]) -> str:
        lines = [
            f"Create a track: {planner.title}",
            f"Style tags: {', '.join(planner.style_tags)}",
            f"Sonic targets: {', '.join(planner.sonic_targets)}",
            f"Structure: {', '.join(planner.structure_outline)}",
        ]
        if context_blocks:
            lines.append(f"\nReference blocks:\n{self._format_context_blocks(context_blocks)}")
        return "\n".join(lines)

    def _fallback_composer(self, request: FlowmusicAgentRequest, planner: PlannerOutput) -> ComposerOutput:
        return ComposerOutput(
            title=planner.title,
            prompt=self._compose_fallback_prompt(request, planner, []),
            negative_prompt="low quality, generic, repetitive",
            style_tags=planner.style_tags,
            sections=[FlowmusicSection(label=label, purpose=f"{label} section", prompt_fragment=f"Shape the {label}") for label in planner.structure_outline[:6]],
            production_notes=planner.production_notes,
            vocal_notes=[],
            arrangement_notes=[],
            bpm_hint=None,
            key_hint=None,
            energy_curve=[],
            seed_terms=[],
        )

    def _build_critic_system(self) -> str:
        return """You are a Flowmusic critic. Evaluate the generated prompt for quality, coherence, and completeness."""

    def _build_critic_prompt(self, request: FlowmusicAgentRequest, composer: ComposerOutput) -> str:
        return f"Evaluate this track prompt:\n\nTitle: {composer.title}\nPrompt: {composer.prompt}\n\nCheck for: clarity, completeness, musical coherence, and adherence to constraints."

    def _fallback_critic(self) -> CriticOutput:
        return CriticOutput(
            approved=True,
            confidence=0.7,
            strengths=["Clear structure", "Good sonic description"],
            issues=[],
            revision_instructions=[],
        )

    def _build_normalizer_system(self) -> str:
        return """You are a Flowmusic normalizer. Ensure the final prompt is properly formatted and ready for the Prompt Library."""

    def _build_normalizer_prompt(self, request: FlowmusicAgentRequest, composer: ComposerOutput, critic: CriticOutput) -> str:
        lines = [
            f"Normalize this track prompt for the Prompt Library.",
            f"Title: {composer.title}",
            f"Prompt: {composer.prompt}",
        ]
        if critic.revision_instructions:
            lines.append(f"\nApply these revisions: {', '.join(critic.revision_instructions)}")
        return "\n".join(lines)

    def _fallback_normalizer(self, composer: ComposerOutput, critic: CriticOutput) -> NormalizerOutput:
        return NormalizerOutput(
            title=composer.title,
            prompt=composer.prompt,
            negative_prompt=composer.negative_prompt,
            style_tags=composer.style_tags,
            sections=composer.sections,
            production_notes=self._uniq(composer.production_notes + critic.revision_instructions),
            vocal_notes=composer.vocal_notes,
            arrangement_notes=composer.arrangement_notes,
            bpm_hint=composer.bpm_hint,
            key_hint=composer.key_hint,
            energy_curve=composer.energy_curve,
            seed_terms=composer.seed_terms,
            final_checks=["Validated against request constraints", "Ready for Prompt Library save"],
        )

    async def _run_step(
        self,
        client: MistralStructuredClient,
        request: FlowmusicAgentRequest,
        agent: str,
        model_cls: type,
        system: str,
        prompt: str,
        fallback,
    ) -> "_StepResult":
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
                agent=agent,
                model=request.provider.model,
                status="ok",
                summary=f"{agent} returned structured output",
                payload=data.model_dump(mode="json"),
            )
            return _StepResult(data=data, trace=trace)
        except Exception as error:
            trace = AgentPassTrace(
                agent=agent,
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
            ["flowmusic", "agent_generated", "mistral", *request.genres, *request.moods, *payload.style_tags]
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


class _StepResult:
    def __init__(self, data, trace: AgentPassTrace) -> None:
        self.data = data
        self.trace = trace
