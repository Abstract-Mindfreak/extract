import { useState, useEffect, useRef } from "react";
import { 
  Archive, Play, Square, FolderOpen, Trash2, RefreshCw, 
  CheckCircle, AlertCircle, LogIn, Settings, Music, 
  Download, FileJson, Image, Film, Activity, Globe,
  User, ChevronDown, ChevronUp, Terminal, Save
} from "lucide-react";
import { archiverManager, DEFAULT_ACCOUNTS } from "../../services/ProducerArchiverService";

export default function ProducerArchiverPanel() {
  const [accounts, setAccounts] = useState([]);
  const [activeAccount, setActiveAccount] = useState("account_1");
  const [runningAccounts, setRunningAccounts] = useState([]);
  const [logs, setLogs] = useState({});
  const [stats, setStats] = useState({});
  const [expandedLogs, setExpandedLogs] = useState({});
  const [editingAccount, setEditingAccount] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [concurrency, setConcurrency] = useState(4);
  const [globalStatus, setGlobalStatus] = useState("idle");
  const [serverStatus, setServerStatus] = useState("checking");
  const logsEndRef = useRef(null);

  // Load accounts on mount
  useEffect(() => {
    const init = async () => {
      try {
        const accs = await archiverManager.getAccounts();
        setAccounts(accs);
        setActiveAccount(archiverManager.getActiveAccount());
        setServerStatus("connected");
      } catch (e) {
        console.warn("Failed to connect to archiver server:", e);
        setServerStatus("disconnected");
        setAccounts(DEFAULT_ACCOUNTS.map(a => ({ ...a, isConfigured: false })));
      }
    };
    init();
  }, []);

  // Load stats on mount
  useEffect(() => {
    loadAllStats();
    const interval = setInterval(loadAllStats, 30000);
    return () => clearInterval(interval);
  }, []);

  // Subscribe to events
  useEffect(() => {
    const handleLog = ({ accountId, type, line }) => {
      setLogs(prev => ({
        ...prev,
        [accountId]: [...(prev[accountId] || []), { type, line, time: Date.now() }].slice(-500)
      }));
    };

    const handleComplete = ({ accountId, code }) => {
      setRunningAccounts(prev => prev.filter(id => id !== accountId));
      setGlobalStatus(prev => {
        const stillRunning = runningAccounts.filter(id => id !== accountId);
        return stillRunning.length > 0 ? "running" : "idle";
      });
      loadAccountStats(accountId);
    };

    const handleError = ({ accountId, error }) => {
      setRunningAccounts(prev => prev.filter(id => id !== accountId));
      console.error(`Archiver error for ${accountId}:`, error);
    };

    archiverManager.on('log', handleLog);
    archiverManager.on('complete', handleComplete);
    archiverManager.on('error', handleError);

    return () => {
      archiverManager.off('log', handleLog);
      archiverManager.off('complete', handleComplete);
      archiverManager.off('error', handleError);
    };
  }, [runningAccounts]);

  // Auto-scroll logs
  useEffect(() => {
    if (activeAccount && expandedLogs[activeAccount] && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, activeAccount, expandedLogs]);

  const loadAccountStats = async (accountId) => {
    const stat = await archiverManager.getAccountStats(accountId);
    setStats(prev => ({ ...prev, [accountId]: stat }));
  };

  const loadAllStats = async () => {
    const allStats = await archiverManager.getAllStats();
    const statsMap = {};
    allStats.forEach(s => { if (s) statsMap[s.accountId] = s; });
    setStats(statsMap);
  };

  const refreshAccounts = async () => {
    try {
      const accs = await archiverManager.getAccounts();
      setAccounts(accs);
    } catch (e) {
      console.warn("Failed to refresh accounts:", e);
    }
  };

  const handleStart = async (accountId, options = {}) => {
    try {
      setGlobalStatus("running");
      await archiverManager.startArchiver(accountId, { 
        ...options, 
        concurrency: concurrency.toString() 
      });
      setRunningAccounts(prev => [...prev, accountId]);
    } catch (err) {
      // eslint-disable-next-line no-restricted-globals
      window.alert(`Failed to start: ${err.message}`);
    }
  };

  const handleStop = (accountId) => {
    archiverManager.stopArchiver(accountId);
    setRunningAccounts(prev => prev.filter(id => id !== accountId));
  };

  const handleLogin = (accountId) => {
    setActiveAccount(accountId);
    archiverManager.setActiveAccount(accountId);
    handleStart(accountId, { headful: true });
  };

  const handleTriggerLoginReady = async () => {
    await archiverManager.triggerLoginReady();
    // eslint-disable-next-line no-restricted-globals
    window.alert("Login ready signal sent! Browser should continue.");
  };

  const handleOpenOutput = async (accountId) => {
    try {
      await archiverManager.openOutputDir(accountId);
    } catch (err) {
      // eslint-disable-next-line no-restricted-globals
      window.alert(`Failed to open folder: ${err.message}`);
    }
  };

  const handleCleanup = async (accountId) => {
    // eslint-disable-next-line no-restricted-globals
    if (!window.confirm("Clear auth for this account? Downloaded files will be kept.")) return;
    await archiverManager.cleanupAccount(accountId);
    refreshAccounts();
    loadAccountStats(accountId);
  };

  const toggleLogs = (accountId) => {
    setExpandedLogs(prev => ({ ...prev, [accountId]: !prev[accountId] }));
  };

  const updateAccountName = (accountId, newName) => {
    archiverManager.updateAccount(accountId, { name: newName });
    refreshAccounts();
    setEditingAccount(null);
  };

  const isAnyRunning = runningAccounts.length > 0;
  const totalSongs = Object.values(stats).reduce((sum, s) => sum + (s?.totalSongs || 0), 0);
  const totalDownloaded = Object.values(stats).reduce((sum, s) => sum + (s?.downloadedAudio || 0), 0);

  return (
    <div className="min-h-screen w-full bg-[#020202] text-cyan-500 p-4 font-mono">
      <div className="max-w-[1600px] mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-cyan-900/30 pb-4">
          <div className="flex items-center gap-4">
            <div className="p-2 rounded-full bg-cyan-950">
              <Archive size={20} className="text-cyan-500" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-white flex items-center gap-2">
                <Music size={16} className="text-pink-500" />
                FLOWMUSIC.APP ARCHIVER
                <span className="text-pink-500 italic text-sm">v1.0</span>
              </h1>
              <div className="flex gap-3 text-[9px] uppercase tracking-[0.3em] text-cyan-800">
                <span>Multi-Account Manager</span>
                <span className="text-pink-900">/</span>
                <span>{accounts.filter(a => a.isConfigured).length}/4 Configured</span>
                <span className="text-pink-900">/</span>
                <span className={isAnyRunning ? "text-green-500 animate-pulse" : ""}>
                  {isAnyRunning ? "● RUNNING" : "○ IDLE"}
                </span>
                <span className="text-pink-900">/</span>
                <span className={serverStatus === "connected" ? "text-cyan-500" : "text-red-500"}>
                  {serverStatus === "connected" ? "◉ SERVER" : "◎ OFFLINE"}
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Global Stats */}
            <div className="flex gap-4 text-xs">
              <div className="text-center">
                <div className="text-pink-500 font-bold">{totalSongs}</div>
                <div className="text-cyan-800 text-[9px]">TOTAL SONGS</div>
              </div>
              <div className="text-center">
                <div className="text-green-500 font-bold">{totalDownloaded}</div>
                <div className="text-cyan-800 text-[9px]">DOWNLOADED</div>
              </div>
            </div>
            
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 border border-cyan-700 text-cyan-600 hover:bg-cyan-950 rounded transition-all"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div className="bg-black border border-cyan-900 rounded-xl p-4">
            <h3 className="text-[10px] font-bold text-cyan-400 uppercase mb-3">Global Settings</h3>
            <div className="flex gap-6 items-center">
              <div>
                <label className="text-[10px] text-cyan-700 block mb-1">Concurrency</label>
                <input
                  type="range" min="1" max="16" value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value))}
                  className="w-32 accent-pink-600"
                />
                <span className="text-xs text-cyan-500 ml-2">{concurrency}</span>
              </div>
              <div className="text-[10px] text-cyan-700">
                Output Base: <span className="text-cyan-500">d:\WORK\CLIENTS\extract\flowmusic-archiver</span>
              </div>
            </div>
          </div>
        )}

        {/* Server Disconnected Warning */}
        {serverStatus !== "connected" && (
          <div className="bg-red-950/30 border border-red-700/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-red-500" />
              <div>
                <div className="text-xs text-red-500 font-bold">Archiver Server Offline</div>
                <div className="text-[10px] text-red-700">
                  Start the server: npm run archiver:server
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Login Ready Button (when headful mode) */}
        {isAnyRunning && serverStatus === "connected" && (
          <div className="bg-yellow-950/30 border border-yellow-700/50 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle size={20} className="text-yellow-500" />
              <div>
                <div className="text-xs text-yellow-500 font-bold">Login Mode Active</div>
                <div className="text-[10px] text-yellow-700">
                  After logging in browser, click this button to continue archiver
                </div>
              </div>
            </div>
            <button
              onClick={handleTriggerLoginReady}
              className="px-6 py-2 bg-yellow-600 hover:bg-yellow-500 text-black font-bold text-xs rounded transition-all flex items-center gap-2"
            >
              <CheckCircle size={14} />
              LOGIN READY
            </button>
          </div>
        )}

        {/* Accounts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {accounts.map(account => {
            const isRunning = runningAccounts.includes(account.id);
            const isActive = activeAccount === account.id;
            const accountLogs = logs[account.id] || [];
            const accountStats = stats[account.id];
            const isLogsExpanded = expandedLogs[account.id];
            const isEditing = editingAccount === account.id;

            return (
              <div 
                key={account.id}
                className={`bg-black border rounded-xl overflow-hidden transition-all ${
                  isActive ? "border-pink-500 shadow-[0_0_20px_rgba(236,72,153,0.2)]" : "border-cyan-900"
                }`}
              >
                {/* Account Header */}
                <div 
                  className="p-4 flex items-center justify-between"
                  style={{ backgroundColor: `${account.color}10` }}
                >
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: account.color }}
                    />
                    {isEditing ? (
                      <input
                        type="text"
                        defaultValue={account.name}
                        className="bg-transparent border-b border-cyan-500 text-white text-sm focus:outline-none"
                        onBlur={(e) => updateAccountName(account.id, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            updateAccountName(account.id, e.currentTarget.value);
                          }
                        }}
                        autoFocus
                      />
                    ) : (
                      <h3 
                        className="text-sm font-bold text-white cursor-pointer hover:text-cyan-400"
                        onClick={() => setEditingAccount(account.id)}
                      >
                        {account.name}
                      </h3>
                    )}
                    
                    {account.isConfigured ? (
                      <span className="text-[9px] bg-green-900/50 text-green-400 px-2 py-0.5 rounded">
                        AUTH OK
                      </span>
                    ) : (
                      <span className="text-[9px] bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded">
                        NEED LOGIN
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveAccount(account.id)}
                      className={`px-3 py-1 text-[10px] border rounded transition-all ${
                        isActive 
                          ? "border-pink-500 text-pink-500 bg-pink-500/10" 
                          : "border-cyan-800 text-cyan-700 hover:border-cyan-600"
                      }`}
                    >
                      {isActive ? "ACTIVE" : "SELECT"}
                    </button>
                  </div>
                </div>

                {/* Account Stats */}
                <div className="p-4 grid grid-cols-4 gap-2 border-b border-cyan-900/30">
                  <StatBox 
                    label="Songs" 
                    value={accountStats?.totalSongs || 0} 
                    icon={<Music size={12}/>}
                  />
                  <StatBox 
                    label="Completed" 
                    value={accountStats?.completedSongs || 0}
                    icon={<CheckCircle size={12}/>}
                  />
                  <StatBox 
                    label="Audio" 
                    value={accountStats?.downloadedAudio || 0}
                    icon={<Download size={12}/>}
                  />
                  <StatBox 
                    label="Missing" 
                    value={accountStats?.missingAudio || 0}
                    icon={<AlertCircle size={12}/>}
                    color={accountStats?.missingAudio > 0 ? "text-yellow-500" : "text-cyan-600"}
                  />
                </div>

                {/* Action Buttons */}
                <div className="p-4 grid grid-cols-2 gap-2">
                  {!account.isConfigured ? (
                    <button
                      onClick={() => handleLogin(account.id)}
                      disabled={isRunning}
                      className="col-span-2 py-2 bg-yellow-600 hover:bg-yellow-500 disabled:bg-cyan-950 text-black font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                    >
                      <LogIn size={14}/>
                      LOGIN & AUTHENTICATE
                    </button>
                  ) : (
                    <>
                      {isRunning ? (
                        <button
                          onClick={() => handleStop(account.id)}
                          className="py-2 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                        >
                          <Square size={14}/>
                          STOP
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStart(account.id)}
                          className="py-2 bg-green-600 hover:bg-green-500 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                        >
                          <Play size={14}/>
                          START
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleStart(account.id, { skipHarvest: true })}
                        disabled={isRunning}
                        className="py-2 bg-cyan-700 hover:bg-cyan-600 disabled:bg-cyan-950 text-white font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                      >
                        <RefreshCw size={14}/>
                        RESUME
                      </button>

                      <button
                        onClick={() => handleOpenOutput(account.id)}
                        className="py-2 border border-cyan-700 text-cyan-500 hover:bg-cyan-950 font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                      >
                        <FolderOpen size={14}/>
                        FOLDER
                      </button>

                      <button
                        onClick={() => handleCleanup(account.id)}
                        disabled={isRunning}
                        className="py-2 border border-red-900 text-red-700 hover:bg-red-950 disabled:opacity-50 font-bold text-xs rounded transition-all flex items-center justify-center gap-2"
                      >
                        <Trash2 size={14}/>
                        CLEAR AUTH
                      </button>
                    </>
                  )}
                </div>

                {/* Logs Toggle */}
                <button
                  onClick={() => toggleLogs(account.id)}
                  className="w-full py-2 bg-cyan-950/30 hover:bg-cyan-950/50 text-cyan-700 text-[10px] flex items-center justify-center gap-2 transition-all"
                >
                  {isLogsExpanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
                  {isLogsExpanded ? "HIDE LOGS" : "SHOW LOGS"}
                  <span className="text-cyan-900">({accountLogs.length} lines)</span>
                </button>

                {/* Logs Panel */}
                {isLogsExpanded && (
                  <div className="h-48 overflow-y-auto bg-[#050505] p-3 text-[10px] font-mono border-t border-cyan-900/30">
                    {accountLogs.length === 0 ? (
                      <div className="text-cyan-900 italic">No logs yet...</div>
                    ) : (
                      <>
                        {accountLogs.map((log, i) => (
                          <div 
                            key={i}
                            className={`${
                              log.type === 'stderr' ? 'text-red-500' : 'text-cyan-600'
                            } whitespace-pre-wrap break-all`}
                          >
                            <span className="text-cyan-800">[{new Date(log.time).toLocaleTimeString()}]</span>{' '}
                            {log.line}
                          </div>
                        ))}
                        <div ref={logsEndRef} />
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Info Panel */}
        <div className="bg-black border border-cyan-900 rounded-xl p-6">
          <h3 className="text-[10px] font-bold text-cyan-400 uppercase mb-4 flex items-center gap-2">
            <Globe size={12}/>
            How to Use Multi-Account Archiver
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-cyan-700">
            <div className="space-y-2">
              <p className="font-bold text-cyan-500">Initial Setup:</p>
              <ol className="list-decimal list-inside space-y-1 text-[10px]">
                <li>Click "LOGIN & AUTHENTICATE" for each account</li>
                <li>Browser will open - log in with your Google account</li>
                <li>When you see your song library, click "LOGIN READY"</li>
                <li>Session will be saved for future runs</li>
              </ol>
            </div>
            <div className="space-y-2">
              <p className="font-bold text-cyan-500">Running Archiver:</p>
              <ol className="list-decimal list-inside space-y-1 text-[10px]">
                <li>"START" - Full harvest + download</li>
                <li>"RESUME" - Skip harvest, download only</li>
                <li>"STOP" - Cancel running archiver</li>
                <li>Each account runs independently</li>
              </ol>
            </div>
          </div>
          
          <div className="mt-4 pt-4 border-t border-cyan-900/30 text-[10px] text-cyan-800 space-y-1">
            <p><strong>Downloads include:</strong> M4A audio, JPG covers, MP4 videos, JSON metadata (lyrics, prompts, seeds, conditions)</p>
            <p><strong>Output location:</strong> Each account has separate folder (producer_backup_1, producer_backup_2, etc.)</p>
          </div>
        </div>

      </div>
    </div>
  );
}

function StatBox({ label, value, icon, color = "text-cyan-600" }) {
  return (
    <div className="text-center p-2 bg-cyan-950/20 rounded">
      <div className={`text-lg font-bold ${color}`}>{value}</div>
      <div className="text-[9px] text-cyan-800 flex items-center justify-center gap-1">
        {icon}
        {label}
      </div>
    </div>
  );
}
