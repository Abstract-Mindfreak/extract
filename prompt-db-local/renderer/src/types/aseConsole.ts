export type AseControlType = 'knob' | 'slider' | 'toggle' | 'select' | 'meter' | 'button';

export type AseModeControl = {
  key: string;
  label: string;
  type: AseControlType;
  defaultValue: string;
  description: string;
  tip: string;
  tags: string[];
};

export type AseModeFragment = {
  consoleId: string;
  output: {
    stage: string;
    engine: string;
    result: string;
  };
  merge: {
    source: 'database' | 'logic' | 'hybrid';
    strategy: string;
  };
};

export type AseModeDefinition = {
  id: string;
  name: string;
  shortName: string;
  category: string;
  description: string;
  tip: string;
  tags: string[];
  controls: AseModeControl[];
  fragment: AseModeFragment;
};
