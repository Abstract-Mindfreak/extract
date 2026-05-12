import React, { useEffect, useState } from 'react';
import FilterPanel from '../FilterPanel';
import PlayerBar from '../PlayerBar';
import SessionDialog from '../SessionDialog';
import TrackTable from '../TrackTable';
import { APP_CONFIG } from '../../constants/app';
import { useTrackStore } from '../../hooks/useTrackStore';
import './styles.css';

export default function ArchivesPage() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);

  const {
    isLoading,
    filteredTracks,
    initMockData,
    loadTracks,
    importLocalData,
  } = useTrackStore();

  const handleSessionClick = (track) => {
    setSelectedTrack(track);
    setShowSessionDialog(true);
  };

  const handleCloseDialog = () => {
    setShowSessionDialog(false);
    setSelectedTrack(null);
  };

  const handleInitMockData = async () => {
    await initMockData((loaded, total, entity) => {
      console.log(`Loading ${entity}: ${loaded}/${total}`);
    });
  };

  const handleImportLocalData = async () => {
    try {
      const result = await importLocalData((progress) => {
        console.log(`[${progress.stage}] ${progress.message} (${progress.current}/${progress.total})`);
      });

      alert(`Import complete.\nTracks: ${result.tracksImported}\nSessions: ${result.sessionsImported}`);
    } catch (error) {
      alert(`Import failed: ${error.message}`);
    }
  };

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

  return (
    <div className="archives-page">
      <header className="archives-header">
        <div className="archives-header__copy">
          <h1>{APP_CONFIG.name}</h1>
          <p>Browse imported tracks, inspect sessions, and manage archive data without leaving the unified workspace.</p>
        </div>
        <div className="header-actions">
          <button className="btn-secondary" onClick={loadTracks} disabled={isLoading}>
            Refresh
          </button>
          <button className="btn-secondary" onClick={handleInitMockData} disabled={isLoading}>
            Load Mock Data
          </button>
          <button className="btn-primary" onClick={handleImportLocalData} disabled={isLoading}>
            Import Local Data
          </button>
        </div>
      </header>

      <div className="archives-layout">
        <aside className="archives-sidebar">
          <FilterPanel />
        </aside>

        <main className="archives-content">
          {isLoading ? (
            <div className="loading-state">
              <div className="spinner" />
              <p>Loading archive data...</p>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">♪</div>
              <h3>No tracks yet</h3>
              <p>Import archive data or load mock content to start working inside the archive workspace.</p>
              <button className="btn-primary" onClick={handleInitMockData}>
                Load Mock Data
              </button>
            </div>
          ) : (
            <TrackTable onSessionClick={handleSessionClick} />
          )}
        </main>
      </div>

      <PlayerBar />

      {showSessionDialog ? (
        <SessionDialog track={selectedTrack} onClose={handleCloseDialog} />
      ) : null}
    </div>
  );
}
