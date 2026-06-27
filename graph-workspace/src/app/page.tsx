"use client";

import { useEffect, useState } from "react";
import { useGraphStore } from "@/store/graph-store";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Network,
  GitBranch,
  Database,
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  Maximize2,
  Minimize2,
} from "lucide-react";
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import dynamic from "next/dynamic";

const GraphViewer = dynamic(() => import("@/components/graph/graph-viewer"), { ssr: false });
const QueryPanel = dynamic(() => import("@/components/graph/query-panel"), { ssr: false });
const NodeDetailPanel = dynamic(() => import("@/components/graph/node-detail"), { ssr: false });
const EdgeDetailPanel = dynamic(() => import("@/components/graph/edge-detail"), { ssr: false });
const StatsPanel = dynamic(() => import("@/components/graph/stats-panel"), { ssr: false });
const ConfigPanel = dynamic(() => import("@/components/graph/config-panel"), { ssr: false });
const FileListPanel = dynamic(() => import("@/components/graph/file-list"), { ssr: false });
const SuggestionPanel = dynamic(() => import("@/components/graph/suggestion-panel"), { ssr: false });

const queryClient = new QueryClient();

function SidebarContent() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);

  return (
    <>
      <QueryPanel />
      <SuggestionPanel />
      {selectedNodeId && <NodeDetailPanel />}
      {selectedEdgeId && <EdgeDetailPanel />}
      <StatsPanel />
      <FileListPanel />
      <ConfigPanel />
    </>
  );
}

function FloatingDetails() {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectedEdgeId = useGraphStore((s) => s.selectedEdgeId);

  return (
    <>
      {selectedNodeId && (
        <div className="absolute left-3 top-3 z-10 w-72">
          <NodeDetailPanel />
        </div>
      )}
      {selectedEdgeId && (
        <div className="absolute left-3 top-3 z-10 w-72">
          <EdgeDetailPanel />
        </div>
      )}
    </>
  );
}

function FooterBar() {
  const mode = useGraphStore((s) => s.mode);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const config = useGraphStore((s) => s.config);

  return (
    <footer className="flex h-8 shrink-0 items-center justify-between border-t border-slate-800/80 bg-slate-900/90 px-4 text-[11px] text-slate-500 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span>{mode === "graphrag" ? "GraphRAG" : "Graphify"} mode</span>
        <span>|</span>
        <span>{nodes.length} nodes | {edges.length} edges</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-amber-400/60">Ollama {config.ollamaModel}</span>
        <span>|</span>
        <span>PostgreSQL abstract-mind-lab</span>
      </div>
    </footer>
  );
}

function PageContent() {
  const mode = useGraphStore((s) => s.mode);
  const config = useGraphStore((s) => s.config);
  const setMode = useGraphStore((s) => s.setMode);
  const setGraphData = useGraphStore((s) => s.setGraphData);
  const setStats = useGraphStore((s) => s.setStats);
  const setDocuments = useGraphStore((s) => s.setDocuments);
  const setFiles = useGraphStore((s) => s.setFiles);
  const clearSelection = useGraphStore((s) => s.clearSelection);
  const sidebarOpen = useGraphStore((s) => s.sidebarOpen);
  const setSidebarOpen = useGraphStore((s) => s.setSidebarOpen);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      clearSelection();
      try {
        const endpoint = mode === "graphrag" ? "/api/graphrag/graph" : "/api/graphify/graph";
        const res = await fetch(endpoint);
        const data = await res.json();
        if (!cancelled) {
          setGraphData(data.nodes || [], data.edges || [], data.communities || []);
          setStats(data.stats || null);
          setDocuments(data.documents || []);
          setFiles(data.files || []);
        }
      } catch {
        if (!cancelled) {
          setGraphData([], [], []);
          setStats(null);
          setDocuments([]);
          setFiles([]);
        }
      }
      if (!cancelled) setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, refreshKey, setGraphData, setStats, setDocuments, setFiles, clearSelection]);

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      void document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      void document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="shrink-0 border-b border-slate-800/80 bg-slate-900/90 backdrop-blur-sm">
        <div className="flex h-12 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Network className="h-5 w-5 text-amber-400" />
              <h1 className="text-sm font-semibold text-slate-100">Graph Workspace</h1>
            </div>
            <Separator orientation="vertical" className="h-6 bg-slate-700/50" />
            <div className="flex items-center rounded-lg border border-slate-700/30 bg-slate-800/60 p-0.5">
              <ModeButton
                active={mode === "graphrag"}
                onClick={() => setMode("graphrag")}
                icon={<Database className="h-3.5 w-3.5" />}
                label="GraphRAG"
                sublabel="documents + entities"
              />
              <ModeButton
                active={mode === "graphify"}
                onClick={() => setMode("graphify")}
                icon={<GitBranch className="h-3.5 w-3.5" />}
                label="Graphify"
                sublabel="files + imports"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge
              label="Ollama"
              value={config.ollamaModel}
              color="border-emerald-500/20 bg-emerald-400/10 text-emerald-400"
              emoji="AI"
            />
            <StatusBadge
              label={mode === "graphrag" ? "Storage" : "Graph"}
              value={mode === "graphrag" ? "Postgres" : "Snapshot"}
              color="border-sky-500/20 bg-sky-400/10 text-sky-400"
              emoji={mode === "graphrag" ? "DB" : "FS"}
            />
            <Separator orientation="vertical" className="h-6 bg-slate-700/50" />
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-200"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-200"
              onClick={toggleFullscreen}
            >
              {isFullscreen ? (
                <Minimize2 className="h-3.5 w-3.5" />
              ) : (
                <Maximize2 className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-slate-200"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? (
                <ChevronRight className="h-3.5 w-3.5" />
              ) : (
                <ChevronLeft className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden">
        <aside
          className={`custom-scrollbar shrink-0 overflow-y-auto border-r border-slate-800/80 bg-slate-900/50 transition-all duration-200 ${
            sidebarOpen ? "w-80" : "w-0 overflow-hidden"
          }`}
        >
          <div className="w-80 space-y-3 p-3">
            <SidebarContent />
          </div>
        </aside>

        <section className="relative flex-1">
          {isLoading ? (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950">
              <div className="space-y-3 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-amber-400" />
                <p className="text-sm text-slate-400">
                  {mode === "graphrag"
                    ? "Loading GraphRAG data from PostgreSQL..."
                    : "Loading Graphify snapshot..."}
                </p>
                <p className="text-xs text-slate-500">Processing with Ollama {config.ollamaModel}</p>
              </div>
            </div>
          ) : (
            <GraphViewer />
          )}
          {!sidebarOpen && <FloatingDetails />}
        </section>
      </main>

      <FooterBar />
    </div>
  );
}

export default function HomePage() {
  return (
    <QueryClientProvider client={queryClient}>
      <PageContent />
    </QueryClientProvider>
  );
}


function ModeButton({
  active,
  onClick,
  icon,
  label,
  sublabel,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sublabel: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-all ${
        active
          ? "border border-amber-500/30 bg-amber-500/20 text-amber-300 shadow-sm"
          : "border border-transparent text-slate-400 hover:text-slate-200"
      }`}
    >
      {icon}
      <div className="flex flex-col items-start">
        <span className="leading-none">{label}</span>
        <span className={`mt-0.5 text-[9px] leading-none ${active ? "text-amber-400/70" : "text-slate-500"}`}>
          {sublabel}
        </span>
      </div>
    </button>
  );
}

function StatusBadge({
  label,
  value,
  color,
  emoji,
}: {
  label: string;
  value: string;
  color: string;
  emoji: string;
}) {
  return (
    <Badge variant="outline" className={`gap-1 border px-2 py-0.5 text-[10px] ${color}`}>
      <span>{emoji}</span>
      <span className="font-normal">{label}</span>
      <span className="font-medium">{value}</span>
    </Badge>
  );
}
