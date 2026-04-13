import type { MistralMessage, MistralResponse } from '../../shared/electron';
import type {
  CritiqueOutput,
  CritiqueOutputRequest,
  GeneratedRules,
  GenerateRulesRequest,
  GenerationPlan,
  GenerationPlanRequest,
  MistralStatus,
  SessionSummary,
  StructuredResult,
  SummarizeSessionRequest,
} from '../../shared/mistral';
import type { CompositionMode, Rule, RuleLogic, RuleSet } from '../../shared/meta';

type CoordinatorConfig = {
  apiKey: string;
  defaultModel: string;
};

const ALLOWED_RULE_LOGICS: RuleLogic[] = [
  'must_include_layers',
  'min_domains',
  'conditional_requirement',
];

const ALLOWED_MODES: CompositionMode[] = [
  'as-is',
  'random-mix',
  'sequence-based',
  'mmss-v3',
  'rule-engine',
  'self-rule-engine',
  'mutation-engine',
  'mmss-v4',
  'F-Final',
  'Φ_total',
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value.trim() : fallback;

const uniqueStrings = (value: unknown, fallback: string[] = []) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === 'string')
        .map((entry) => entry.trim())
        .filter(Boolean),
    ),
  );
};

const uniqueNumbers = (value: unknown, fallback: number[] = []) => {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is number => typeof entry === 'number' && Number.isFinite(entry))
        .map((entry) => Math.trunc(entry)),
    ),
  );
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const unwrapJsonObject = (content: string) => {
  const trimmed = content.trim();

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
};

const parseJsonObject = (content: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(unwrapJsonObject(content));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const validateRule = (value: unknown): Rule | null => {
  if (!isRecord(value)) {
    return null;
  }

  const name = asString(value.name);
  const logic = asString(value.logic) as RuleLogic;

  if (!name || !ALLOWED_RULE_LOGICS.includes(logic)) {
    return null;
  }

  const rule: Rule = {
    name,
    logic,
  };

  if (Array.isArray(value.value)) {
    const numbers = uniqueNumbers(value.value);
    if (numbers.length > 0) {
      rule.value = numbers;
    }
  } else if (typeof value.value === 'number' && Number.isFinite(value.value)) {
    rule.value = Math.trunc(value.value);
  }

  if (isRecord(value.if)) {
    rule.if = value.if;
  }

  if (isRecord(value.then)) {
    rule.then = value.then;
  }

  return rule;
};

const buildFallbackRuleSet = (domains: string[], layers: number[]): RuleSet => ({
  composition_rules: [
    {
      name: 'layer_balance',
      logic: 'must_include_layers',
      value: layers.slice(0, Math.max(1, Math.min(3, layers.length))),
    },
    {
      name: 'domain_spread',
      logic: 'min_domains',
      value: Math.max(1, Math.min(3, domains.length)),
    },
  ],
});

const validateRuleSet = (value: unknown, fallbackDomains: string[], fallbackLayers: number[]): RuleSet => {
  if (!isRecord(value) || !Array.isArray(value.composition_rules)) {
    return buildFallbackRuleSet(fallbackDomains, fallbackLayers);
  }

  const rules = value.composition_rules
    .map((entry) => validateRule(entry))
    .filter((entry): entry is Rule => entry !== null);

  return {
    composition_rules: rules.length > 0 ? rules : buildFallbackRuleSet(fallbackDomains, fallbackLayers).composition_rules,
  };
};

const validateGenerationPlan = (
  value: unknown,
  request: GenerationPlanRequest,
): GenerationPlan => {
  const fallbackRules = buildFallbackRuleSet(request.availableDomains, request.availableLayers);
  const fallbackMode: CompositionMode =
    request.availableDomains.length > 1 || request.availableLayers.length > 1
      ? 'rule-engine'
      : 'sequence-based';

  if (!isRecord(value)) {
    return {
      intent: request.intent,
      recommendedMode: fallbackMode,
      domains: request.availableDomains,
      layers: request.availableLayers,
      rules: fallbackRules,
      rationale: ['Fallback generation plan applied because coordinator output was invalid.'],
    };
  }

  const recommendedMode = asString(value.recommendedMode) as CompositionMode;

  return {
    intent: asString(value.intent, request.intent) || request.intent,
    recommendedMode: ALLOWED_MODES.includes(recommendedMode) ? recommendedMode : fallbackMode,
    domains: uniqueStrings(value.domains, request.availableDomains).filter((entry) =>
      request.availableDomains.includes(entry),
    ),
    layers: uniqueNumbers(value.layers, request.availableLayers).filter((entry) =>
      request.availableLayers.includes(entry),
    ),
    rules: validateRuleSet(value.rules, request.availableDomains, request.availableLayers),
    rationale: uniqueStrings(value.rationale, ['Fallback rationale was used.']),
  };
};

const validateGeneratedRules = (
  value: unknown,
  request: GenerateRulesRequest,
): GeneratedRules => {
  const fallback = buildFallbackRuleSet(request.availableDomains, request.availableLayers);

  if (!isRecord(value)) {
    return {
      rules: fallback,
      explanation: 'Fallback rules were used because coordinator output was invalid.',
    };
  }

  return {
    rules: validateRuleSet(value.rules, request.availableDomains, request.availableLayers),
    explanation: asString(value.explanation, 'Rules generated with fallback explanation.') ||
      'Rules generated with fallback explanation.',
  };
};

const validateCritiqueOutput = (value: unknown): CritiqueOutput => {
  if (!isRecord(value)) {
    return {
      strengths: ['Critique was unavailable.'],
      weaknesses: ['Coordinator returned an invalid structure.'],
      nextAdjustments: ['Retry critique after a successful generation run.'],
      estimatedQuality: 0.4,
    };
  }

  return {
    strengths: uniqueStrings(value.strengths, ['No strengths were returned.']),
    weaknesses: uniqueStrings(value.weaknesses, ['No weaknesses were returned.']),
    nextAdjustments: uniqueStrings(value.nextAdjustments, ['No next adjustments were returned.']),
    estimatedQuality:
      typeof value.estimatedQuality === 'number' && Number.isFinite(value.estimatedQuality)
        ? clamp(value.estimatedQuality, 0, 1)
        : 0.5,
  };
};

const validateSessionSummary = (value: unknown, request: SummarizeSessionRequest): SessionSummary => {
  if (!isRecord(value)) {
    return {
      summary: `Session "${request.sessionName}" has ${request.totalMessages} messages. Structured summary fallback was used.`,
      suggestedNextSteps: ['Review recent context and retry analysis.'],
      tags: [],
      confidence: 0.35,
    };
  }

  return {
    summary:
      asString(
        value.summary,
        `Session "${request.sessionName}" has ${request.totalMessages} messages. Structured summary fallback was used.`,
      ) ||
      `Session "${request.sessionName}" has ${request.totalMessages} messages. Structured summary fallback was used.`,
    suggestedNextSteps: uniqueStrings(value.suggestedNextSteps, ['Review recent context and retry analysis.']),
    tags: uniqueStrings(value.tags, []),
    confidence:
      typeof value.confidence === 'number' && Number.isFinite(value.confidence)
        ? clamp(value.confidence, 0, 1)
        : 0.5,
  };
};

export class MistralCoordinator {
  constructor(private readonly config: CoordinatorConfig) {}

  getStatus(): MistralStatus {
    const configured = this.config.apiKey.trim().length > 0;

    return {
      configured,
      available: configured,
      defaultModel: this.config.defaultModel,
      error: configured ? undefined : 'MISTRAL_API_KEY is not configured in the environment.',
    };
  }

  async rawChat(messages: MistralMessage[], model?: string): Promise<MistralResponse> {
    const status = this.getStatus();

    if (!status.configured) {
      return { ok: false, error: status.error };
    }

    try {
      const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          model: model || this.config.defaultModel,
          messages,
          temperature: 0.2,
          max_tokens: 4096,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return {
          ok: false,
          error: `Mistral API error: ${response.status} - ${errorText}`,
        };
      }

      const data = (await response.json()) as MistralResponse['data'];
      return { ok: true, data };
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  async applyPhi(process: string, context?: string, model?: string): Promise<MistralResponse> {
    return this.rawChat(
      [
        {
          role: 'system',
          content:
            'You apply recursive process analysis. Return concise but useful guidance for process evolution.',
        },
        {
          role: 'user',
          content: `Process: ${process}\nContext: ${context || 'prompt-db-local pipeline'}`,
        },
      ],
      model,
    );
  }

  async planGeneration(request: GenerationPlanRequest): Promise<StructuredResult<GenerationPlan>> {
    const response = await this.rawChat(
      [
        {
          role: 'system',
          content: [
            'You are a generation coordinator for a local prompt system.',
            'Return only valid JSON.',
            'Choose the best generation mode and rule set.',
            'Schema:',
            '{',
            '  "intent": string,',
            '  "recommendedMode": one of as-is/random-mix/sequence-based/mmss-v3/rule-engine/self-rule-engine/mutation-engine/mmss-v4/F-Final/Φ_total,',
            '  "domains": string[],',
            '  "layers": number[],',
            '  "rules": { "composition_rules": Rule[] },',
            '  "rationale": string[]',
            '}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify(request),
        },
      ],
      request.model,
    );

    if (!response.ok || !response.data) {
      return {
        ok: false,
        error: response.error,
        data: validateGenerationPlan(null, request),
      };
    }

    const rawContent = response.data.choices[0]?.message?.content || '';
    const parsed = parseJsonObject(rawContent);

    return {
      ok: parsed !== null,
      data: validateGenerationPlan(parsed, request),
      error: parsed ? undefined : 'Coordinator returned invalid JSON for generation plan.',
      rawContent,
    };
  }

  async generateRules(request: GenerateRulesRequest): Promise<StructuredResult<GeneratedRules>> {
    const response = await this.rawChat(
      [
        {
          role: 'system',
          content: [
            'You generate rule sets for a local prompt composition system.',
            'Return only valid JSON.',
            'Schema:',
            '{',
            '  "rules": { "composition_rules": Rule[] },',
            '  "explanation": string',
            '}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify(request),
        },
      ],
      request.model,
    );

    if (!response.ok || !response.data) {
      return {
        ok: false,
        error: response.error,
        data: validateGeneratedRules(null, request),
      };
    }

    const rawContent = response.data.choices[0]?.message?.content || '';
    const parsed = parseJsonObject(rawContent);

    return {
      ok: parsed !== null,
      data: validateGeneratedRules(parsed, request),
      error: parsed ? undefined : 'Coordinator returned invalid JSON for generated rules.',
      rawContent,
    };
  }

  async critiqueOutput(request: CritiqueOutputRequest): Promise<StructuredResult<CritiqueOutput>> {
    const response = await this.rawChat(
      [
        {
          role: 'system',
          content: [
            'You critique generated output for a prompt composition system.',
            'Return only valid JSON.',
            'Schema:',
            '{',
            '  "strengths": string[],',
            '  "weaknesses": string[],',
            '  "nextAdjustments": string[],',
            '  "estimatedQuality": number',
            '}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            ...request,
            exportData:
              typeof request.exportData === 'string'
                ? request.exportData.slice(0, 4000)
                : JSON.stringify(request.exportData, null, 2).slice(0, 4000),
          }),
        },
      ],
      request.model,
    );

    if (!response.ok || !response.data) {
      return {
        ok: false,
        error: response.error,
        data: validateCritiqueOutput(null),
      };
    }

    const rawContent = response.data.choices[0]?.message?.content || '';
    const parsed = parseJsonObject(rawContent);

    return {
      ok: parsed !== null,
      data: validateCritiqueOutput(parsed),
      error: parsed ? undefined : 'Coordinator returned invalid JSON for output critique.',
      rawContent,
    };
  }

  async summarizeSession(request: SummarizeSessionRequest): Promise<StructuredResult<SessionSummary>> {
    const response = await this.rawChat(
      [
        {
          role: 'system',
          content: [
            'You summarize AI production sessions.',
            'Return only valid JSON.',
            'Schema:',
            '{',
            '  "summary": string,',
            '  "suggestedNextSteps": string[],',
            '  "tags": string[],',
            '  "confidence": number',
            '}',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify(request),
        },
      ],
      request.model,
    );

    if (!response.ok || !response.data) {
      return {
        ok: false,
        error: response.error,
        data: validateSessionSummary(null, request),
      };
    }

    const rawContent = response.data.choices[0]?.message?.content || '';
    const parsed = parseJsonObject(rawContent);

    return {
      ok: parsed !== null,
      data: validateSessionSummary(parsed, request),
      error: parsed ? undefined : 'Coordinator returned invalid JSON for session summary.',
      rawContent,
    };
  }
}
