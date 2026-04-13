type ImportPanelProps = {
  wsState: string;
  wsPort: number;
  lastWsMessageAt: string | null;
  lastWsSource: string;
  importLog: Array<{
    id: string;
    source: string;
    receivedAt: string;
    count: number;
    status: 'success' | 'empty' | 'error';
    message: string;
  }>;
  onImportFile: () => Promise<void>;
  onResetDatabase: () => Promise<void>;
  onRunSyncSelfTest: () => Promise<void>;
};

export const ImportPanel = ({
  wsState,
  wsPort,
  lastWsMessageAt,
  lastWsSource,
  importLog,
  onImportFile,
  onResetDatabase,
  onRunSyncSelfTest,
}: ImportPanelProps) => (
  <section className="panel accent-panel">
    <div className="panel-heading">
      <div>
        <p className="eyebrow">Ingress</p>
        <h2>Import Flow</h2>
      </div>
      <span className={`badge badge-${wsState}`}>WS {wsState}</span>
    </div>

    <p className="panel-copy">
      Electron listens on <code>ws://localhost:{wsPort}</code> and forwards payloads from the
      Chrome extension into IndexedDB and the new meta-driven analysis panels. The companion Chrome
      extension also uses the local HTTP API on <code>http://127.0.0.1:3210</code> for batch
      generation and prompt usage tracking.
    </p>

    <div style={{ background: '#1a1a2e', padding: '12px', borderRadius: '6px', marginBottom: '12px', borderLeft: '3px solid #00d4aa' }}>
      <div style={{ color: '#00d4aa', fontSize: '0.9em', marginBottom: '6px' }}>
        <span style={{ fontSize: '1.2em' }}>🧠 </span>
        <strong>AI Integration Active</strong>
      </div>
      <div style={{ fontSize: '0.8em', color: '#888' }}>
        WebSocket imports with sessionContext are automatically analyzed by Mistral AI. 
        Each Chrome account gets separate session tracking with intelligent autobatch suggestions.
      </div>
    </div>

    <div className="export-stats">
      <span>Last websocket source: {lastWsSource}</span>
      <span>
        Last message:{' '}
        {lastWsMessageAt ? new Date(lastWsMessageAt).toLocaleString() : 'No websocket payload yet'}
      </span>
    </div>

    <div className="button-row">
      <button type="button" className="primary-button" onClick={() => void onImportFile()}>
        Import JSON file
      </button>
      <button type="button" className="secondary-button" onClick={() => void onRunSyncSelfTest()}>
        Run WS self-test
      </button>
      <button type="button" className="secondary-button" onClick={() => void onResetDatabase()}>
        Clear local DB
      </button>
    </div>

    <div className="log-list">
      {importLog.map((entry) => (
        <article key={entry.id} className={`log-entry log-entry-${entry.status}`}>
          <strong>{entry.source}</strong>
          <span>{entry.message}</span>
          <small>{new Date(entry.receivedAt).toLocaleString()}</small>
        </article>
      ))}

      {importLog.length === 0 ? (
        <div className="empty-inline">
          Import history will appear here after the first file, Chrome extension push, or websocket
          self-test.
        </div>
      ) : null}
    </div>
  </section>
);
