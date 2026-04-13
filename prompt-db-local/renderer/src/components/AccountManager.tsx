// Φ_total(account:manager) — управление Chrome аккаунтами
// Добавление реальных аккаунтов вручную для связи с Chrome Extension

import React, { useState, useCallback } from 'react';
import { sessionManager, type ProducerSession } from '@/services/SessionStateManager';

interface AccountManagerProps {
  onAccountAdded?: (accountId: string, accountName: string) => void;
  onSessionCreated?: (session: ProducerSession) => void;
}

interface AccountForm {
  accountId: string;
  accountName: string;
  sessionName: string;
  initialMessage: string;
}

export const AccountManager: React.FC<AccountManagerProps> = ({
  onAccountAdded,
  onSessionCreated,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [form, setForm] = useState<AccountForm>({
    accountId: '',
    accountName: '',
    sessionName: '',
    initialMessage: '',
  });
  const [savedAccounts, setSavedAccounts] = useState<Array<{ id: string; name: string; addedAt: string }>>(() => {
    try {
      const stored = localStorage.getItem('mmss:saved_accounts');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveAccountToStorage = useCallback((accounts: typeof savedAccounts) => {
    localStorage.setItem('mmss:saved_accounts', JSON.stringify(accounts));
    setSavedAccounts(accounts);
  }, []);

  const handleAddAccount = () => {
    if (!form.accountId.trim() || !form.accountName.trim()) return;

    // Создаём сессию для аккаунта
    const session = sessionManager.getOrCreateSession(
      form.accountId.trim(),
      form.accountName.trim(),
      form.sessionName.trim() || `Session ${new Date().toLocaleString()}`
    );

    // Добавляем начальное сообщение если есть
    if (form.initialMessage.trim()) {
      sessionManager.addMessage(
        session.id,
        form.initialMessage.trim(),
        [],
        {
          complexity: 0.5,
          keywords: ['manual', 'setup'],
          intent: 'setup',
        }
      );
    }

    // Сохраняем аккаунт в список
    const newAccount = {
      id: form.accountId.trim(),
      name: form.accountName.trim(),
      addedAt: new Date().toISOString(),
    };
    
    const updated = [...savedAccounts.filter(a => a.id !== newAccount.id), newAccount];
    saveAccountToStorage(updated);

    // Колбэки
    onAccountAdded?.(form.accountId.trim(), form.accountName.trim());
    onSessionCreated?.(session);

    // Сброс формы
    setForm({
      accountId: '',
      accountName: '',
      sessionName: '',
      initialMessage: '',
    });
    
    setIsExpanded(false);
  };

  const handleQuickAdd = (preset: 'producer1' | 'producer2' | 'chrome1' | 'chrome2') => {
    const presets: Record<string, AccountForm> = {
      producer1: {
        accountId: 'prod-account-001',
        accountName: 'Producer AI Main',
        sessionName: 'Main Production Session',
        initialMessage: 'Initializing Producer AI workflow',
      },
      producer2: {
        accountId: 'prod-account-002',
        accountName: 'Producer AI Test',
        sessionName: 'Testing & Development',
        initialMessage: 'Test environment setup',
      },
      chrome1: {
        accountId: 'chrome-profile-1',
        accountName: 'Chrome Profile 1',
        sessionName: 'Default Chrome Session',
        initialMessage: 'Chrome session tracking started',
      },
      chrome2: {
        accountId: 'chrome-profile-2',
        accountName: 'Chrome Profile 2',
        sessionName: 'Secondary Chrome Session',
        initialMessage: 'Secondary profile initialized',
      },
    };

    setForm(presets[preset]);
  };

  const deleteAccount = (accountId: string) => {
    const updated = savedAccounts.filter(a => a.id !== accountId);
    saveAccountToStorage(updated);
    
    // Удаляем связанные сессии
    const sessions = sessionManager.getSessionsByAccount(accountId);
    sessions.forEach(s => {
      sessionManager.deleteSession(s.id);
    });
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <div 
        style={styles.header}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={styles.headerLeft}>
          <span style={styles.icon}>👤</span>
          <div>
            <div style={styles.title}>Account Manager</div>
            <div style={styles.subtitle}>
              {savedAccounts.length} saved account{savedAccounts.length !== 1 ? 's' : ''}
            </div>
          </div>
        </div>
        <span style={{
          ...styles.expandIcon,
          transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
        }}>▶</span>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div style={styles.content}>
          {/* Saved Accounts List */}
          {savedAccounts.length > 0 && (
            <div style={styles.savedSection}>
              <h4 style={styles.sectionTitle}>🔗 Linked Accounts</h4>
              <div style={styles.accountList}>
                {savedAccounts.map(acc => (
                  <div key={acc.id} style={styles.accountCard}>
                    <div style={styles.accountInfo}>
                      <div style={styles.accountName}>{acc.name}</div>
                      <div style={styles.accountId}>{acc.id}</div>
                      <div style={styles.accountDate}>
                        Added: {new Date(acc.addedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <button
                      style={styles.deleteBtn}
                      onClick={() => deleteAccount(acc.id)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick Presets */}
          <div style={styles.presetsSection}>
            <h4 style={styles.sectionTitle}>⚡ Quick Add Presets</h4>
            <div style={styles.presetGrid}>
              <button style={styles.presetBtn} onClick={() => handleQuickAdd('producer1')}>
                🎬 Producer Main
              </button>
              <button style={styles.presetBtn} onClick={() => handleQuickAdd('producer2')}>
                🧪 Producer Test
              </button>
              <button style={styles.presetBtn} onClick={() => handleQuickAdd('chrome1')}>
                🌐 Chrome #1
              </button>
              <button style={styles.presetBtn} onClick={() => handleQuickAdd('chrome2')}>
                🌐 Chrome #2
              </button>
            </div>
          </div>

          {/* Manual Form */}
          <div style={styles.formSection}>
            <h4 style={styles.sectionTitle}>✏️ Manual Account Entry</h4>
            
            <div style={styles.form}>
              <div style={styles.formRow}>
                <label style={styles.label}>Account ID *</label>
                <input
                  style={styles.input}
                  value={form.accountId}
                  onChange={(e) => setForm({ ...form, accountId: e.target.value })}
                  placeholder="e.g., chrome-profile-1 or user@example.com"
                />
              </div>

              <div style={styles.formRow}>
                <label style={styles.label}>Account Name *</label>
                <input
                  style={styles.input}
                  value={form.accountName}
                  onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  placeholder="e.g., My Chrome Profile"
                />
              </div>

              <div style={styles.formRow}>
                <label style={styles.label}>Session Name</label>
                <input
                  style={styles.input}
                  value={form.sessionName}
                  onChange={(e) => setForm({ ...form, sessionName: e.target.value })}
                  placeholder="Optional - defaults to timestamp"
                />
              </div>

              <div style={styles.formRow}>
                <label style={styles.label}>Initial Message</label>
                <textarea
                  style={styles.textarea}
                  value={form.initialMessage}
                  onChange={(e) => setForm({ ...form, initialMessage: e.target.value })}
                  placeholder="Optional first message for this session"
                  rows={2}
                />
              </div>

              <button
                style={{
                  ...styles.addBtn,
                  opacity: !form.accountId.trim() || !form.accountName.trim() ? 0.5 : 1,
                }}
                onClick={handleAddAccount}
                disabled={!form.accountId.trim() || !form.accountName.trim()}
              >
                ➕ Add Account & Create Session
              </button>
            </div>
          </div>

          {/* Help */}
          <div style={styles.helpBox}>
            <strong>💡 How to get your Chrome Account ID:</strong>
            <ol style={styles.helpList}>
              <li>Open Chrome and go to <code>chrome://settings/people</code></li>
              <li>Your profile ID is in the URL or Settings</li>
              <li>Or check <code>chrome://version</code> for Profile Path</li>
              <li>Use any unique identifier - email, profile ID, or custom name</li>
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
    transition: 'background 0.2s',
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
  savedSection: {
    marginBottom: '20px',
  },
  sectionTitle: {
    margin: '0 0 12px 0',
    color: '#00d4aa',
    fontSize: '0.95em',
  },
  accountList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  accountCard: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px',
    background: '#1a1a2e',
    borderRadius: '6px',
    border: '1px solid #3a3a6e',
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontWeight: 'bold',
    color: '#fff',
  },
  accountId: {
    fontSize: '0.85em',
    color: '#00d4aa',
    fontFamily: 'monospace',
  },
  accountDate: {
    fontSize: '0.75em',
    color: '#666',
    marginTop: '4px',
  },
  deleteBtn: {
    padding: '4px 8px',
    background: '#ff4444',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  presetsSection: {
    marginBottom: '20px',
  },
  presetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  presetBtn: {
    padding: '10px',
    background: '#1a1a2e',
    color: '#00d4aa',
    border: '1px solid #00d4aa',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '0.85em',
    textAlign: 'left',
  },
  formSection: {
    marginBottom: '16px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  formRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  label: {
    fontSize: '0.85em',
    color: '#888',
  },
  input: {
    padding: '8px 12px',
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #3a3a6e',
    borderRadius: '4px',
    fontSize: '0.9em',
  },
  textarea: {
    padding: '8px 12px',
    background: '#1a1a2e',
    color: '#eee',
    border: '1px solid #3a3a6e',
    borderRadius: '4px',
    fontSize: '0.9em',
    resize: 'vertical',
  },
  addBtn: {
    padding: '12px',
    background: 'linear-gradient(135deg, #00d4aa, #00a884)',
    color: '#1a1a2e',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '0.95em',
    marginTop: '8px',
  },
  helpBox: {
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

export default AccountManager;
