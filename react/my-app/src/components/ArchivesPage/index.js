import React, { useState, useEffect } from 'react';
import TrackTable from '../TrackTable';
import FilterPanel from '../FilterPanel';
import SessionDialog from '../SessionDialog';
import PlayerBar from '../PlayerBar';
import { useTrackStore } from '../../hooks/useTrackStore';
import { APP_CONFIG } from '../../constants/app';
import './styles.css';

export default function ArchivesPage() {
  const [selectedTrack, setSelectedTrack] = useState(null);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  
  const { 
    isLoading, 
    filteredTracks, 
    selectedTracks,
    initMockData,
    loadTracks
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

  // Load data on mount only
  useEffect(() => {
    const loadData = async () => {
      try {
        await loadTracks();
      } catch {
        // No tracks loaded, initialize mock data
        await handleInitMockData();
      }
    };
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="archives-page">
      <header className="archives-header">
        <h1>{APP_CONFIG.name}</h1>
        <div className="header-actions">
          <button 
            className="btn-secondary"
            onClick={loadTracks}
            disabled={isLoading}
          >
            🔄 Обновить
          </button>
          <button 
            className="btn-secondary"
            onClick={handleInitMockData}
            disabled={isLoading}
          >
            📦 Загрузить моки
          </button>
          <button className="btn-primary">
            ➕ Импорт данных
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
              <p>Загрузка данных...</p>
            </div>
          ) : filteredTracks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🎵</div>
              <h3>Нет треков</h3>
              <p>Загрузите данные архива, чтобы начать работу</p>
              <button 
                className="btn-primary"
                onClick={handleInitMockData}
              >
                Загрузить моковые данные
              </button>
            </div>
          ) : (
            <TrackTable onSessionClick={handleSessionClick} />
          )}
        </main>
      </div>

      <PlayerBar />

      {showSessionDialog && (
        <SessionDialog 
          track={selectedTrack} 
          onClose={handleCloseDialog} 
        />
      )}
    </div>
  );
}
