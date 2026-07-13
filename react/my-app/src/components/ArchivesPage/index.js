import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Layout, Model } from 'flexlayout-react';
import {
  FaBoxArchive,
  FaCompactDisc,
  FaFolderOpen,
  FaMusic,
  FaRotate,
  FaShuffle,
  FaUpload,
} from 'react-icons/fa6';
import FilterPanel from '../FilterPanel';
import SessionDialog from '../SessionDialog';
import TrackTable from '../TrackTable';
import { APP_CONFIG } from '../../constants/app';
import { useTrackStore } from '../../hooks/useTrackStore';
import { useMMSSThemeAlbumGroupsWorkspaceService } from '../../services/MMSSThemeAlbumGroupsWorkspaceService';
import './styles.css';

const ARCHIVES_LAYOUT_STORAGE_KEY = 'mmss.archives.workspace.layout.v1';
const ARCHIVES_LAYOUT_SAVE_DEBOUNCE_MS = 400;

function buildArchivesWorkspaceLayout() {
  return {
    global: {
      tabEnableClose: false,
      tabEnablePopout: true,
      tabEnablePopoutIcon: true,
      splitterSize: 8,
      tabSetEnableCloseButton: false,
    },
    borders: [],
    layout: {
      type: 'column',
      weight: 100,
      children: [
        {
          type: 'tabset',
          id: 'archives-controls-tabset',
          weight: 18,
          selected: 0,
          children: [
            { id: 'archives-controls-tab', type: 'tab', name: 'Workspace Controls', component: 'archives-controls', enableClose: false, icon: 'archives-controls' },
          ],
        },
        {
          type: 'row',
          weight: 82,
          children: [
            {
              type: 'tabset',
              id: 'archives-filters-tabset',
              weight: 26,
              selected: 0,
              children: [
                { id: 'archives-filters-tab', type: 'tab', name: 'Filters', component: 'archives-filters', enableClose: false, icon: 'archives-filters' },
              ],
            },
            {
              type: 'tabset',
              id: 'archives-tracks-tabset',
              weight: 46,
              selected: 0,
              children: [
                { id: 'archives-tracks-tab', type: 'tab', name: 'Tracks', component: 'archives-tracks', enableClose: false, icon: 'archives-tracks' },
              ],
            },
            {
              type: 'tabset',
              id: 'archives-cover-tabset',
              weight: 28,
              selected: 0,
              children: [
                { id: 'archives-cover-tab', type: 'tab', name: 'Now Playing Cover', component: 'archives-cover', enableClose: false, icon: 'archives-cover' },
              ],
            },
          ],
        },
      ],
    },
  };
}

function readSavedArchivesLayout() {
  try {
    const raw = window.localStorage.getItem(ARCHIVES_LAYOUT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function writeSavedArchivesLayout(layoutJson) {
  try {
    window.localStorage.setItem(ARCHIVES_LAYOUT_STORAGE_KEY, JSON.stringify(layoutJson));
  } catch (_error) {
    // Ignore storage failures and keep the workspace usable.
  }
}

function resolveArchivesTabIcon(icon) {
  const common = { size: 14 };
  switch (icon) {
    case 'archives-controls':
      return <FaBoxArchive {...common} />;
    case 'archives-filters':
      return <FaFolderOpen {...common} />;
    case 'archives-tracks':
      return <FaMusic {...common} />;
    case 'archives-cover':
      return <FaCompactDisc {...common} />;
    default:
      return <FaBoxArchive {...common} />;
  }
}

function ArchivesFiltersTab() {
  return (
    <div className="archives-tab-shell">
      <FilterPanel />
    </div>
  );
}

function ArchivesControlsTab({
  albumDraft,
  handleAddSelectionToGroup,
  handleAlbumDraftChange,
  handleCreateGroupFromSelection,
  handleImportArchiveData,
  handleInitMockData,
  handleRemoveSelectionFromGroup,
  handleRefreshGroups,
  isLoading,
  loadTracks,
  resetWorkspaceLayout,
  saveWorkspaceLayout,
  selectedGroupDetails,
  selectedGroupId,
  selectedTracksCount,
  setSelectedGroupId,
  selectionMode,
  setSelectionMode,
  themeGroups,
  trackTitleMap,
  workspaceSummary,
}) {
  return (
    <div className="archives-tab-shell archives-controls-shell">
      <header className="archives-header archives-header--tab">
        <div className="archives-header__copy">
          <h1><FaBoxArchive /> {APP_CONFIG.name}</h1>
          <p>Browse imported tracks, inspect sessions, and manage archive data without leaving the unified workspace.</p>
          <small className="archives-header__meta">{workspaceSummary}</small>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadTracks} disabled={isLoading}>
            <FaRotate />
            Refresh
          </button>
          <button className="btn-secondary" onClick={saveWorkspaceLayout}>
            <FaCompactDisc />
            Save Layout
          </button>
          <button className="btn-secondary" onClick={resetWorkspaceLayout}>
            <FaRotate />
            Reset Layout
          </button>
          <button className="btn-secondary" onClick={handleInitMockData} disabled={isLoading}>
            <FaShuffle />
            Load Mock Data
          </button>
          <button className="btn-primary" onClick={handleImportArchiveData} disabled={isLoading}>
            <FaUpload />
            Import Archive Data
          </button>
        </div>
      </header>

      <section className="archives-album-tools">
        <div className="archives-album-tools__header">
          <strong>Theme Albums</strong>
          <small>Manual assignment for archive tracks and current theme-album groups.</small>
        </div>
        <div className="archives-album-tools__controls">
          <label className="archives-checkbox">
            <input
              type="checkbox"
              checked={selectionMode}
              onChange={(event) => setSelectionMode(event.target.checked)}
            />
            <span>Show track checkboxes</span>
          </label>
          <button className="btn-secondary" onClick={handleRefreshGroups}>
            <FaRotate />
            Refresh Albums
          </button>
          <span className="archives-pill">Selected tracks: {selectedTracksCount}</span>
        </div>
        <div className="archives-album-tools__grid">
          <label>
            <span>Existing album / theme</span>
            <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
              <option value="">Select album</option>
              {themeGroups.map((group) => (
                <option key={group.group_id} value={group.group_id}>
                  {group.title}
                </option>
              ))}
            </select>
          </label>
          <button className="btn-primary" onClick={handleAddSelectionToGroup} disabled={!selectedGroupId || !selectedTracksCount}>
            Add selected to album
          </button>
          <button className="btn-secondary" onClick={handleRemoveSelectionFromGroup} disabled={!selectedGroupId || !selectedTracksCount}>
            Remove selected from album
          </button>
          <label>
            <span>New album title</span>
            <input
              value={albumDraft.title}
              onChange={(event) => handleAlbumDraftChange('title', event.target.value)}
              placeholder="New theme album title"
            />
          </label>
          <label>
            <span>Genre / direction</span>
            <input
              value={albumDraft.genre}
              onChange={(event) => handleAlbumDraftChange('genre', event.target.value)}
              placeholder="psytrance / metal core / ritual..."
            />
          </label>
          <button className="btn-primary" onClick={handleCreateGroupFromSelection} disabled={!albumDraft.title.trim() || !selectedTracksCount}>
            Create album from selection
          </button>
        </div>
        {selectedGroupDetails ? (
          <div className="archives-album-tools__details">
            <strong>{selectedGroupDetails.group.title}</strong>
            <small>
              {selectedGroupDetails.stats?.linked_count || 0} linked track(s)
              {selectedGroupDetails.group.genre ? ` • ${selectedGroupDetails.group.genre}` : ''}
            </small>
            <div className="archives-album-tools__chips">
              {(selectedGroupDetails.links || []).slice(0, 12).map((link) => (
                <span key={link.link_id || link.track_id} className="archives-pill">
                  {trackTitleMap[link.track_id] || link.track_id}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ArchivesTracksTab({
  albumDraft,
  filteredTracks,
  handleAddSelectionToGroup,
  handleAlbumDraftChange,
  handleCreateGroupFromSelection,
  handleImportArchiveData,
  handleRemoveSelectionFromGroup,
  handleSessionClick,
  handleInitMockData,
  isLoading,
  loadTracks,
  selectedGroupId,
  selectionMode,
  setSelectionMode,
  setSelectedGroupId,
  themeGroups,
  trackGroupMap,
}) {
  if (isLoading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading archive data...</p>
      </div>
    );
  }

  if (filteredTracks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">♪</div>
        <h3>No tracks yet</h3>
        <p>Import archive data from live FlowMusic backups or load mock content to start working inside the archive workspace.</p>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadTracks}>
            <FaRotate />
            Refresh
          </button>
          <button className="btn-secondary" onClick={handleInitMockData}>
            <FaShuffle />
            Load Mock Data
          </button>
          <button className="btn-primary" onClick={handleImportArchiveData}>
            <FaUpload />
            Import Archive Data
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="archives-tab-shell archives-tab-shell--tracks">
      <div className="archives-tracks-toolbar">
        <button className="btn-secondary" onClick={() => setSelectionMode(!selectionMode)}>
          {selectionMode ? 'Hide selection mode' : 'Show selection mode'}
        </button>
      </div>
      <TrackTable
        onSessionClick={handleSessionClick}
        showSelection={selectionMode}
        trackGroupMap={trackGroupMap}
        selectionActions={selectionMode ? {
          albumDraft,
          handleAddSelectionToGroup,
          handleAlbumDraftChange,
          handleCreateGroupFromSelection,
          handleRemoveSelectionFromGroup,
          selectedGroupId,
          setSelectedGroupId,
          themeGroups,
        } : null}
      />
    </div>
  );
}

function ArchivesCoverTab({ currentTrack }) {
  if (!currentTrack) {
    return (
      <div className="empty-state archives-cover-empty">
        <div className="empty-icon">◼</div>
        <h3>No track playing</h3>
        <p>Select or play a track to pin its cover art in this tab.</p>
      </div>
    );
  }

  return (
    <div className="archives-cover-panel">
      <img
        src={currentTrack.coverUrl || '/default-cover.png'}
        alt={currentTrack.title}
        className="archives-cover-image"
        onError={(event) => { event.target.src = '/default-cover.png'; }}
      />
      <div className="archives-cover-meta">
        <strong>{currentTrack.title}</strong>
        <span>{currentTrack.accountId || 'unknown account'}</span>
      </div>
    </div>
  );
}

export default function ArchivesPage() {
  const themeAlbumService = useMMSSThemeAlbumGroupsWorkspaceService();
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [themeGroups, setThemeGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [selectedGroupDetails, setSelectedGroupDetails] = useState(null);
  const [trackGroupMap, setTrackGroupMap] = useState({});
  const [albumDraft, setAlbumDraft] = useState({ title: '', genre: '' });
  const [workspaceModel, setWorkspaceModel] = useState(() =>
    Model.fromJson(readSavedArchivesLayout() || buildArchivesWorkspaceLayout()),
  );
  const layoutSaveTimerRef = useRef(null);

  const {
    currentTrack,
    isLoading,
    filteredTracks,
    initMockData,
    loadTracks,
    importLocalData,
    pagination,
    selectedTracks,
    tracks,
    deselectAll,
  } = useTrackStore();

  const handleSessionClick = (track) => {
    setSelectedTrack(track);
    setShowSessionDialog(true);
  };

  const handleCloseDialog = () => {
    setShowSessionDialog(false);
    setSelectedTrack(null);
  };

  const handleInitMockData = useCallback(async () => {
    await initMockData((loaded, total, entity) => {
      console.log(`Loading ${entity}: ${loaded}/${total}`);
    });
  }, [initMockData]);

  const handleImportArchiveData = useCallback(async () => {
    try {
      const result = await importLocalData((progress) => {
        console.log(`[${progress.stage}] ${progress.message} (${progress.current}/${progress.total})`);
      });

      alert(`Import complete.\nTracks: ${result.tracksImported}\nSessions: ${result.sessionsImported}`);
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  }, [importLocalData]);

  const handleAlbumDraftChange = useCallback((field, value) => {
    setAlbumDraft((current) => ({ ...current, [field]: value }));
  }, []);

  const refreshThemeGroups = useCallback(async (preferredGroupId = '') => {
    const groups = await themeAlbumService.listGroups('abstract-mind-lab');
    setThemeGroups(groups);
    const nextGroupId = preferredGroupId || selectedGroupId || groups[0]?.group_id || '';
    setSelectedGroupId(nextGroupId);
    if (nextGroupId) {
      const details = await themeAlbumService.getGroup('abstract-mind-lab', nextGroupId);
      setSelectedGroupDetails(details);
    } else {
      setSelectedGroupDetails(null);
    }
  }, [selectedGroupId, themeAlbumService]);

  const handleAddSelectionToGroup = useCallback(async () => {
    if (!selectedGroupId || !selectedTracks.size) return;
    const groupDetails = selectedGroupDetails || await themeAlbumService.getGroup('abstract-mind-lab', selectedGroupId);
    let positionIndex = groupDetails?.links?.length || 0;
    for (const trackId of selectedTracks) {
      await themeAlbumService.addTrackToGroup(selectedGroupId, {
        database: 'abstract-mind-lab',
        track_id: trackId,
        position_index: positionIndex,
        assignment_source: 'archives_manual',
        is_confirmed: true,
      });
      positionIndex += 1;
    }
    deselectAll();
    await refreshThemeGroups(selectedGroupId);
  }, [deselectAll, refreshThemeGroups, selectedGroupDetails, selectedGroupId, selectedTracks, themeAlbumService]);

  const handleCreateGroupFromSelection = useCallback(async () => {
    if (!albumDraft.title.trim() || !selectedTracks.size) return;
    const created = await themeAlbumService.createGroup({
      database: 'abstract-mind-lab',
      title: albumDraft.title.trim(),
      genre: albumDraft.genre.trim(),
      direction: albumDraft.genre.trim(),
      goal: `Manual archive grouping for ${albumDraft.title.trim()}`,
      target_track_count: selectedTracks.size,
      assembly_algorithm: 'manual_archives_curated',
      auto_assign: false,
      confirm_with_llm: false,
      model: 'mmss-qwen2.5-3b:latest',
    });
    setAlbumDraft({ title: '', genre: '' });
    setSelectedGroupId(created.group_id);
    for (const [index, trackId] of Array.from(selectedTracks).entries()) {
      await themeAlbumService.addTrackToGroup(created.group_id, {
        database: 'abstract-mind-lab',
        track_id: trackId,
        position_index: index,
        assignment_source: 'archives_manual',
        is_confirmed: true,
      });
    }
    deselectAll();
    await refreshThemeGroups(created.group_id);
  }, [albumDraft.genre, albumDraft.title, deselectAll, refreshThemeGroups, selectedTracks, themeAlbumService]);

  const handleRemoveSelectionFromGroup = useCallback(async () => {
    if (!selectedGroupId || !selectedTracks.size) return;
    for (const trackId of selectedTracks) {
      await themeAlbumService.deleteTrackFromGroup('abstract-mind-lab', selectedGroupId, trackId);
    }
    deselectAll();
    await refreshThemeGroups(selectedGroupId);
  }, [deselectAll, refreshThemeGroups, selectedGroupId, selectedTracks, themeAlbumService]);

  useEffect(() => {
    const loadData = async () => {
      try {
        await loadTracks();
      } catch {
        await handleInitMockData();
      }
    };

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
    }
  }, []);

  useEffect(() => {
    refreshThemeGroups().catch(() => {});
  }, [refreshThemeGroups]);

  useEffect(() => {
    let cancelled = false;
    async function syncSelectedGroup() {
      if (!selectedGroupId) {
        if (!cancelled) setSelectedGroupDetails(null);
        return;
      }
      try {
        const details = await themeAlbumService.getGroup('abstract-mind-lab', selectedGroupId);
        if (!cancelled) {
          setSelectedGroupDetails(details);
        }
      } catch (_error) {
        if (!cancelled) {
          setSelectedGroupDetails(null);
        }
      }
    }
    syncSelectedGroup();
    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, themeAlbumService]);

  const visibleTrackIds = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredTracks.slice(start, end).map((track) => String(track.id || '')).filter(Boolean);
  }, [filteredTracks, pagination.page, pagination.pageSize]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemberships() {
      if (!visibleTrackIds.length) {
        if (!cancelled) setTrackGroupMap({});
        return;
      }
      try {
        const memberships = await themeAlbumService.listMemberships('abstract-mind-lab', visibleTrackIds);
        if (!cancelled) {
          setTrackGroupMap(memberships || {});
        }
      } catch (_error) {
        if (!cancelled) {
          setTrackGroupMap({});
        }
      }
    }
    loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [themeAlbumService, themeGroups.length, visibleTrackIds]);

  const persistWorkspaceLayout = useCallback((nextModel) => {
    const nextJson = nextModel.toJson();
    if (layoutSaveTimerRef.current) {
      window.clearTimeout(layoutSaveTimerRef.current);
    }
    layoutSaveTimerRef.current = window.setTimeout(() => {
      writeSavedArchivesLayout(nextJson);
    }, ARCHIVES_LAYOUT_SAVE_DEBOUNCE_MS);
  }, []);

  const saveWorkspaceLayout = useCallback(() => {
    writeSavedArchivesLayout(workspaceModel.toJson());
  }, [workspaceModel]);

  const resetWorkspaceLayout = useCallback(() => {
    const nextModel = Model.fromJson(buildArchivesWorkspaceLayout());
    setWorkspaceModel(nextModel);
    writeSavedArchivesLayout(nextModel.toJson());
  }, []);

  const workspaceSummary = useMemo(() => (
    currentTrack
      ? `Now playing: ${currentTrack.title}`
      : 'No active track. Play a track to update the cover tab.'
  ), [currentTrack]);
  const trackTitleMap = useMemo(
    () => Object.fromEntries(tracks.map((track) => [track.id, track.title])),
    [tracks],
  );

  const workspaceFactory = useCallback((node) => {
    const component = node.getComponent();
    if (component === 'archives-controls') {
      return (
        <ArchivesControlsTab
          albumDraft={albumDraft}
          handleAddSelectionToGroup={handleAddSelectionToGroup}
          handleAlbumDraftChange={handleAlbumDraftChange}
          handleCreateGroupFromSelection={handleCreateGroupFromSelection}
          handleImportArchiveData={handleImportArchiveData}
          handleInitMockData={handleInitMockData}
          handleRemoveSelectionFromGroup={handleRemoveSelectionFromGroup}
          handleRefreshGroups={() => refreshThemeGroups(selectedGroupId)}
          isLoading={isLoading}
          loadTracks={loadTracks}
          resetWorkspaceLayout={resetWorkspaceLayout}
          saveWorkspaceLayout={saveWorkspaceLayout}
          selectedGroupDetails={selectedGroupDetails}
          selectedGroupId={selectedGroupId}
          selectedTracksCount={selectedTracks.size}
          setSelectedGroupId={setSelectedGroupId}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          themeGroups={themeGroups}
          trackTitleMap={trackTitleMap}
          workspaceSummary={workspaceSummary}
        />
      );
    }
    if (component === 'archives-filters') {
      return <ArchivesFiltersTab />;
    }
    if (component === 'archives-tracks') {
      return (
        <ArchivesTracksTab
          albumDraft={albumDraft}
          filteredTracks={filteredTracks}
          handleAddSelectionToGroup={handleAddSelectionToGroup}
          handleAlbumDraftChange={handleAlbumDraftChange}
          handleCreateGroupFromSelection={handleCreateGroupFromSelection}
          handleImportArchiveData={handleImportArchiveData}
          handleRemoveSelectionFromGroup={handleRemoveSelectionFromGroup}
          handleInitMockData={handleInitMockData}
          handleSessionClick={handleSessionClick}
          isLoading={isLoading}
          loadTracks={loadTracks}
          selectedGroupId={selectedGroupId}
          selectionMode={selectionMode}
          setSelectionMode={setSelectionMode}
          setSelectedGroupId={setSelectedGroupId}
          themeGroups={themeGroups}
          trackGroupMap={trackGroupMap}
        />
      );
    }
    if (component === 'archives-cover') {
      return <ArchivesCoverTab currentTrack={currentTrack} />;
    }
    return <div className="archives-tab-shell">Unknown archives panel: {component}</div>;
  }, [albumDraft, currentTrack, filteredTracks, handleAddSelectionToGroup, handleAlbumDraftChange, handleCreateGroupFromSelection, handleImportArchiveData, handleInitMockData, handleRemoveSelectionFromGroup, isLoading, loadTracks, refreshThemeGroups, resetWorkspaceLayout, saveWorkspaceLayout, selectedGroupDetails, selectedGroupId, selectedTracks.size, selectionMode, themeGroups, trackGroupMap, trackTitleMap, workspaceSummary]);

  return (
    <div className="archives-page">
      <div className="archives-workspace-shell">
        <Layout
          factory={workspaceFactory}
          model={workspaceModel}
          onRenderTab={(node, renderValues) => {
            renderValues.leading = resolveArchivesTabIcon(node.getConfig()?.icon);
          }}
          onModelChange={(nextModel) => {
            setWorkspaceModel(nextModel);
            persistWorkspaceLayout(nextModel);
          }}
        />
      </div>
      {showSessionDialog ? (
        <SessionDialog track={selectedTrack} onClose={handleCloseDialog} />
      ) : null}
    </div>
  );
}
