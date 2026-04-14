import React, { useState } from 'react';
import { useTrackStore } from '../../hooks/useTrackStore';
import { ACCOUNTS, TABLE_COLUMNS } from '../../constants/app';
import { formatDuration, formatDate, formatRating, truncate } from '../../utils/format';
import './styles.css';

export default function TrackTable({ onSessionClick }) {
  const [visibleColumns, setVisibleColumns] = useState([
    'cover', 'title', 'account', 'duration', 'prompt', 'rating', 'date', 'actions'
  ]);

  const {
    filteredTracks,
    selectedTracks,
    currentTrack,
    isLoading,
    pagination,
    sortConfig,
    toggleTrackSelection,
    selectAllVisible,
    deselectAll,
    setSortConfig,
    setPage,
    updateTrackRating,
    incrementPlayCount,
    setCurrentTrack,
    getPaginatedTracks,
    getTotalPages
  } = useTrackStore();

  // Removed auto-load - data is loaded by parent ArchivesPage

  const paginatedTracks = getPaginatedTracks();
  const totalPages = getTotalPages();

  const handlePlay = (track) => {
    setCurrentTrack(track);
    incrementPlayCount(track.id);
  };

  const handleSort = (columnId) => {
    if (TABLE_COLUMNS[columnId.toUpperCase()]?.sortable) {
      setSortConfig(columnId);
    }
  };

  const getSortIcon = (columnId) => {
    if (sortConfig.key !== columnId) return '↕️';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const renderCell = (track, columnId) => {
    switch (columnId) {
      case 'select':
        return (
          <input
            type="checkbox"
            checked={selectedTracks.has(track.id)}
            onChange={() => toggleTrackSelection(track.id)}
            onClick={(e) => e.stopPropagation()}
          />
        );

      case 'cover':
        return (
          <div className="track-cover">
            <img 
              src={track.coverUrl || '/default-cover.png'} 
              alt={track.title}
              onError={(e) => { e.target.src = '/default-cover.png'; }}
            />
            <button 
              className="play-overlay"
              onClick={(e) => { e.stopPropagation(); handlePlay(track); }}
            >
              ▶
            </button>
          </div>
        );

      case 'title':
        return (
          <div className="track-title">
            <span className="title-text">{track.title}</span>
            {currentTrack?.id === track.id && (
              <span className="now-playing">▶</span>
            )}
          </div>
        );

      case 'account':
        const account = ACCOUNTS.find(a => a.id === track.accountId);
        return (
          <div className="track-account">
            <span className="account-badge" style={{ backgroundColor: account?.color }}>
              {account?.name || `Аккаунт ${track.accountId}`}
            </span>
          </div>
        );

      case 'duration':
        return <span className="track-duration">{formatDuration(track.durationSeconds)}</span>;

      case 'prompt':
        return (
          <div className="track-prompt" title={track.soundPrompt}>
            {truncate(track.soundPrompt, 80)}
          </div>
        );

      case 'rating':
        return (
          <div className="track-rating">
            <select
              value={track.rating || 0}
              onChange={(e) => {
                e.stopPropagation();
                updateTrackRating(track.id, parseFloat(e.target.value));
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <option value="0">☆☆☆☆☆</option>
              <option value="1">⭐☆☆☆☆</option>
              <option value="2">⭐⭐☆☆☆</option>
              <option value="3">⭐⭐⭐☆☆</option>
              <option value="4">⭐⭐⭐⭐☆</option>
              <option value="5">⭐⭐⭐⭐⭐</option>
            </select>
          </div>
        );

      case 'date':
        return <span>{formatDate(track.createdAt)}</span>;

      case 'playCount':
        return <span>{track.playCount || 0}</span>;

      case 'actions':
        return (
          <div className="track-actions">
            <button 
              className="btn-icon"
              title="Сессия"
              onClick={(e) => { e.stopPropagation(); onSessionClick?.(track); }}
            >
              💬
            </button>
            <button 
              className="btn-icon"
              title="Скачать"
              onClick={(e) => e.stopPropagation()}
            >
              ⬇️
            </button>
            <button 
              className="btn-icon"
              title="Открыть на сайте"
              onClick={(e) => {
                e.stopPropagation();
                window.open(track.sourceUrl, '_blank');
              }}
            >
              🔗
            </button>
          </div>
        );

      default:
        return track[columnId] || '-';
    }
  };

  if (isLoading && filteredTracks.length === 0) {
    return <div className="track-table-loading">Загрузка...</div>;
  }

  return (
    <div className="track-table-container">
      {/* Selection toolbar */}
      {selectedTracks.size > 0 && (
        <div className="selection-toolbar">
          <span>Выбрано: {selectedTracks.size}</span>
          <button onClick={deselectAll}>Снять выбор</button>
          <button onClick={() => alert('Export selected')}>Экспорт</button>
          <button onClick={() => alert('Delete selected')}>Удалить</button>
        </div>
      )}

      {/* Table */}
      <div className="track-table-wrapper">
        <table className="track-table">
          <thead>
            <tr>
              {visibleColumns.map(colId => {
                const colConfig = TABLE_COLUMNS[colId.toUpperCase()] || { label: colId };
                return (
                  <th
                    key={colId}
                    style={{ width: colConfig.width }}
                    className={colConfig.sortable ? 'sortable' : ''}
                    onClick={() => handleSort(colId)}
                  >
                    {colId === 'select' ? (
                      <input
                        type="checkbox"
                        checked={paginatedTracks.length > 0 && paginatedTracks.every(t => selectedTracks.has(t.id))}
                        onChange={() => paginatedTracks.every(t => selectedTracks.has(t.id)) ? deselectAll() : selectAllVisible()}
                      />
                    ) : (
                      <>
                        {colConfig.label}
                        {colConfig.sortable && <span className="sort-icon">{getSortIcon(colId)}</span>}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedTracks.map(track => (
              <tr 
                key={track.id} 
                className={currentTrack?.id === track.id ? 'playing' : ''}
                onDoubleClick={() => handlePlay(track)}
              >
                {visibleColumns.map(colId => (
                  <td key={colId}>
                    {renderCell(track, colId)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="track-table-pagination">
        <div className="pagination-info">
          Показано {paginatedTracks.length} из {filteredTracks.length} треков
        </div>
        <div className="pagination-controls">
          <button 
            disabled={pagination.page === 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            ←
          </button>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => 
              p === 1 || 
              p === totalPages || 
              Math.abs(p - pagination.page) <= 2
            )
            .map((p, i, arr) => (
              <React.Fragment key={p}>
                {i > 0 && arr[i - 1] !== p - 1 && <span className="ellipsis">...</span>}
                <button
                  className={p === pagination.page ? 'active' : ''}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              </React.Fragment>
            ))
          }
          
          <button 
            disabled={pagination.page === totalPages}
            onClick={() => setPage(pagination.page + 1)}
          >
            →
          </button>
        </div>
        <div className="page-size-selector">
          <span>На странице:</span>
          <select 
            value={pagination.pageSize}
            onChange={(e) => useTrackStore.getState().setPageSize(Number(e.target.value))}
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>
    </div>
  );
}
