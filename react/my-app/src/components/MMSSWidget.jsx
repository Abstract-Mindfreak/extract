import React from 'react';
import { MagneticBuilder } from '../mmss/magnetic/MagneticBuilder';

export function MMSSWidget({ mode = 'magnetic', compact = false, title }) {
  const modes = {
    magnetic: <MagneticBuilder compact={compact} />,
  };

  return (
    <div
      style={{
        background: '#0f0f1a',
        borderRadius: 12,
        padding: compact ? 8 : 16,
        border: '1px solid #2a2a3a',
      }}
    >
      {title && <div style={{ marginBottom: 8, fontSize: 14, fontWeight: 500 }}>{title}</div>}
      {modes[mode]}
    </div>
  );
}
