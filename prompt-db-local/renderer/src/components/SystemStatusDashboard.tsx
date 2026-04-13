// Φ_total(status:dashboard) — панель визуального контроля состояния
// Мониторинг всех связей и состояний системы

import React, { useEffect, useState, useCallback } from 'react';
import { sessionManager } from '@/services/SessionStateManager';
import { getMistralStatus } from '@/services/MistralService';
import { CollapsiblePanel } from './CollapsiblePanel';

interface SystemStatus {
  // WebSocket
  wsConnected: boolean;
  wsPort: number;
  lastMessageAt: string | null;
  
  // Sessions
  sessionCount: number;
  messageCount: number;
  activeAccounts: string[];
  
  // Chrome Extension
  extensionConnected: boolean;
  lastExtensionPing: number;
  
  // Mistral API
  mistralAvailable: boolean;
  lastApiCall: number;
  apiKeyConfigured: boolean;
}

export const SystemStatusDashboard: React.FC = () => {
  const [status, setStatus] = useState<SystemStatus>({
    wsConnected: false,
    wsPort: 3001,
    lastMessageAt: null,
    sessionCount: 0,
    messageCount: 0,
    activeAccounts: [],
    extensionConnected: false,
    lastExtensionPing: 0,
    mistralAvailable: false,
    lastApiCall: 0,
    apiKeyConfigured: false,
  });

  const [logs, setLogs] = useState<Array<{ time: string; message: string; type: 'info' | 'success' | 'error' | 'warning' }>>([]);

  const addLog = useCallback((message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    setLogs(prev => [
      { time: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 49), // Keep last 50
    ]);
  }, []);

  // Обновление статуса
  const refreshStatus = useCallback(async () => {
    // Получаем статус WebSocket
    let wsStatus = { state: 'unknown', port: 3001, lastMessageAt: null as string | null };
    if (window.electronAPI?.getWsStatus) {
      try {
        wsStatus = await window.electronAPI.getWsStatus();
      } catch (e) {
        addLog('Failed to get WebSocket status', 'error');
      }
    }

    // Получаем статистику сессий
    const sessions = sessionManager.getAllSessions();
    const accounts = [...new Set(sessions.map(s => s.accountId))];
    const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
    let mistralStatus = {
      available: false,
      configured: false,
      defaultModel: 'mistral-large-latest',
    };

    try {
      mistralStatus = await getMistralStatus();
    } catch {
      addLog('Failed to get Mistral status', 'error');
    }

    // Проверяем Mistral API
    setStatus({
      wsConnected: wsStatus.state === 'listening',
      wsPort: wsStatus.port,
      lastMessageAt: wsStatus.lastMessageAt,
      sessionCount: sessions.length,
      messageCount: totalMessages,
      activeAccounts: accounts,
      extensionConnected: sessions.length > 0 && Date.now() - (typeof sessions[0]?.updatedAt === 'string' ? new Date(sessions[0].updatedAt).getTime() : sessions[0]?.updatedAt || 0) < 60000,
      lastExtensionPing: typeof sessions[0]?.updatedAt === 'string' ? new Date(sessions[0].updatedAt).getTime() : sessions[0]?.updatedAt || 0,
      mistralAvailable: mistralStatus.available,
      lastApiCall: Date.now(),
      apiKeyConfigured: mistralStatus.configured,
    });

    addLog(`Status refreshed: ${sessions.length} sessions, ${accounts.length} accounts`, 'info');
  }, [addLog]);

  useEffect(() => {
    refreshStatus();
    const interval = setInterval(refreshStatus, 5000); // Auto-refresh every 5s
    return () => clearInterval(interval);
  }, [refreshStatus]);

  // Подписка на сессии
  useEffect(() => {
    const unsubscribe = sessionManager.subscribe((sessions) => {
      const accounts = [...new Set(sessions.map(s => s.accountId))];
      const totalMessages = sessions.reduce((acc, s) => acc + s.messages.length, 0);
      
      setStatus(prev => ({
        ...prev,
        sessionCount: sessions.length,
        messageCount: totalMessages,
        activeAccounts: accounts,
        extensionConnected: sessions.length > 0,
      }));

      if (sessions.length > 0) {
        addLog(`Session update: ${sessions.length} sessions`, 'success');
      }
    });

    return unsubscribe;
  }, [addLog]);

  const getStatusColor = (active: boolean) => active ? '#00d4aa' : '#ff4444';
  const getStatusText = (active: boolean) => active ? '● LIVE' : '○ OFF';

  return (
    <CollapsiblePanel
      id="system-status"
      title="System Status Monitor"
      eyebrow="Φ_total(telemetry)"
      badge={status.wsConnected ? 'WS Live' : 'WS Down'}
      badgeType={status.wsConnected ? 'success' : 'error'}
      defaultExpanded={true}
    >
      <div style={styles.container}>
        {/* Status Grid */}
        <div style={styles.grid}>
          {/* WebSocket */}
          <div style={styles.statusCard}>
            <div style={styles.statusHeader}>
              <span style={{ ...styles.statusDot, background: getStatusColor(status.wsConnected) }} />
              <span style={styles.statusTitle}>WebSocket</span>
            </div>
            <div style={styles.statusValue}>{getStatusText(status.wsConnected)}</div>
            <div style={styles.statusDetail}>Port {status.wsPort}</div>
            <div style={styles.statusDetail}>
              Last msg: {status.lastMessageAt ? new Date(status.lastMessageAt).toLocaleTimeString() : 'Never'}
            </div>
          </div>

          {/* Sessions */}
          <div style={styles.statusCard}>
            <div style={styles.statusHeader}>
              <span style={{ ...styles.statusDot, background: getStatusColor(status.sessionCount > 0) }} />
              <span style={styles.statusTitle}>Sessions</span>
            </div>
            <div style={styles.statusValue}>{status.sessionCount} active</div>
            <div style={styles.statusDetail}>{status.messageCount} messages</div>
            <div style={styles.statusDetail}>{status.activeAccounts.length} accounts</div>
          </div>

          {/* Chrome Extension */}
          <div style={styles.statusCard}>
            <div style={styles.statusHeader}>
              <span style={{ ...styles.statusDot, background: getStatusColor(status.extensionConnected) }} />
              <span style={styles.statusTitle}>Chrome Ext</span>
            </div>
            <div style={styles.statusValue}>{getStatusText(status.extensionConnected)}</div>
            <div style={styles.statusDetail}>
              {status.activeAccounts.map(acc => acc.slice(0, 8)).join(', ') || 'No accounts'}
            </div>
          </div>

          {/* Mistral API */}
          <div style={styles.statusCard}>
            <div style={styles.statusHeader}>
              <span style={{ ...styles.statusDot, background: getStatusColor(status.mistralAvailable && status.apiKeyConfigured) }} />
              <span style={styles.statusTitle}>Mistral AI</span>
            </div>
            <div style={styles.statusValue}>
              {status.mistralAvailable && status.apiKeyConfigured ? '● READY' : '○ NOT READY'}
            </div>
            <div style={styles.statusDetail}>
              API Key: {status.apiKeyConfigured ? '✓ Configured' : '✗ Missing'}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.actionBtn} onClick={refreshStatus}>
            🔄 Refresh Status
          </button>
          <button 
            style={styles.actionBtn} 
            onClick={() => {
              // Clear all sessions manually
              const sessions = sessionManager.getAllSessions();
              sessions.forEach(s => {
                // @ts-ignore - accessing private method for cleanup
                sessionManager.deleteSession?.(s.id);
              });
              addLog('All sessions cleared', 'warning');
            }}
          >
            🗑️ Clear Sessions
          </button>
          <button 
            style={styles.actionBtn}
            onClick={() => {
              // Тестовая сессия
              const testSession = sessionManager.getOrCreateSession(
                'test-account',
                'Test Account',
                'Test Session'
              );
              sessionManager.addMessage(testSession.id, 'Test message from System Dashboard', [], {
                complexity: 0.5,
                keywords: ['test'],
                intent: 'test',
              });
              addLog('Test session created', 'success');
            }}
          >
            🧪 Create Test Session
          </button>
        </div>

        {/* Live Log */}
        <div style={styles.logSection}>
          <h4 style={styles.logTitle}>📡 Live Events</h4>
          <div style={styles.logContainer}>
            {logs.length === 0 ? (
              <div style={styles.emptyLog}>No events yet. Waiting for WebSocket messages...</div>
            ) : (
              logs.map((log, i) => (
                <div 
                  key={i} 
                  style={{
                    ...styles.logEntry,
                    borderLeft: `3px solid ${
                      log.type === 'success' ? '#00d4aa' : 
                      log.type === 'error' ? '#ff4444' : 
                      log.type === 'warning' ? '#ffaa00' : '#888'
                    }`,
                  }}
                >
                  <span style={styles.logTime}>{log.time}</span>
                  <span style={styles.logMessage}>{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Help */}
        <div style={styles.helpBox}>
          <strong>🧠 How to activate sessions:</strong>
          <ol style={styles.helpList}>
            <li>Ensure Chrome Extension is installed with <code>identity</code> permission</li>
            <li>Open Producer AI tab and send a message</li>
            <li>Extension sends <code>sessionContext</code> via WebSocket ws://localhost:3001</li>
            <li>Session appears here with account ID from Chrome</li>
            <li>Click "Φ_total(analyze)" to run Mistral AI analysis</li>
          </ol>
        </div>
      </div>
    </CollapsiblePanel>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontSize: '0.9em',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: '15px',
    marginBottom: '20px',
  },
  statusCard: {
    background: '#2a2a4e',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #3a3a6e',
  },
  statusHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  statusDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  statusTitle: {
    fontWeight: 'bold',
    color: '#fff',
  },
  statusValue: {
    fontSize: '1.3em',
    color: '#00d4aa',
    marginBottom: '5px',
  },
  statusDetail: {
    fontSize: '0.85em',
    color: '#888',
  },
  actions: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
    marginBottom: '20px',
    padding: '15px',
    background: '#1a1a2e',
    borderRadius: '8px',
  },
  actionBtn: {
    padding: '8px 16px',
    background: '#2a2a4e',
    color: '#fff',
    border: '1px solid #00d4aa',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '0.9em',
  },
  logSection: {
    marginTop: '20px',
  },
  logTitle: {
    margin: '0 0 10px 0',
    color: '#00d4aa',
  },
  logContainer: {
    maxHeight: '200px',
    overflowY: 'auto',
    background: '#1a1a2e',
    borderRadius: '8px',
    padding: '10px',
  },
  logEntry: {
    padding: '6px 10px',
    marginBottom: '4px',
    background: '#2a2a4e',
    borderRadius: '4px',
    display: 'flex',
    gap: '10px',
    fontSize: '0.85em',
  },
  logTime: {
    color: '#888',
    fontFamily: 'monospace',
    minWidth: '70px',
  },
  logMessage: {
    color: '#fff',
  },
  emptyLog: {
    textAlign: 'center',
    color: '#666',
    padding: '30px',
    fontStyle: 'italic',
  },
  helpBox: {
    marginTop: '20px',
    padding: '15px',
    background: 'linear-gradient(135deg, #1a1a2e, #2a2a4e)',
    borderRadius: '8px',
    borderLeft: '3px solid #00d4aa',
    fontSize: '0.9em',
  },
  helpList: {
    margin: '10px 0 0 0',
    paddingLeft: '20px',
    color: '#aaa',
    lineHeight: '1.8',
  },
};

export default SystemStatusDashboard;
