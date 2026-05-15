// src/mmss/magnetic/MagneticBuilder.jsx — основной компонент режима
import React from 'react';
import { useMagneticField } from './useMagneticField';
import { FieldCanvas } from './FieldCanvas';

export function MagneticBuilder({ compact = false }) {
  const { state, loading, error, applyChoice } = useMagneticField();

  const handleChoice = async (id) => {
    try {
      await applyChoice(id);
    } catch (e) {
      console.error('MagneticBuilder error:', e);
    }
  };

  if (loading) return <div style={styles.loading}>⚙️ Инициализация поля...</div>;
  if (error) return <div style={styles.error}>❌ {error}</div>;
  if (!state) return null;

  return (
    <div style={compact ? styles.containerCompact : styles.container}>
      <div style={styles.header}>
        <h3 style={styles.title}>🧲 Магнитный билдер</h3>
        <div style={styles.meta}>
          День {state.day} • Фаза: <span style={styles.phase}>{state.phase}</span>
        </div>
      </div>
      
      <FieldCanvas metrics={state.metrics} phase={state.phase} />
      
      <div style={styles.options}>
        {state.options?.map(opt => (
          <button 
            key={opt.id} 
            onClick={() => handleChoice(opt.id)}
            style={{
              ...styles.btn,
              ...(opt.id === 'C' && state.metrics.stability < 0.35 ? styles.btnAnchor : {})
            }}
          >
            {opt.prompt}
          </button>
        ))}
      </div>
      
      {!compact && (
        <div style={styles.metrics}>
          {Object.entries(state.metrics).map(([k, v]) => (
            <span key={k} style={styles.metric}>
              {k}: {typeof v === 'number' ? v.toFixed(2) : v}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { 
    background: '#08080c', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', 
    padding: 20, borderRadius: 12, maxWidth: 580, margin: '0 auto' 
  },
  containerCompact: { 
    background: '#08080c', color: '#e2e8f0', fontFamily: 'system-ui, sans-serif', 
    padding: 12, borderRadius: 8, maxWidth: '100%' 
  },
  header: { textAlign: 'center', marginBottom: 12 },
  title: { margin: '0 0 4px', fontSize: 18 },
  meta: { fontSize: 13, opacity: 0.75 },
  phase: { color: '#60a5fa', fontWeight: 600 },
  options: { display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap', justifyContent: 'center' },
  btn: { 
    padding: '8px 14px', background: '#151522', color: '#60a5fa', 
    border: '1px solid #333', borderRadius: 8, cursor: 'pointer', fontSize: 13,
    transition: 'all 0.15s'
  },
  btnAnchor: { borderColor: '#22c55e', color: '#22c55e', boxShadow: '0 0 0 1px #22c55e33' },
  metrics: { marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', fontSize: 11, opacity: 0.65 },
  metric: { background: '#111', padding: '3px 8px', borderRadius: 4 },
  loading: { textAlign: 'center', padding: 30, opacity: 0.7 },
  error: { textAlign: 'center', padding: 20, color: '#f87171' }
};
