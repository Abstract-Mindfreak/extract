import React, { useState } from 'react';
import { critiqueOutputWithMistral, getMistralStatus, planGenerationWithMistral } from '@/services/MistralService';
import { usePromptStore } from '@/store/promptStore';
import { MMSSRuntimeService } from '../utils/MMSSRuntimeService';
import type { MMSSBuilderConfig, MMSSDomain, MMSSJobStatus, MMSSRuntimeResult } from '../types/mmss';
import type { CritiqueOutput, GenerationPlan, MistralStatus } from '../../../shared/mistral';

const ALLOWED_MMSS_DOMAINS: MMSSDomain[] = ['Rhythm', 'Timbre', 'Space', 'Logic'];

const normalizeDomains = (domains: string[]): MMSSDomain[] => {
  const normalized = domains.filter((domain): domain is MMSSDomain =>
    ALLOWED_MMSS_DOMAINS.includes(domain as MMSSDomain),
  );

  return normalized.length > 0 ? normalized : ALLOWED_MMSS_DOMAINS;
};

const normalizeLayers = (layers: number[]) => {
  const normalized = layers
    .filter((layer) => Number.isFinite(layer))
    .map((layer) => Math.max(1, Math.trunc(layer)))
    .slice(0, 6);

  return normalized.length > 0 ? normalized : [1, 2, 3];
};

export const MMSSRuntimePanel: React.FC<{
  onImportGenerated: (blocks: any[], intent: string) => Promise<void>;
}> = ({ onImportGenerated }) => {
  const appendMistralCoordinationRecord = usePromptStore((state) => state.appendMistralCoordinationRecord);
  const [status, setStatus] = useState<MMSSJobStatus>('idle');
  const [output, setOutput] = useState<string>('');
  const [result, setResult] = useState<MMSSRuntimeResult | null>(null);
  const [mistralStatus, setMistralStatus] = useState<MistralStatus | null>(null);
  const [mistralPlan, setMistralPlan] = useState<GenerationPlan | null>(null);
  const [mistralCritique, setMistralCritique] = useState<CritiqueOutput | null>(null);
  const [isPlanning, setIsPlanning] = useState(false);
  const [isCritiquing, setIsCritiquing] = useState(false);

  const [config, setConfig] = useState<MMSSBuilderConfig>({
    intent: 'industrial hypnotic techno',
    domains: ['Rhythm', 'Timbre', 'Space', 'Logic'],
    layers: [1, 2, 3],
    max_blocks: 10,
    temperature: 0.55,
    runs: 8,
    allow_mutation: true,
    allow_crossover: true,
  });

  const refreshMistralStatus = async () => {
    const nextStatus = await getMistralStatus();
    setMistralStatus(nextStatus);
    return nextStatus;
  };

  const runCritique = async (runtimeResult: MMSSRuntimeResult) => {
    setIsCritiquing(true);

    try {
      const response = await critiqueOutputWithMistral({
        exportData: runtimeResult,
        currentMode: 'mmss-v3',
        intent: config.intent,
        evaluationGoal: 'Evaluate MMSS runtime output quality and next optimization steps',
      });

      if (response.data) {
        setMistralCritique(response.data);
        await appendMistralCoordinationRecord({
          id: crypto.randomUUID(),
          source: 'mmss-runtime',
          intent: config.intent,
          createdAt: new Date().toISOString(),
          appliedMode: mistralPlan?.recommendedMode ?? 'mmss-v3',
          plan: mistralPlan
            ? {
                recommendedMode: mistralPlan.recommendedMode,
                domains: mistralPlan.domains,
                layers: mistralPlan.layers,
                rationale: mistralPlan.rationale,
              }
            : undefined,
          critique: response.data,
          metadata: {
            blockCount: runtimeResult.meta.block_count,
            runScore: runtimeResult.meta.run_score,
            valid: runtimeResult.meta.validation.valid,
          },
        });
      }
    } finally {
      setIsCritiquing(false);
    }
  };

  const runTask = async (taskName: string, taskFn: () => Promise<any>) => {
    setStatus('running');
    setOutput(`Running ${taskName}...`);

    try {
      const res = await taskFn();
      setOutput(res.output || (res.ok ? 'Success' : 'Error'));

      if (res.ok) {
        setStatus('success');

        if (res.data) {
          setResult(res.data);

          if (taskName === 'Builder V3') {
            await runCritique(res.data as MMSSRuntimeResult);
          }
        }
      } else {
        setStatus('error');
      }
    } catch (err: any) {
      setStatus('error');
      setOutput(err.message);
    }
  };

  const handlePlanBuilder = async () => {
    setIsPlanning(true);

    try {
      const nextStatus = await refreshMistralStatus();
      if (!nextStatus.available) {
        setOutput(nextStatus.error ?? 'Mistral is not configured');
        setStatus('error');
        return;
      }

      const response = await planGenerationWithMistral({
        intent: config.intent,
        availableDomains: ALLOWED_MMSS_DOMAINS,
        availableLayers: [1, 2, 3, 4],
        currentMode: 'mmss-v3',
        constraints: [
          `max_blocks=${config.max_blocks}`,
          `temperature=${config.temperature}`,
          `runs=${config.runs}`,
          `allow_mutation=${config.allow_mutation}`,
          `allow_crossover=${config.allow_crossover}`,
        ],
      });

      if (response.data) {
        const domains = normalizeDomains(response.data.domains);
        const layers = normalizeLayers(response.data.layers);

        setMistralPlan(response.data);
        setConfig((current) => ({
          ...current,
          intent: response.data?.intent || current.intent,
          domains,
          layers,
        }));

        await appendMistralCoordinationRecord({
          id: crypto.randomUUID(),
          source: 'mmss-runtime',
          intent: response.data.intent,
          createdAt: new Date().toISOString(),
          appliedMode: response.data.recommendedMode,
          plan: {
            recommendedMode: response.data.recommendedMode,
            domains: response.data.domains,
            layers: response.data.layers,
            rationale: response.data.rationale,
          },
          rules: response.data.rules,
          metadata: {
            maxBlocks: config.max_blocks,
            temperature: config.temperature,
            runs: config.runs,
          },
        });

        setOutput(
          response.ok
            ? `Planner set domains=${domains.join(', ')} layers=${layers.join(', ')}`
            : `Planner fallback used: ${response.error ?? 'unknown error'}`,
        );
        setStatus(response.ok ? 'success' : 'error');
      }
    } finally {
      setIsPlanning(false);
    }
  };

  const handleRunBuilder = () => runTask('Builder V3', () => MMSSRuntimeService.runBuilderV3(config));

  return (
    <div className="panel mmss-v3-panel">
      <header className="panel-header">
        <h2 className="panel-title">MMSS Runtime V3</h2>
        <div className={`status-badge status-${status}`}>{status.toUpperCase()}</div>
      </header>

      <div className="panel-content grid-2">
        <div className="tool-section">
          <h3>Build Tools</h3>
          <div className="button-group-vertical">
            <button onClick={() => runTask('Transform', MMSSRuntimeService.runTransform)}>Rebuild Blocks</button>
            <button onClick={() => runTask('Indexer', MMSSRuntimeService.runIndexerV3)}>Rebuild Index</button>
            <button onClick={() => runTask('Embeddings', MMSSRuntimeService.runEmbeddings)}>Build Embeddings</button>
            <button onClick={() => runTask('Graph', MMSSRuntimeService.runGraphV3)}>Build Graph</button>
            <button onClick={() => runTask('Mutation', MMSSRuntimeService.runMutation)}>Generate Mutations</button>
            <button onClick={() => runTask('Crossover', MMSSRuntimeService.runCrossover)}>Generate Crossovers</button>
            <button onClick={() => runTask('Self Rules', MMSSRuntimeService.runSelfRules)}>Generate Self Rules</button>
          </div>
        </div>

        <div className="config-section">
          <h3>Builder Configuration</h3>
          <div className="form-group">
            <label>Intent</label>
            <input
              type="text"
              value={config.intent}
              onChange={(e) => setConfig({ ...config, intent: e.target.value })}
            />
          </div>
          <div className="form-group">
            <label>Domains</label>
            <input
              type="text"
              value={config.domains.join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  domains: normalizeDomains(
                    e.target.value.split(',').map((entry) => entry.trim()).filter(Boolean),
                  ),
                })
              }
            />
          </div>
          <div className="form-group">
            <label>Layers</label>
            <input
              type="text"
              value={config.layers.join(', ')}
              onChange={(e) =>
                setConfig({
                  ...config,
                  layers: normalizeLayers(
                    e.target.value
                      .split(',')
                      .map((entry) => Number(entry.trim()))
                      .filter((entry) => !Number.isNaN(entry)),
                  ),
                })
              }
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Max Blocks</label>
              <input
                type="number"
                value={config.max_blocks}
                onChange={(e) => setConfig({ ...config, max_blocks: parseInt(e.target.value, 10) })}
              />
            </div>
            <div className="form-group">
              <label>Temperature</label>
              <input
                type="number"
                step="0.1"
                value={config.temperature}
                onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) })}
              />
            </div>
          </div>
          <div className="button-group-vertical">
            <button className="btn-secondary" onClick={() => void handlePlanBuilder()} disabled={isPlanning}>
              {isPlanning ? 'Planning...' : 'Plan MMSS with Mistral'}
            </button>
            <button className="btn-secondary" onClick={() => void refreshMistralStatus()}>
              Refresh Mistral Status
            </button>
            <button className="btn-primary" onClick={handleRunBuilder}>
              Run MMSS V3 Builder
            </button>
          </div>
          <div style={{ marginTop: 12, fontSize: '0.9em', opacity: 0.85 }}>
            <div>Mistral: {mistralStatus?.available ? `ready (${mistralStatus.defaultModel})` : 'not ready'}</div>
            <div>Domains: {config.domains.join(', ')}</div>
            <div>Layers: {config.layers.join(', ')}</div>
          </div>
        </div>
      </div>

      {mistralPlan && (
        <div className="result-preview">
          <h3>Mistral Plan</h3>
          <div className="result-meta">
            <span>Mode: {mistralPlan.recommendedMode}</span>
            <span>Domains: {mistralPlan.domains.join(', ') || 'none'}</span>
            <span>Layers: {mistralPlan.layers.join(', ') || 'none'}</span>
          </div>
          <pre>{mistralPlan.rationale.join('\n')}</pre>
        </div>
      )}

      {output && (
        <div className="output-console">
          <pre>{output}</pre>
        </div>
      )}

      {result && (
        <div className="result-preview">
          <h3>Generation Result</h3>
          <div className="result-meta">
            <span>Blocks: {result.meta.block_count}</span>
            <span>Score: {result.meta.run_score}</span>
            <span className={result.meta.validation.valid ? 'text-success' : 'text-error'}>
              {result.meta.validation.valid ? 'Valid' : 'Invalid'}
            </span>
          </div>
          <button className="btn-secondary" onClick={() => onImportGenerated(result.blocks, result.meta.intent)}>
            Import to Prompt Database
          </button>
        </div>
      )}

      {mistralCritique && (
        <div className="result-preview">
          <h3>Mistral Critique</h3>
          <div className="result-meta">
            <span>Quality: {(mistralCritique.estimatedQuality * 100).toFixed(0)}%</span>
            <span>{isCritiquing ? 'Critiquing...' : 'Latest run reviewed'}</span>
          </div>
          <pre>
            {[
              'Strengths:',
              ...mistralCritique.strengths.map((item) => `- ${item}`),
              '',
              'Weaknesses:',
              ...mistralCritique.weaknesses.map((item) => `- ${item}`),
              '',
              'Next adjustments:',
              ...mistralCritique.nextAdjustments.map((item) => `- ${item}`),
            ].join('\n')}
          </pre>
        </div>
      )}
    </div>
  );
};
