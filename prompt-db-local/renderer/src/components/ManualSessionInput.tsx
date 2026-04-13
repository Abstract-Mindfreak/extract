// Φ_total(manual:input) — ручной ввод сообщений без Chrome Extension
// Позволяет использовать Mistral без расширения

import React, { useState } from 'react';
import { sessionManager } from '@/services/SessionStateManager';

interface ManualSessionInputProps {
  onSessionCreated?: (sessionId: string) => void;
  onMessageAdded?: () => void;
}

export const ManualSessionInput: React.FC<ManualSessionInputProps> = ({
  onSessionCreated,
  onMessageAdded,
}) => {
  const [mode, setMode] = useState<'quick' | 'full'>('quick');
  const [accountId, setAccountId] = useState('manual-user');
  const [accountName, setAccountName] = useState('Manual User');
  const [sessionName, setSessionName] = useState(`Session ${new Date().toLocaleString()}`);
  const [message, setMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  const handleQuickMessage = () => {
    if (!message.trim()) return;

    // Создаём или получаем сессию
    const session = sessionManager.getOrCreateSession(
      accountId,
      accountName,
      sessionName
    );

    // Добавляем сообщение
    sessionManager.addMessage(
      session.id,
      message.trim(),
      [],
      {
        complexity: calculateComplexity(message),
        keywords: extractKeywords(message),
        intent: 'manual',
      }
    );

    onSessionCreated?.(session.id);
    onMessageAdded?.();
    setMessage('');
  };

  const calculateComplexity = (text: string): number => {
    // Простая эвристика сложности
    const words = text.split(/\s+/).length;
    const sentences = text.split(/[.!?]+/).length;
    const avgWordLength = text.length / words;
    return Math.min(1, (words / 100 + sentences / 10 + avgWordLength / 10) / 3);
  };

  const extractKeywords = (text: string): string[] => {
    const stopWords = ['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been'];
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.includes(w));
    return [...new Set(words)].slice(0, 5);
  };

  const presets = [
    { label: '💻 Coding', text: 'How do I implement a recursive function in TypeScript that can handle nested JSON structures?' },
    { label: '🎨 Design', text: 'Create a dark theme UI design system with neon accents for a developer tool.' },
    { label: '📊 Analysis', text: 'Analyze the following data pattern and identify potential optimizations...' },
    { label: '🤔 Philosophy', text: 'Explain the concept of emergence in complex systems and give examples.' },
    { label: '🧪 Test', text: 'Write unit tests for a function that calculates Fibonacci numbers.' },
    { label: '📚 Learning', text: 'Teach me the fundamentals of quantum computing step by step.' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.header} onClick={() => setIsExpanded(!isExpanded)}>
        <div style={styles.headerLeft}>
          <span style={styles.icon}>✍️</span>
          <div>
            <div style={styles.title}>Manual Message Input</div>
            <div style={styles.subtitle}>Use Mistral without Chrome Extension</div>
          </div>
        </div>
        <span style={{...styles.expandIcon, transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'}}>▶</span>
      </div>

      {isExpanded && (
        <div style={styles.content}>
          {/* Quick Presets */}
          <div style={styles.presetsSection}>
            <h4 style={styles.sectionTitle}>⚡ Quick Message Presets</h4>
            <div style={styles.presetGrid}>
              {presets.map((p, i) => (
                <button
                  key={i}
                  style={styles.presetBtn}
                  onClick={() => setMessage(p.text)}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mode Toggle */}
          <div style={styles.modeToggle}>
            <button
              style={{...styles.modeBtn, ...(mode === 'quick' ? styles.modeBtnActive : {})}}
              onClick={() => setMode('quick')}
            >
              ⚡ Quick
            </button>
            <button
              style={{...styles.modeBtn, ...(mode === 'full' ? styles.modeBtnActive : {})}}
              onClick={() => setMode('full')}
            >
              ⚙️ Full Settings
            </button>
          </div>

          {/* Full Settings */}
          {mode === 'full' && (
            <div style={styles.fullSettings}>
              <div style={styles.formRow}>
                <label style={styles.label}>Account ID</label>
                <input
                  style={styles.input}
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  placeholder="e.g., user@example.com"
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Account Name</label>
                <input
                  style={styles.input}
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="e.g., My Name"
                />
              </div>
              <div style={styles.formRow}>
                <label style={styles.label}>Session Name</label>
                <input
                  style={styles.input}
                  value={sessionName}
                  onChange={(e) => setSessionName(e.target.value)}
                  placeholder="Session name..."
                />
              </div>
            </div>
          )}

          {/* Message Input */}
          <div style={styles.inputSection}>
            <textarea
              style={styles.messageInput}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Type your message here... (e.g., Ask Mistral a question or describe a task)"
              rows={4}
            />
            <div style={styles.inputActions}>
              <span style={styles.charCount}>{message.length} chars</span>
              <button
                style={{
                  ...styles.sendBtn,
                  opacity: !message.trim() ? 0.5 : 1,
                }}
                onClick={handleQuickMessage}
                disabled={!message.trim()}
              >
                📤 Send to Session
              </button>
            </div>
          </div>

          {/* Help */}
          <div style={styles.helpBox}>
            <strong>💡 How it works:</strong>
            <ol style={styles.helpList}>
              <li>Type or select a preset message above</li>
              <li>Click "Send to Session" to create/save the message</li>
              <li>Go to "💬 Φ_total Chat" tab to talk with Mistral about it</li>
              <li>Or click "🔬 Φ_total" to analyze the session automatically</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    background: '#2a2a4e',
    borderRadius: '8px',
    overflow: 'hidden',
    marginBottom: '16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
    cursor: 'pointer',
    background: '#3a3a6e',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  icon: {
    fontSize: '1.3em',
  },
  title: {
    fontWeight: 'bold',
    color: '#fff',
  },
  subtitle: {
    fontSize: '0.85em',
    color: '#888',
  },
  expandIcon: {
    color: '#00d4aa',
    fontSize: '0.9em',
    transition: 'transform 0.2s',
  },
  content: {
    padding: '16px',
  },
  presetsSection: {
    marginBottom: '16px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    color: '#00d4aa',
    fontSize: '0.9em',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '8px',
  },
  presetBtn: {
    padding: '8px',
    background: '#1a1a2e',
    color: '#00d4aa',
    border: '1px solid #00d4aa',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.8em',
  },
  modeToggle: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
  },
  modeBtn: {
    flex: 1,
    padding: '8px',
    background: '#1a1a2e',
    color: '#888',
    border: '1px solid #3a3a6e',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  modeBtnActive: {
    background: '#00d4aa',
    color: '#1a1a2e',
    fontWeight: 'bold',
  },
  fullSettings: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '16px',
    padding: '12px',
    background: '#1a1a2e',
    borderRadius: '6px',
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '0.8em',
    color: '#888',
  },
  input: {
    padding: '8px 12px',
    background: '#2a2a4e',
    color: '#eee',
    border: '1px solid #3a3a6e',
    borderRadius: '4px',
    fontSize: '0.9em',
  },
  inputSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  messageInput: {
    padding: '12px',
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #3a3a6e',
    borderRadius: '6px',
    fontSize: '0.95em',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  inputActions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  charCount: {
    fontSize: '0.8em',
    color: '#666',
  },
  sendBtn: {
    padding: '10px 20px',
    background: 'linear-gradient(135deg, #00d4aa, #00a884)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  helpBox: {
    marginTop: '16px',
    padding: '12px',
    background: '#1a1a2e',
    borderRadius: '6px',
    borderLeft: '3px solid #00d4aa',
    fontSize: '0.85em',
    color: '#aaa',
  },
  helpList: {
    margin: '8px 0 0 0',
    paddingLeft: '20px',
    lineHeight: '1.6',
  },
};

export default ManualSessionInput;
