import { useMemo, useState } from 'react';
import { usePromptStore } from '@/store/promptStore';

const formatTimestamp = (value: string) => {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
};

export const MistralCoordinationPanel = () => {
  const history = usePromptStore((state) => state.mistralCoordinationHistory);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return history;
    }

    return history.filter((entry) =>
      [
        entry.intent,
        entry.source,
        entry.appliedMode,
        entry.plan?.recommendedMode,
        ...(entry.plan?.rationale ?? []),
        ...(entry.critique?.strengths ?? []),
        ...(entry.critique?.weaknesses ?? []),
        ...(entry.critique?.nextAdjustments ?? []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [history, query]);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Memory</p>
          <h2>Mistral Coordination History</h2>
        </div>
        <span className="badge">{filtered.length}</span>
      </div>

      <p className="panel-copy">
        Review previous planner decisions, generated rules, and critiques without opening raw
        meta files. This makes the Mistral feedback loop auditable from the UI.
      </p>

      <label className="field">
        <span>Search history</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="intent, source, mode, critique"
        />
      </label>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <strong>No coordination records yet</strong>
          <span>Run planning, rules, preview critique, or MMSS critique to populate history.</span>
        </div>
      ) : (
        <div className="log-list">
          {filtered.map((entry) => (
            <article key={entry.id} className="log-entry">
              <div className="panel-heading" style={{ marginBottom: 0 }}>
                <div>
                  <strong>{entry.intent}</strong>
                  <div className="panel-copy" style={{ margin: '4px 0 0' }}>
                    {entry.source} · {formatTimestamp(entry.createdAt)}
                  </div>
                </div>
                <span className="badge">
                  {entry.plan?.recommendedMode ?? entry.appliedMode ?? 'no-mode'}
                </span>
              </div>

              <div className="export-stats" style={{ margin: 0 }}>
                <span>Plan domains: {entry.plan?.domains.join(', ') || 'none'}</span>
                <span>Plan layers: {entry.plan?.layers.join(', ') || 'none'}</span>
                <span>Rules: {entry.rules?.composition_rules.length ?? 0}</span>
                <span>
                  Quality:{' '}
                  {entry.critique ? `${Math.round(entry.critique.estimatedQuality * 100)}%` : 'n/a'}
                </span>
              </div>

              {entry.plan?.rationale?.length ? (
                <label className="field">
                  <span>Planner rationale</span>
                  <textarea readOnly rows={4} value={entry.plan.rationale.join('\n')} />
                </label>
              ) : null}

              {entry.rules?.composition_rules?.length ? (
                <label className="field">
                  <span>Rules</span>
                  <textarea
                    readOnly
                    rows={4}
                    value={entry.rules.composition_rules
                      .map((rule) => `${rule.name}: ${rule.logic} = ${JSON.stringify(rule.value ?? rule.then ?? {})}`)
                      .join('\n')}
                  />
                </label>
              ) : null}

              {entry.critique ? (
                <label className="field">
                  <span>Critique</span>
                  <textarea
                    readOnly
                    rows={6}
                    value={[
                      'Strengths:',
                      ...entry.critique.strengths.map((item) => `- ${item}`),
                      '',
                      'Weaknesses:',
                      ...entry.critique.weaknesses.map((item) => `- ${item}`),
                      '',
                      'Next adjustments:',
                      ...entry.critique.nextAdjustments.map((item) => `- ${item}`),
                    ].join('\n')}
                  />
                </label>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
};
