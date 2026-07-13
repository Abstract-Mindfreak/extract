"use client";

import { useState } from "react";
import { useGraphStore, ollamaModelOptions } from "@/store/graph-store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Database,
  Server,
  Key,
  FolderOpen,
  Loader2,
  CheckCircle2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import type { RenderMode } from "@/store/graph-store";

const SOURCE_TABLE_OPTIONS = [
  "tracks",
  "sessions",
  "music_blocks",
  "chat_sessions",
  "songs",
  "rag_chunks",
  "mmss_invariants",
  "mmss_phase_patterns",
  "mmss_domain_patterns",
  "mmss_skills",
  "mmss_skill_trees",
  "mmss_skill_sets",
  "mmss_collection",
  "mmss_albums",
  "mmss_filtered",
  "mmss_custom_instructions",
  "mmss_tracks_prompts",
];

const ANALYSIS_MODE_OPTIONS = [
  { value: "knowledge_synthesis", label: "Knowledge Synthesis" },
  { value: "skill_tree_pathfinding", label: "Skill Tree Pathfinding" },
  { value: "pattern_mining", label: "Pattern Mining" },
  { value: "cross_db_reconciliation", label: "Cross-DB Reconciliation" },
  { value: "mmss_invariants", label: "MMSS Invariants" },
];

export default function ConfigPanel() {
  const mode = useGraphStore((s) => s.mode);
  const config = useGraphStore((s) => s.config);
  const setConfig = useGraphStore((s) => s.setConfig);
  const setGraphData = useGraphStore((s) => s.setGraphData);
  const setStats = useGraphStore((s) => s.setStats);
  const setDocuments = useGraphStore((s) => s.setDocuments);
  const setFiles = useGraphStore((s) => s.setFiles);
  const [isTesting, setIsTesting] = useState(false);
  const [isIngesting, setIsIngesting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [processPath, setProcessPath] = useState("graph-workspace/src");
  const [importFilePath, setImportFilePath] = useState("exported_data/graphrag_input.json");
  const [importLimit, setImportLimit] = useState("10");
  const [selectedSourceTables, setSelectedSourceTables] = useState<string[]>(["tracks", "mmss_filtered", "mmss_invariants", "mmss_phase_patterns"]);
  const [analysisMode, setAnalysisMode] = useState("knowledge_synthesis");
  const [isBuildingGraph, setIsBuildingGraph] = useState(false);
  const [isMerging, setIsMerging] = useState(false);
  const [isDetectingCommunities, setIsDetectingCommunities] = useState(false);
  const selectedEdgeTypes = useGraphStore((s) => s.selectedEdgeTypes);
  const toggleEdgeType = useGraphStore((s) => s.toggleEdgeType);
  const setSelectedEdgeTypes = useGraphStore((s) => s.setSelectedEdgeTypes);
  const renderMode = useGraphStore((s) => s.renderMode);
  const setRenderMode = useGraphStore((s) => s.setRenderMode);
  const indexingStatus = useGraphStore((s) => s.indexingStatus);
  const setIndexingStatus = useGraphStore((s) => s.setIndexingStatus);

  const runtimePayload = {
    ollamaEndpoint: config.ollamaEndpoint,
    ollamaModel: config.ollamaModel,
  };

  const reloadGraph = async (targetMode: "graphrag" | "graphify") => {
    const endpoint = targetMode === "graphrag" ? "/api/graphrag/graph" : "/api/graphify/graph";
    const res = await fetch(endpoint);
    const data = await res.json();
    setGraphData(data.nodes || [], data.edges || [], data.communities || []);
    setStats(data.stats || null);
    setDocuments(data.documents || []);
    setFiles(data.files || []);
  };

  const testConnection = async () => {
    setIsTesting(true);
    try {
      const res = await fetch("/api", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(runtimePayload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Connection test failed");
      }

      toast.success("Connection test passed", {
        description: `PostgreSQL connected, Ollama model ${data.model} is available.`,
      });
    } catch (error) {
      toast.error("Connection test failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleIngest = async () => {
    if (!ingestTitle.trim()) return;
    setIsIngesting(true);
    try {
      const res = await fetch("/api/graphrag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: ingestTitle,
          content: ingestContent,
          fileType: "text",
          ...runtimePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Ingestion failed");
      }

      toast.success("Document ingested", {
        description: `${data.chunksCreated} chunks | ${data.nodesExtracted} nodes | ${data.edgesExtracted} edges`,
      });
      await reloadGraph("graphrag");
      setIngestTitle("");
      setIngestContent("");
    } catch (error) {
      toast.error("Ingestion failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsIngesting(false);
  };

  const handleProcess = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/graphify/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: processPath,
          mode: "standard",
          ...runtimePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Processing failed");
      }

      toast.success("Files processed with Graphify", {
        description: `${data.filesProcessed} files | ${data.nodesFound} nodes | ${data.edgesFound} edges | ${data.tokenReduction} token reduction`,
      });
      await reloadGraph("graphify");
    } catch (error) {
      toast.error("Processing failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsProcessing(false);
  };

  const handleImportFromDb = async () => {
    setIsImporting(true);
    try {
      const res = await fetch("/api/graphrag/ingest/from-db", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filePath: importFilePath,
          limit: importLimit ? parseInt(importLimit) : undefined,
          ...runtimePayload,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Import failed");
      }

      toast.success("Imported from PostgreSQL", {
        description: `${data.successful}/${data.total} documents imported successfully`,
      });
      await reloadGraph("graphrag");
    } catch (error) {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
    setIsImporting(false);
  };

  const [buildGraphController, setBuildGraphController] = useState<AbortController | null>(null);

  const handleBuildGraphFromDb = async () => {
    if (selectedSourceTables.length === 0) {
      toast.error("No source tables selected", {
        description: "Please select at least one source table to build the graph",
      });
      return;
    }

    const controller = new AbortController();
    setBuildGraphController(controller);
    setIsBuildingGraph(true);

    try {
      const res = await fetch("/api/graphrag/build-graph", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceTables: selectedSourceTables,
          analysisMode,
          ...runtimePayload,
        }),
        signal: controller.signal,
      });

      if (res.status === 499) { // Client closed request
        toast.info("Graph build cancelled by user.");
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Graph building failed");
      }

      toast.success("Graph built from PostgreSQL", {
        description: `${data.nodesExtracted} nodes | ${data.edgesExtracted} edges | ${data.communities} communities`,
      });
      await reloadGraph("graphrag");
    } catch (error: any) {
      if (error.name === 'AbortError') {
        toast.info("Graph build cancelled by user.");
      } else {
        toast.error("Graph building failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
      }
    } finally {
      setIsBuildingGraph(false);
      setBuildGraphController(null);
    }
  };

  const cancelBuildGraph = () => {
    if (buildGraphController) {
      buildGraphController.abort();
    }
  };


  const [mergeDuplicatesController, setMergeDuplicatesController] = useState<AbortController | null>(null);
  const [communityDetectionController, setCommunityDetectionController] = useState<AbortController | null>(null);


  const handleMergeDuplicates = async () => {
    const controller = new AbortController();
    setMergeDuplicatesController(controller);
    setIsMerging(true);

    try {
      const res = await fetch("/api/graphrag/merge-compress", {
        method: "POST",
        signal: controller.signal,
      });
      if (res.status === 499) { throw new Error("Merge cancelled by user."); }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Merge failed");
      }

      const totalMerged = data.mergeSummary.reduce((acc: number, s: any) => acc + s.mergedCount, 0);
      toast.success("Merge complete", {
        description: `Merged ${totalMerged} duplicate nodes across ${data.mergeSummary.length} types.`,
      });
      await reloadGraph("graphrag");
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Merge cancelled by user.') {
        toast.info("Merge process cancelled by user.");
      } else {
        toast.error("Merge failed", {
          description: error.message,
        });
      }
    } finally {
      setIsMerging(false);
      setMergeDuplicatesController(null);
    }
  };

  const cancelMergeDuplicates = () => {
    if (mergeDuplicatesController) {
      mergeDuplicatesController.abort();
    }
  };

  const handleRunCommunityDetection = async () => {
    const controller = new AbortController();
    setCommunityDetectionController(controller);
    setIsDetectingCommunities(true);
    try {
      const res = await fetch("/api/graphrag/run-community-detection", {
        method: "POST",
        signal: controller.signal,
      });
      if (res.status === 499) { throw new Error("Community detection cancelled by user."); }
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Community detection failed");
      }
      toast.success("Community detection complete", {
        description: data.message,
      });
      await reloadGraph("graphrag");
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'Community detection cancelled by user.') {
        toast.info("Community detection cancelled by user.");
      } else {
        toast.error("Community detection failed", {
          description: error.message,
        });
      }
    } finally {
      setIsDetectingCommunities(false);
      setCommunityDetectionController(null);
    }
  };

  const cancelCommunityDetection = () => {
    if (communityDetectionController) {
      communityDetectionController.abort();
    }
  };

  const toggleSourceTable = (table: string) => {
    setSelectedSourceTables((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table]
    );
  };

  return (
    <Card className="border-slate-700/50 bg-slate-900/80 backdrop-blur-sm">
      <CardHeader className="px-4 pb-3 pt-4">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-200">
          <Settings className="h-4 w-4 text-slate-400" />
          Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        <ScrollArea className="max-h-[calc(100vh-320px)]">
          <div className="space-y-4 pr-2">
            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Server className="h-3 w-3" /> Ollama LLM
              </p>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-400">Endpoint</Label>
                <Input
                  value={config.ollamaEndpoint}
                  onChange={(e) => setConfig({ ollamaEndpoint: e.target.value })}
                  className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                  placeholder="http://localhost:11434"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] text-slate-400">Model</Label>
                <Select
                  value={config.ollamaModel}
                  onValueChange={(value) =>
                    setConfig({ ollamaModel: value as (typeof ollamaModelOptions)[number] })
                  }
                >
                  <SelectTrigger className="h-8 border-slate-600/50 bg-slate-800/50 text-xs">
                    <SelectValue placeholder="Select model" />
                  </SelectTrigger>
                  <SelectContent>
                    {ollamaModelOptions.map((model) => (
                      <SelectItem key={model} value={model} className="text-xs">
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-full border-slate-600/50 text-xs text-slate-300"
                onClick={testConnection}
                disabled={isTesting}
              >
                {isTesting ? (
                  <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-3 w-3" />
                )}
                Test Connection
              </Button>
            </div>

            <Separator className="bg-slate-700/50" />

            <div className="space-y-2.5">
              <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                <Settings className="h-3 w-3" /> Render Mode
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-300">Minimal</span>
                  <Switch
                    checked={renderMode === "detailed"}
                    onCheckedChange={(value) =>
                      setRenderMode(value ? "detailed" : "minimal")
                    }
                    className="data-[state=checked]:bg-amber-500"
                  />
                  <span className="text-[11px] text-slate-300">Detailed</span>
                </div>
              </div>
              <div className="space-y-1 rounded-md bg-slate-800/40 p-2.5 text-[11px] text-slate-400">
                <p>Minimal: static layout, no physics, optimized for large graphs</p>
                <p>Detailed: full physics, animations, for small subgraphs</p>
              </div>
            </div>

            <Separator className="bg-slate-700/50" />

            {mode === "graphrag" ? (
              <div className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Database className="h-3 w-3" /> PostgreSQL abstract-mind-lab
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Host</Label>
                    <Input
                      value={config.dbHost}
                      onChange={(e) => setConfig({ dbHost: e.target.value })}
                      className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Port</Label>
                    <Input
                      value={config.dbPort}
                      onChange={(e) => setConfig({ dbPort: e.target.value })}
                      className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-400">Database</Label>
                  <Input
                    value={config.dbName}
                    onChange={(e) => setConfig({ dbName: e.target.value })}
                    className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">User</Label>
                    <Input
                      value={config.dbUser}
                      onChange={(e) => setConfig({ dbUser: e.target.value })}
                      className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-400">Password</Label>
                    <Input
                      type="password"
                      value={config.dbPassword}
                      onChange={(e) => setConfig({ dbPassword: e.target.value })}
                      className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <FolderOpen className="h-3 w-3" /> Graphify Storage
                </p>
                <div className="flex items-center justify-between">
                  <Label className="text-[11px] text-slate-400">Storage backend</Label>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-300">JSON</span>
                    <Switch
                      checked={config.dbType === "postgresql"}
                      onCheckedChange={(value) =>
                        setConfig({ dbType: value ? "postgresql" : "json" })
                      }
                      className="data-[state=checked]:bg-amber-500"
                    />
                    <span className="text-[11px] text-slate-300">PostgreSQL</span>
                  </div>
                </div>
                <div className="space-y-1 rounded-md bg-slate-800/40 p-2.5 text-[11px] text-slate-400">
                  <p>JSON: local graph files only</p>
                  <p>PG: store graph snapshots in abstract-mind-lab</p>
                </div>
              </div>
            )}

            <Separator className="bg-slate-700/50" />

            {mode === "graphrag" ? (
              <div className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Database className="h-3 w-3" /> Import from PostgreSQL
                </p>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-400">Export file path</Label>
                  <Input
                    value={importFilePath}
                    onChange={(e) => setImportFilePath(e.target.value)}
                    placeholder="exported_data/graphrag_input.json"
                    className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                  />
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-[11px] text-slate-400">Limit</Label>
                      <Input
                        value={importLimit}
                        onChange={(e) => setImportLimit(e.target.value)}
                        placeholder="10"
                        className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      className="h-7 mt-5 flex-1 bg-blue-600 text-xs hover:bg-blue-500"
                      onClick={handleImportFromDb}
                      disabled={isImporting}
                    >
                      {isImporting ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Upload className="mr-1.5 h-3 w-3" />
                      )}
                      Import
                    </Button>
                  </div>
                </div>
                <p className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Badge variant="outline" className="border-slate-600 px-1 py-0 text-[9px] text-slate-400">
                    pgvector
                  </Badge>
                  Import vectorized data from rag_chunks table
                </p>

                <Separator className="bg-slate-700/50" />

                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Database className="h-3 w-3" /> Build Graph from PostgreSQL
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Analysis Mode</Label>
                    <Select
                      value={analysisMode}
                      onValueChange={setAnalysisMode}
                    >
                      <SelectTrigger className="h-8 border-slate-600/50 bg-slate-800/50 text-xs">
                        <SelectValue placeholder="Select analysis mode" />
                      </SelectTrigger>
                      <SelectContent>
                        {ANALYSIS_MODE_OPTIONS.map((mode) => (
                          <SelectItem key={mode.value} value={mode.value} className="text-xs">
                            {mode.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Source Tables ({selectedSourceTables.length} selected)</Label>
                    <div className="grid grid-cols-2 gap-1.5 max-h-32 overflow-y-auto">
                      {SOURCE_TABLE_OPTIONS.map((table) => (
                        <button
                          key={table}
                          type="button"
                          onClick={() => toggleSourceTable(table)}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                            selectedSourceTables.includes(table)
                              ? "bg-blue-600/20 border-blue-500 text-blue-300"
                              : "bg-slate-800/50 border-slate-600/50 text-slate-400 hover:bg-slate-700/50"
                          }`}
                        >
                          {table}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 flex-1 bg-purple-600 text-xs hover:bg-purple-500"
                      onClick={handleBuildGraphFromDb}
                      disabled={isBuildingGraph || selectedSourceTables.length === 0}
                    >
                      {isBuildingGraph ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Database className="mr-1.5 h-3 w-3" />
                      )}
                      {isBuildingGraph ? 'Building...' : 'Run Full Graph Rebuild'}
                    </Button>
                    {isBuildingGraph && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={cancelBuildGraph}
                        >
                            Cancel
                        </Button>
                    )}
                  </div>
                </div>
                <p className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Badge variant="outline" className="border-slate-600 px-1 py-0 text-[9px] text-slate-400">
                    live
                  </Badge>
                  Build graph from selected PostgreSQL tables with analysis mode
                </p>

                <Separator className="bg-slate-700/50" />

                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Database className="h-3 w-3" /> Graph Maintenance
                  </p>
                  <div className="flex gap-2">
                    <Button
                        size="sm"
                        className="h-7 flex-1 bg-orange-600 text-xs hover:bg-orange-500"
                        onClick={handleMergeDuplicates}
                        disabled={isMerging}
                    >
                        {isMerging ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                        <Database className="mr-1.5 h-3 w-3" />
                        )}
                        {isMerging ? 'Merging...' : 'Merge Duplicates'}
                    </Button>
                    {isMerging && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={cancelMergeDuplicates}
                        >
                            Cancel
                        </Button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                        size="sm"
                        className="h-7 flex-1 bg-teal-600 text-xs hover:bg-teal-500"
                        onClick={handleRunCommunityDetection}
                        disabled={isDetectingCommunities}
                    >
                        {isDetectingCommunities ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                        <Database className="mr-1.5 h-3 w-3" />
                        )}
                        {isDetectingCommunities ? 'Detecting...' : 'Run Community Detection'}
                    </Button>
                    {isDetectingCommunities && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs border-red-500/50 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                            onClick={cancelCommunityDetection}
                        >
                            Cancel
                        </Button>
                    )}
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Database className="h-3 w-3" /> Chunk-Based Indexing
                  </p>
                  <Button
                    size="sm"
                    className="h-7 w-full bg-cyan-600 text-xs hover:bg-cyan-500"
                    onClick={() => toast.info("Chunk-based indexing not implemented yet.")}
                  >
                    Run Indexing Pipeline (Chunk-Based)
                  </Button>
                </div>

                <Separator className="bg-slate-700/50" />

                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Database className="h-3 w-3" /> Filter Edge Types
                  </p>
                  <div className="space-y-1.5">
                    <Label className="text-[11px] text-slate-400">Edge Types ({selectedEdgeTypes.length} selected)</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {["EXTRACTED", "KNOWLEDGE_SYNTHESIS", "SKILL_TREE_PATHFINDING", "PATTERN_MINING", "CROSS_DB_RECONCILIATION", "MMSS_INVARIANTS"].map((edgeType) => (
                        <button
                          key={edgeType}
                          type="button"
                          onClick={() => toggleEdgeType(edgeType)}
                          className={`text-[10px] px-2 py-1 rounded border transition-colors ${
                            selectedEdgeTypes.includes(edgeType)
                              ? "bg-purple-600/20 border-purple-500 text-purple-300"
                              : "bg-slate-800/50 border-slate-600/50 text-slate-400 hover:bg-slate-700/50"
                          }`}
                        >
                          {edgeType}
                        </button>
                      ))}
                    </div>
                    {selectedEdgeTypes.length > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 w-full border-slate-600/50 text-[10px] text-slate-300"
                        onClick={() => setSelectedEdgeTypes([])}
                      >
                        Reset Filters
                      </Button>
                    )}
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />

                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <Upload className="h-3 w-3" /> Manual Ingest
                </p>
                <div className="space-y-1.5">
                  <Input
                    value={ingestTitle}
                    onChange={(e) => setIngestTitle(e.target.value)}
                    placeholder="Document title"
                    className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                  />
                  <textarea
                    value={ingestContent}
                    onChange={(e) => setIngestContent(e.target.value)}
                    placeholder="Paste document content..."
                    className="h-20 w-full resize-none rounded-md border border-slate-600/50 bg-slate-800/50 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400/30"
                  />
                  <Button
                    size="sm"
                    className="h-7 w-full bg-emerald-600 text-xs hover:bg-emerald-500"
                    onClick={handleIngest}
                    disabled={isIngesting || !ingestTitle.trim()}
                  >
                    {isIngesting ? (
                      <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                    ) : (
                      <Key className="mr-1.5 h-3 w-3" />
                    )}
                    Ingest and Extract
                  </Button>
                </div>
                <p className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Badge variant="outline" className="border-slate-600 px-1 py-0 text-[9px] text-slate-400">
                    live
                  </Badge>
                  Uses the selected Ollama model and stores results in abstract-mind-lab
                </p>

                <Separator className="bg-slate-700/50" />

                <div className="space-y-2.5">
                  <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                    <Loader2 className="h-3 w-3" /> Indexing Status
                  </p>
                  <div className="space-y-1.5 rounded-md bg-slate-800/40 p-2.5 text-[11px]">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <span className="text-slate-400">Last Run:</span>
                        <span className="ml-1 text-slate-200">
                          {indexingStatus.lastIndexingRun
                            ? new Date(indexingStatus.lastIndexingRun).toLocaleString()
                            : "Never"}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Progress:</span>
                        <span className="ml-1 text-slate-200">{indexingStatus.progress}%</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Chunks:</span>
                        <span className="ml-1 text-slate-200">
                          {indexingStatus.chunksIndexed}/{indexingStatus.chunksTotal}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Embeddings:</span>
                        <span className="ml-1 text-slate-200">
                          {indexingStatus.embeddingsGenerated}/{indexingStatus.embeddingsTotal}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400">Entities:</span>
                        <span className="ml-1 text-slate-200">{indexingStatus.entitiesExtracted}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Relationships:</span>
                        <span className="ml-1 text-slate-200">{indexingStatus.relationshipsExtracted}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Merges:</span>
                        <span className="ml-1 text-slate-200">{indexingStatus.mergeOperationsPerformed}</span>
                      </div>
                      <div>
                        <span className="text-slate-400">Errors:</span>
                        <span className={`ml-1 ${indexingStatus.errors > 0 ? "text-red-400" : "text-slate-200"}`}>
                          {indexingStatus.errors}
                        </span>
                      </div>
                    </div>
                    {indexingStatus.currentStage && (
                      <div className="mt-2 pt-2 border-t border-slate-700/50">
                        <span className="text-slate-400">Current Stage:</span>
                        <span className="ml-1 text-blue-300">{indexingStatus.currentStage}</span>
                      </div>
                    )}
                  </div>
                </div>

                <Separator className="bg-slate-700/50" />
              </div>
            ) : (
              <div className="space-y-2.5">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                  <FolderOpen className="h-3 w-3" /> Process Files
                </p>
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-slate-400">Source path</Label>
                  <Input
                    value={processPath}
                    onChange={(e) => setProcessPath(e.target.value)}
                    placeholder="graph-workspace/src"
                    className="h-8 border-slate-600/50 bg-slate-800/50 text-xs"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 border-slate-600/50 text-xs text-slate-300"
                      onClick={handleProcess}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <FolderOpen className="mr-1.5 h-3 w-3" />
                      )}
                      Standard
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 flex-1 border-slate-600/50 text-xs text-slate-300"
                      onClick={() => toast.info("Deep mode is not implemented yet.")}
                      disabled={isProcessing}
                    >
                      Deep Mode
                    </Button>
                  </div>
                </div>
                <p className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Badge variant="outline" className="border-slate-600 px-1 py-0 text-[9px] text-slate-400">
                    live
                  </Badge>
                  Builds a file dependency graph in PostgreSQL and answers via the selected Ollama model
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
