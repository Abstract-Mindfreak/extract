import { useEffect } from 'react';
import { CollapsiblePanel, usePanelGroup } from '@/components/CollapsiblePanel';
import { SystemStatusDashboard } from '@/components/SystemStatusDashboard';
import { ExportPanel } from '@/components/ExportPanel';
import { ImportPanel } from '@/components/ImportPanel';
import { MistralCoordinationPanel } from '@/components/MistralCoordinationPanel';
import { MMSSRuntimePanel } from '@/components/MMSSRuntimePanel';
import { PromptEditor } from '@/components/PromptEditor';
import { PromptList } from '@/components/PromptList';
import { SequencePresetsPanel } from '@/components/SequencePresetsPanel';
import { TagKeyExplorer } from '@/components/TagKeyExplorer';
import { SessionPanel } from '@/components/SessionPanel';
import { usePrompts } from '@/hooks/usePrompts';
import { usePromptStore } from '@/store/promptStore';
import { useSessionImporter } from '@/hooks/useSessionImporter';
import type { ElementTagBinding, ExportPreset, KeySequencePreset, TagRegistry } from '@/types/meta';

const App = () => {
  const { filteredPrompts, prompts, selectedPrompt, selectedPromptTags, tagsByPromptId } = usePrompts();
  const filters = usePromptStore((state) => state.filters);
  const selectedPromptId = usePromptStore((state) => state.selectedPromptId);
  const wsStatus = usePromptStore((state) => state.wsStatus);
  const importLog = usePromptStore((state) => state.importLog);
  const tagRegistry = usePromptStore((state) => state.tagRegistry);
  const elementTagBindings = usePromptStore((state) => state.elementTagBindings);
  const keySequencePresets = usePromptStore((state) => state.keySequencePresets);
  const exportPresets = usePromptStore((state) => state.exportPresets);
  const loadPrompts = usePromptStore((state) => state.loadPrompts);
  const loadMetaState = usePromptStore((state) => state.loadMetaState);
  const saveMetaState = usePromptStore((state) => state.saveMetaState);
  const setSelectedPrompt = usePromptStore((state) => state.setSelectedPrompt);
  const setFilters = usePromptStore((state) => state.setFilters);
  const savePrompt = usePromptStore((state) => state.savePrompt);
  const deletePrompt = usePromptStore((state) => state.deletePrompt);
  const importRawJson = usePromptStore((state) => state.importRawJson);
  const resetDatabase = usePromptStore((state) => state.resetDatabase);
  const setWsStatus = usePromptStore((state) => state.setWsStatus);

  useEffect(() => {
    void loadPrompts();
    void loadMetaState();

    if (!window.electronAPI) {
      return;
    }

    void window.electronAPI.getWsStatus().then(setWsStatus);

    const unsubscribeImport = window.electronAPI.onImportedJson((payload) => {
      void importRawJson(payload.rawJson, payload.source).catch((error) => {
        console.error('Failed to import websocket payload', error);
      });
      void window.electronAPI?.getWsStatus().then(setWsStatus);
    });
    const unsubscribeWs = window.electronAPI.onWsStatus((payload) => {
      setWsStatus(payload);
    });

    return () => {
      unsubscribeImport();
      unsubscribeWs();
    };
  }, [importRawJson, loadMetaState, loadPrompts, setWsStatus]);

  const handleImportFile = async () => {
    const results = await window.electronAPI?.openJsonFile();

    if (!results || results.length === 0) {
      return;
    }

    try {
      for (const result of results) {
        await importRawJson(result.content, result.filePath);
      }
    } catch (error) {
      console.error('Failed to import file', error);
    }
  };

  const handleRunSyncSelfTest = async () => {
    if (!window.electronAPI) {
      return;
    }

    await window.electronAPI.runWsSelfTest();
    const status = await window.electronAPI.getWsStatus();
    setWsStatus(status);
  };

  const handleImportGenerated = async (blocks: any[], intent: string) => {
    // Treat the generated block set as a single import source
    const rawJson = JSON.stringify(blocks);
    await importRawJson(rawJson, `mmss-v3:${intent}`);
  };

  const persistRegistryAndBindings = async (
    nextTagRegistry: TagRegistry,
    nextBindings: ElementTagBinding[],
  ) => {
    await saveMetaState({
      tagRegistry: nextTagRegistry,
      elementTagBindings: nextBindings,
    });
  };

  const persistSequencePresets = async (presets: KeySequencePreset[]) => {
    await saveMetaState({
      keySequencePresets: presets,
    });
  };

  const persistExportPresets = async (presets: ExportPreset[]) => {
    await saveMetaState({
      exportPresets: presets,
    });
  };

  // Φ_total(session:hook) — активируем обработчик сессий
  useSessionImporter();

  const resolvePromptTags = (promptId: string) =>
    (tagsByPromptId.get(promptId) ?? [])
      .map((tagId) => tagRegistry.tags.find((tag) => tag.id === tagId))
      .filter((tag): tag is (typeof tagRegistry.tags)[number] => tag !== undefined);

  // Φ_total(ui:collapse) — управление группой панелей
  const { expandAll, collapseAll } = usePanelGroup([
    'system-status',
    'import-flow',
    'tag-explorer',
    'sequence-presets',
    'prompt-editor',
    'mmss-runtime',
    'export-panel',
    'mistral-history',
    'ai-sessions',
  ]);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">Local Prompt Organism — Φ_total(collapsible)</p>
          <h1>Electron prompt laboratory with AI session intelligence</h1>
        </div>
        <p className="hero-copy">
          A local-first workspace for importing strict JSON fragments, curating tags and sequences,
          and generating clean prompt batches. Now with Mistral AI-powered session analysis
          and collapsible interface for focused workflow.
        </p>
        
        {/* Φ_total(ui:controls) — глобальные контролы панелей */}
        <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
          <button 
            onClick={expandAll}
            style={{ padding: '6px 12px', fontSize: '0.85em', background: '#2a2a4e', border: '1px solid #00d4aa', color: '#00d4aa', borderRadius: '4px', cursor: 'pointer' }}
          >
            📂 Expand All
          </button>
          <button 
            onClick={collapseAll}
            style={{ padding: '6px 12px', fontSize: '0.85em', background: '#2a2a4e', border: '1px solid #00d4aa', color: '#00d4aa', borderRadius: '4px', cursor: 'pointer' }}
          >
            📁 Collapse All
          </button>
        </div>
      </section>

      <section className="layout-grid">
        <PromptList
          prompts={filteredPrompts}
          selectedPromptId={selectedPromptId}
          searchQuery={filters.query}
          resolveTags={resolvePromptTags}
          onSearchChange={(value) => setFilters({ query: value })}
          onSelectPrompt={setSelectedPrompt}
        />

        <div className="content-column">
          {/* Φ_total(status:dashboard) — системный мониторинг */}
          <CollapsiblePanel
            id="system-status"
            title="System Status"
            eyebrow="Telemetry"
            badge={wsStatus.state === 'listening' ? 'Healthy' : 'Check'}
            badgeType={wsStatus.state === 'listening' ? 'success' : 'warning'}
            defaultExpanded={false}
          >
            <SystemStatusDashboard />
          </CollapsiblePanel>

          {/* Import Flow — сворачиваемая панель */}
          <CollapsiblePanel
            id="import-flow"
            title="Import Flow"
            eyebrow="Ingress"
            badge={wsStatus.state === 'listening' ? 'Live' : 'Down'}
            badgeType={wsStatus.state === 'listening' ? 'success' : 'error'}
            defaultExpanded={false}
          >
            <ImportPanel
              wsState={wsStatus.state}
              wsPort={wsStatus.port}
              lastWsMessageAt={wsStatus.lastMessageAt}
              lastWsSource={wsStatus.lastSource}
              importLog={importLog}
              onImportFile={handleImportFile}
              onResetDatabase={resetDatabase}
              onRunSyncSelfTest={handleRunSyncSelfTest}
            />
          </CollapsiblePanel>

          {/* Tag Explorer */}
          <CollapsiblePanel
            id="tag-explorer"
            title="Tag & Key Explorer"
            eyebrow="Curation"
            badge={`${tagRegistry.tags.length} tags`}
            defaultExpanded={false}
          >
            <TagKeyExplorer
              prompts={prompts}
              tagRegistry={tagRegistry}
              bindings={elementTagBindings}
              onPersist={persistRegistryAndBindings}
            />
          </CollapsiblePanel>

          {/* Sequence Presets */}
          <CollapsiblePanel
            id="sequence-presets"
            title="Sequence Presets"
            eyebrow="Patterns"
            badge={`${keySequencePresets.length} presets`}
            defaultExpanded={false}
          >
            <SequencePresetsPanel
              prompts={prompts}
              presets={keySequencePresets}
              onPersist={persistSequencePresets}
            />
          </CollapsiblePanel>

          {/* Prompt Editor */}
          <CollapsiblePanel
            id="prompt-editor"
            title="Prompt Editor"
            eyebrow="Editor"
            badge={selectedPrompt ? 'Active' : 'Idle'}
            badgeType={selectedPrompt ? 'success' : 'default'}
            defaultExpanded={false}
          >
            <PromptEditor
              prompt={selectedPrompt}
              promptTags={selectedPromptTags}
              onSave={async (draft) => {
                await savePrompt(draft);
              }}
              onDelete={deletePrompt}
            />
          </CollapsiblePanel>

          {/* MMSS Runtime */}
          <CollapsiblePanel
            id="mmss-runtime"
            title="MMSS Runtime"
            eyebrow="Python Engine"
            badge="V3"
            defaultExpanded={false}
          >
            <MMSSRuntimePanel 
              onImportGenerated={handleImportGenerated}
            />
          </CollapsiblePanel>

          {/* Export Panel */}
          <CollapsiblePanel
            id="export-panel"
            title="Export Composer"
            eyebrow="Egress"
            badge={`${exportPresets.length} presets`}
            defaultExpanded={true}
          >
            <ExportPanel
              prompts={prompts}
              tagRegistry={tagRegistry}
              bindings={elementTagBindings}
              sequencePresets={keySequencePresets}
              exportPresets={exportPresets}
              onPersistPresets={persistExportPresets}
            />
          </CollapsiblePanel>

          <CollapsiblePanel
            id="mistral-history"
            title="Mistral History"
            eyebrow="Memory"
            badge="Planner Log"
            defaultExpanded={false}
          >
            <MistralCoordinationPanel />
          </CollapsiblePanel>

          {/* AI Sessions — панель сессий */}
          <CollapsiblePanel
            id="ai-sessions"
            title="🧠 AI Session Intelligence"
            eyebrow="Φ_total(mistral)"
            badge="Mistral"
            badgeType="success"
            defaultExpanded={true}
            headerActions={
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  window.open('https://console.mistral.ai/', '_blank');
                }}
                style={{ padding: '4px 10px', fontSize: '0.75em', background: '#00d4aa', color: '#1a1a2e', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                API Console
              </button>
            }
          >
            <SessionPanel
              onApplySuggestion={(suggestion) => {
                console.log('Φ_total(suggestion:applied)', suggestion);
              }}
              onExportSession={(session) => {
                console.log('Φ_total(session:exported)', session);
              }}
            />
          </CollapsiblePanel>
        </div>
      </section>
    </main>
  );
};

export default App;
