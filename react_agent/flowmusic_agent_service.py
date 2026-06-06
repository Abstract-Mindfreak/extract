from __future__ import annotations

import json
import logging
import re
from pathlib import Path
from typing import Any

import httpx

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('d:/WORK/CLIENTS/extract/flowmusic_agent.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)
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
        tools: list[dict] | None = None,
        tool_choice: str | None = None,
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
        
        if tools:
            payload["tools"] = tools
            if tool_choice:
                payload["tool_choice"] = tool_choice
        
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        
        content = data["choices"][0]["message"]["content"]
        return json.loads(content)

    async def generate_with_tools(
        self,
        model: str,
        system: str,
        prompt: str,
        tools: list[dict],
        tool_choice: str | None = None,
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
            "tools": tools,
        }
        
        if tool_choice:
            payload["tool_choice"] = tool_choice
        
        response = await self.client.post(
            f"{self.base_url}/chat/completions",
            headers=headers,
            json=payload,
        )
        response.raise_for_status()
        data = response.json()
        
        return data


class FlowmusicAgentService:
    def __init__(self):
        self.api_key = self._load_mistral_key()
        self.api_client = httpx.AsyncClient(timeout=30.0)

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

    async def get_archive_tracks(self) -> dict:
        try:
            response = await self.client.get("http://localhost:3456/api/archives/tracks")
            response.raise_for_status()
            return response.json()
        except Exception as error:
            return {"tracks": [], "error": str(error)}

    async def get_archive_sessions(self) -> dict:
        try:
            response = await self.client.get("http://localhost:3456/api/archives/sessions")
            response.raise_for_status()
            return response.json()
        except Exception as error:
            return {"sessions": [], "error": str(error)}

    async def get_library_catalog(self) -> dict:
        try:
            response = await self.client.get("http://localhost:3456/api/library/catalog")
            response.raise_for_status()
            return response.json()
        except Exception as error:
            return {"catalog": [], "error": str(error)}

    async def get_library_blocks(self) -> dict:
        library = self._read_prompt_library()
        return {
            "blocks": library.get("promptLibrary", {}).get("blocks", []),
            "total": len(library.get("promptLibrary", {}).get("blocks", [])),
        }

    async def _get_archive_context(self, request: FlowmusicAgentRequest) -> dict:
        try:
            tracks_data = await self.get_archive_tracks()
            tracks = tracks_data.get("tracks", [])
            
            if not tracks:
                return {"tracks": [], "total": 0}
            
            tokens = self._tokenize(
                " ".join(
                    [
                        request.intent,
                        request.title_hint or "",
                        " ".join(request.genres),
                        " ".join(request.moods),
                        " ".join(request.sonic_focus),
                    ]
                )
            )
            
            scored_tracks = []
            for track in tracks[:50]:
                if not isinstance(track, dict):
                    continue
                title = str(track.get("title") or "")
                prompt = str(track.get("soundPrompt") or "")
                haystack = " ".join([title, prompt])
                hay_tokens = self._tokenize(haystack)
                overlap = len(tokens & hay_tokens)
                if overlap > 0:
                    scored_tracks.append({
                        "id": str(track.get("id") or ""),
                        "title": title or "Untitled",
                        "prompt": prompt[:300],
                        "score": round(overlap / max(len(tokens), 1), 3),
                    })
            
            scored_tracks.sort(key=lambda item: item["score"], reverse=True)
            return {
                "tracks": scored_tracks[:10],
                "total": len(scored_tracks),
            }
        except Exception as error:
            return {"tracks": [], "total": 0, "error": str(error)}

    def _get_tools(self) -> list[dict]:
        return [
            {
                "type": "function",
                "function": {
                    "name": "search_archive_tracks",
                    "description": "Search for tracks in the archive based on query terms like title, genre, mood, or sonic characteristics",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query for finding relevant tracks"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum number of results to return",
                                "default": 10
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "search_prompt_library",
                    "description": "Search the prompt library for blocks matching specific criteria like genre, mood, or sonic focus",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "query": {
                                "type": "string",
                                "description": "Search query for finding relevant prompt blocks"
                            },
                            "category": {
                                "type": "string",
                                "description": "Filter by category (optional)"
                            },
                            "limit": {
                                "type": "integer",
                                "description": "Maximum number of results to return",
                                "default": 6
                            }
                        },
                        "required": ["query"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_ase_modes",
                    "description": "Get available ASE (Audio Synthesis Engine) modes and their configurations",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_ase_config",
                    "description": "Get configuration for a specific ASE mode",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "mode": {
                                "type": "string",
                                "description": "ASE mode name (e.g., ase_variations, json_genesis, entropy_modulator, modulator_rack, ase_monitor_supreme, decomposition_audio, ai_orchestrator, generation_engine)"
                            }
                        },
                        "required": ["mode"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "get_library_stats",
                    "description": "Get statistics about the prompt library (total blocks, categories, etc.)",
                    "parameters": {
                        "type": "object",
                        "properties": {},
                        "required": []
                    }
                }
            }
        ]

    async def _execute_tool(self, tool_name: str, tool_args: dict) -> dict:
        if tool_name == "search_archive_tracks":
            query = tool_args.get("query", "")
            limit = tool_args.get("limit", 10)
            tracks_data = await self.get_archive_tracks()
            tracks = tracks_data.get("tracks", [])
            
            if not tracks:
                return {"results": [], "total": 0}
            
            tokens = self._tokenize(query)
            scored = []
            for track in tracks[:100]:
                if not isinstance(track, dict):
                    continue
                title = str(track.get("title") or "")
                prompt = str(track.get("soundPrompt") or "")
                haystack = " ".join([title, prompt])
                hay_tokens = self._tokenize(haystack)
                overlap = len(tokens & hay_tokens)
                if overlap > 0:
                    scored.append({
                        "id": str(track.get("id") or ""),
                        "title": title or "Untitled",
                        "prompt": prompt[:200],
                        "score": round(overlap / max(len(tokens), 1), 3),
                    })
            
            scored.sort(key=lambda item: item["score"], reverse=True)
            return {"results": scored[:limit], "total": len(scored)}
        
        elif tool_name == "search_prompt_library":
            query = tool_args.get("query", "")
            category = tool_args.get("category")
            limit = tool_args.get("limit", 6)
            library = self._read_prompt_library()
            blocks = library.get("promptLibrary", {}).get("blocks", [])
            
            tokens = self._tokenize(query)
            scored = []
            for block in blocks:
                if not isinstance(block, dict):
                    continue
                if category and block.get("category") != category:
                    continue
                name = str(block.get("name") or "")
                tags = " ".join([str(tag) for tag in block.get("tags") or []])
                haystack = " ".join([name, tags])
                hay_tokens = self._tokenize(haystack)
                overlap = len(tokens & hay_tokens)
                if overlap > 0:
                    scored.append({
                        "id": str(block.get("id") or ""),
                        "name": name or "Untitled",
                        "category": str(block.get("category") or ""),
                        "tags": block.get("tags", [])[:8],
                        "score": round(overlap / max(len(tokens), 1), 3),
                    })
            
            scored.sort(key=lambda item: item["score"], reverse=True)
            return {"results": scored[:limit], "total": len(scored)}
        
        elif tool_name == "get_ase_modes":
            return {
                "modes": [
                    {"name": "ase_variations", "description": "ASE variations mode for prompt generation"},
                    {"name": "json_genesis", "description": "JSON Genesis for JSON-based prompt generation"},
                    {"name": "entropy_modulator", "description": "Entropy modulator for chaos/order balance"},
                    {"name": "modulator_rack", "description": "Modulator rack for parameter control"},
                    {"name": "ase_monitor_supreme", "description": "ASE monitor supreme for advanced monitoring"},
                    {"name": "decomposition_audio", "description": "Decomposition audio for spectral analysis"},
                    {"name": "ai_orchestrator", "description": "AI orchestrator for AI-assisted composition"},
                    {"name": "generation_engine", "description": "Generation engine for audio generation"},
                ]
            }
        
        elif tool_name == "get_ase_config":
            mode = tool_args.get("mode", "")
            return {
                "mode": mode,
                "config": {
                    "enabled": True,
                    "parameters": {
                        "temperature": 0.35,
                        "max_tokens": 4096,
                    }
                }
            }
        
        elif tool_name == "get_library_stats":
            library = self._read_prompt_library()
            blocks = library.get("promptLibrary", {}).get("blocks", [])
            categories = set()
            for block in blocks:
                if isinstance(block, dict) and block.get("category"):
                    categories.add(str(block.get("category")))
            
            return {
                "total_blocks": len(blocks),
                "categories": sorted(list(categories)),
                "total_categories": len(categories),
            }
        
        else:
            return {"error": f"Unknown tool: {tool_name}"}

    async def generate(self, request: FlowmusicAgentRequest) -> FlowmusicGenerationResponse:
        if not self.api_key:
            raise ValueError("MISTRAL_API_KEY not configured in .env file")

        client = MistralStructuredClient(
            api_key=self.api_key,
            base_url=request.provider.base_url,
        )

        context_blocks = self._select_context_blocks(request)
        archive_context = await self._get_archive_context(request)

        planner_system = self._build_planner_system()
        planner_prompt = self._build_planner_prompt(request, context_blocks, archive_context)
        planner_result = await self._run_step(
            client, request, "planner", PlannerOutput, planner_system, planner_prompt, self._fallback_planner(request), use_tools=True
        )

        composer_system = self._build_composer_system()
        composer_prompt = self._build_composer_prompt(request, planner_result.data, context_blocks)
        composer_result = await self._run_step(
            client, request, "composer", ComposerOutput, composer_system, composer_prompt, self._fallback_composer(request, planner_result.data), use_tools=True
        )

        critic_system = self._build_critic_system()
        critic_prompt = self._build_critic_prompt(request, composer_result.data)
        critic_result = await self._run_step(
            client, request, "critic", CriticOutput, critic_system, critic_prompt, self._fallback_critic(), use_tools=True
        )

        normalizer_system = self._build_normalizer_system()
        normalizer_prompt = self._build_normalizer_prompt(request, composer_result.data, critic_result.data)
        normalizer_result = await self._run_step(
            client, request, "normalizer", NormalizerOutput, normalizer_system, normalizer_prompt, self._fallback_normalizer(composer_result.data, critic_result.data), use_tools=True
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
            archive_tracks=archive_context.get("tracks", []),
            traces=[planner_result.trace, composer_result.trace, critic_result.trace, normalizer_result.trace],
            final_payload=final_payload,
            library_block=library_block,
        )

    def _build_planner_system(self) -> str:
        return """You are a Flowmusic track planner. Analyze the user's intent and extract key musical elements.
Focus on: genre, mood, sonic characteristics, structure, and potential risks.

You have access to the following tools:
- search_archive_tracks: Search for tracks in the archive based on query terms
- search_prompt_library: Search the prompt library for blocks matching specific criteria
- get_ase_modes: Get available ASE (Audio Synthesis Engine) modes and their configurations
- get_ase_config: Get configuration for a specific ASE mode
- get_library_stats: Get statistics about the prompt library

Use these tools to gather context and information before planning the track structure."""

    def _build_planner_prompt(self, request: FlowmusicAgentRequest, context_blocks: list[ContextBlockSummary], archive_context: dict = None) -> str:
        lines = [
            f"Intent: {request.intent}",
            f"Genres: {', '.join(request.genres) or 'unspecified'}",
            f"Moods: {', '.join(request.moods) or 'unspecified'}",
            f"Sonic focus: {', '.join(request.sonic_focus) or 'unspecified'}",
            f"Constraints: {', '.join(request.constraints) or 'none'}",
        ]
        if context_blocks:
            lines.append(f"\nReference blocks:\n{self._format_context_blocks(context_blocks)}")
        if archive_context and archive_context.get("tracks"):
            lines.append(f"\nArchive tracks:\n{self._format_archive_tracks(archive_context['tracks'])}")
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

    def _flatten_mistral_response(self, payload: dict, agent: str) -> dict:
        if agent == "planner":
            if "track_plan" in payload:
                flattened = payload["track_plan"]
                if "title" not in flattened and "genre" in flattened:
                    genre = flattened["genre"]
                    if isinstance(genre, dict):
                        primary_genre = genre.get("primary", "Untitled")
                        secondary_genre = genre.get("secondary", "")
                        title = f"{primary_genre} {secondary_genre}".strip() or "Untitled Track"
                        flattened["title"] = title
                return flattened
            if "genre" in payload and len(payload) == 1:
                if "title" not in payload:
                    genre = payload["genre"]
                    if isinstance(genre, dict):
                        primary_genre = genre.get("primary", "Untitled")
                        secondary_genre = genre.get("secondary", "")
                        title = f"{primary_genre} {secondary_genre}".strip() or "Untitled Track"
                        payload["title"] = title
                return payload
        if agent == "composer":
            if "track" in payload:
                return payload["track"]
            if "track_prompt" in payload:
                return payload["track_prompt"]
        if agent == "critic":
            if "evaluation" in payload:
                return payload["evaluation"]
            if "clarity" in payload:
                return payload["clarity"]
        if agent == "normalizer":
            if "core_concept" in payload:
                return payload["core_concept"]
            if "description" in payload:
                return payload["description"]
        if agent == "normalizer" and "prompt" in payload and isinstance(payload["prompt"], dict):
            return payload["prompt"]
        return payload

    async def _run_step(
        self,
        client: MistralStructuredClient,
        request: FlowmusicAgentRequest,
        agent: str,
        model_cls: type,
        system: str,
        prompt: str,
        fallback,
        use_tools: bool = False,
    ) -> "_StepResult":
        tools_used = []
        raw_payload = None
        try:
            logger.info(f"\n=== {agent.upper()} STEP START ===")
            logger.info(f"Model: {request.provider.model}")
            logger.info(f"Use tools: {use_tools}")
            
            if use_tools:
                tools = self._get_tools()
                logger.info(f"Available tools: {[t['function']['name'] for t in tools]}")
                response = await client.generate_with_tools(
                    model=request.provider.model,
                    system=system,
                    prompt=prompt,
                    tools=tools,
                    temperature=request.provider.temperature,
                )
                
                message = response["choices"][0]["message"]
                tool_calls = message.get("tool_calls", [])
                logger.info(f"Tool calls made: {len(tool_calls) if tool_calls else 0}")
                
                if tool_calls:
                    tool_results = []
                    for tool_call in tool_calls:
                        tool_name = tool_call["function"]["name"]
                        tools_used.append(tool_name)
                        tool_args = json.loads(tool_call["function"]["arguments"])
                        logger.info(f"  Tool: {tool_name}, Args: {tool_args}")
                        result = await self._execute_tool(tool_name, tool_args)
                        tool_results.append({
                            "tool_call_id": tool_call["id"],
                            "role": "tool",
                            "content": json.dumps(result),
                        })
                    
                    messages = [
                        {"role": "system", "content": system},
                        {"role": "user", "content": prompt},
                        message,
                        *tool_results,
                    ]
                    
                    final_response = await client.client.post(
                        f"{client.base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {client.api_key}",
                            "Content-Type": "application/json",
                        },
                        json={
                            "model": request.provider.model,
                            "messages": messages,
                            "temperature": request.provider.temperature,
                            "response_format": {"type": "json_object"},
                        },
                    )
                    final_response.raise_for_status()
                    final_data = final_response.json()
                    content = final_data["choices"][0]["message"].get("content", "{}")
                    payload = json.loads(content) if content and content.strip() else {}
                else:
                    content = message.get("content", "{}")
                    payload = json.loads(content) if content and content.strip() else {}
            else:
                payload = await client.generate_structured(
                    model=request.provider.model,
                    system=system,
                    prompt=prompt,
                    schema=model_cls.model_json_schema(),
                    temperature=request.provider.temperature,
                )
            
            raw_payload = payload
            logger.info(f"Raw payload from Mistral: {json.dumps(payload, indent=2)[:500]}...")
            
            payload = self._flatten_mistral_response(payload, agent)
            logger.info(f"Flattened payload: {json.dumps(payload, indent=2)[:500]}...")
            
            data = model_cls.model_validate(payload)
            logger.info(f"Validation successful for {agent}")
            
            trace = AgentPassTrace(
                agent=agent,
                model=request.provider.model,
                status="ok",
                summary=f"{agent} returned structured output" + (f" (tools: {', '.join(tools_used)})" if tools_used else ""),
                payload=data.model_dump(mode="json"),
                tools_used=tools_used,
            )
            logger.info(f"=== {agent.upper()} STEP SUCCESS ===\n")
            return _StepResult(data=data, trace=trace)
        except Exception as error:
            import traceback
            logger.error(f"=== {agent.upper()} STEP ERROR ===")
            logger.error(f"Error: {error}")
            logger.error(f"Raw payload: {json.dumps(raw_payload, indent=2) if raw_payload else 'None'}")
            logger.error(traceback.format_exc())
            logger.error(f"=== {agent.upper()} STEP FALLBACK ===\n")
            
            trace = AgentPassTrace(
                agent=agent,
                model=request.provider.model,
                status="fallback",
                summary=f"{agent} fallback used: {error}",
                payload=fallback.model_dump(mode="json"),
                tools_used=tools_used,
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

    def _format_archive_tracks(self, tracks: list[dict]) -> str:
        if not tracks:
            return "none"
        return "\n".join(
            [
                f"- {track['title']} (score: {track['score']}) prompt: {track['prompt'][:200]}"
                for track in tracks
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
