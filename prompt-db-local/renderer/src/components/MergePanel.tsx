import { useState } from 'react';
import type { PromptRecord } from '@/types/prompt';
import { mergePrompts } from '@/utils/mergePrompts';

type MergePanelProps = {
  prompts: PromptRecord[];
};

const DEFAULT_FORMULA = '{{promptA.text}} + random(promptB, promptC)';

export const MergePanel = ({ prompts }: MergePanelProps) => {
  const [formula, setFormula] = useState(DEFAULT_FORMULA);

  const preview = mergePrompts(prompts, formula);

  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Compose</p>
          <h2>Merge Preview</h2>
        </div>
      </div>

      <label className="field field-full">
        <span>Formula</span>
        <textarea value={formula} onChange={(event) => setFormula(event.target.value)} rows={3} />
      </label>

      <label className="field field-full">
        <span>Result</span>
        <textarea value={preview} readOnly rows={6} />
      </label>
    </section>
  );
};
