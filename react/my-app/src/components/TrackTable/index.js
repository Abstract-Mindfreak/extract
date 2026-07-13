import React, { useState } from 'react';
import { useTrackStore } from '../../hooks/useTrackStore';
import { ACCOUNTS, TABLE_COLUMNS } from '../../constants/app';
import { formatDate, formatDuration, truncate } from '../../utils/format';
import './styles.css';

export default function TrackTable({
  onSessionClick,
  showSelection = false,
  trackGroupMap = {},
  selectionActions = null,
}) {
  const [baseColumns] = useState([
    'cover',
    'title',
    'account',
    'duration',
    'prompt',
    'rating',
    'date',
    'actions',
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
    getTotalPages,
  } = useTrackStore();

  const paginatedTracks = getPaginatedTracks();
  const totalPages = getTotalPages();
  const visibleColumns = showSelection ? ['select', ...baseColumns] : baseColumns;

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
    if (sortConfig.key !== columnId) return '↕';
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
            onClick={(event) => event.stopPropagation()}
          />
        );

      case 'cover':
        return (
          <div className="track-cover">
            <img
              src={track.coverUrl || '/default-cover.png'}
              alt={track.title}
              onError={(event) => { event.target.src = '/default-cover.png'; }}
            />
            <button
              className="play-overlay"
              onClick={(event) => {
                event.stopPropagation();
                handlePlay(track);
              }}
            >
              ▶
            </button>
          </div>
        );

      case 'title':
        return (
          <div className="track-title">
            <div className="track-title__copy">
              <span className="title-text">{track.title}</span>
              {trackGroupMap[String(track.id || '')]?.length ? (
                <div className="track-title__groups">
                  {trackGroupMap[String(track.id || '')].slice(0, 3).map((group) => (
                    <span key={`${track.id}-${group.group_id}`} className="track-group-chip">
                      {group.title}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            {currentTrack?.id === track.id ? <span className="now-playing">▶</span> : null}
          </div>
        );

      case 'account': {
        const account = ACCOUNTS.find((item) => item.id === track.accountId);
        return (
          <div className="track-account">
            <div className="account-avatar">
              <img
                src={account?.avatarUrl || '/avatars/default.png'}
                alt={account?.name}
                onError={(event) => { event.target.src = '/avatars/default.png'; }}
              />
            </div>
            <div className="account-info">
              <span className="account-name" style={{ color: account?.color }}>
                {account?.name || `Account ${track.accountId}`}
              </span>
              <span className="account-email" title={account?.email}>
                {account?.email}
              </span>
            </div>
          </div>
        );
      }

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
              onChange={(event) => {
                event.stopPropagation();
                updateTrackRating(track.id, parseFloat(event.target.value));
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <option value="0">☆☆☆☆☆</option>
              <option value="1">★☆☆☆☆</option>
              <option value="2">★★☆☆☆</option>
              <option value="3">★★★☆☆</option>
              <option value="4">★★★★☆</option>
              <option value="5">★★★★★</option>
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
              title="Session"
              onClick={(event) => {
                event.stopPropagation();
                onSessionClick?.(track);
              }}
            >
              💬
            </button>
            <button
              className="btn-icon"
              title="Download"
              onClick={(event) => event.stopPropagation()}
            >
              ⬇
            </button>
            <button
              className="btn-icon"
              title="Open source"
              onClick={(event) => {
                event.stopPropagation();
                window.open(track.sessionUrl || track.sourceUrl, '_blank');
              }}
            >
              ↗
            </button>
          </div>
        );

      default:
        return track[columnId] || '-';
    }
  };

  if (isLoading && filteredTracks.length === 0) {
    return <div className="track-table-loading">Loading archive data...</div>;
  }

  return (
    <div className="track-table-container">
      {showSelection && selectionActions ? (
        <div className="selection-action-panel">
          <div className="selection-action-panel__row">
            <span className="selection-action-panel__count">Selected: {selectedTracks.size}</span>
            <label>
              <span>Existing album</span>
              <select value={selectionActions.selectedGroupId} onChange={(event) => selectionActions.setSelectedGroupId(event.target.value)}>
                <option value="">Select album</option>
                {selectionActions.themeGroups.map((group) => (
                  <option key={group.group_id} value={group.group_id}>
                    {group.title}
                  </option>
                ))}
              </select>
            </label>
            <button onClick={selectionActions.handleAddSelectionToGroup} disabled={!selectedTracks.size || !selectionActions.selectedGroupId}>
              Add to album
            </button>
            <button onClick={selectionActions.handleRemoveSelectionFromGroup} disabled={!selectedTracks.size || !selectionActions.selectedGroupId}>
              Remove from album
            </button>
            <button onClick={deselectAll} disabled={!selectedTracks.size}>
              Clear selection
            </button>
          </div>
          <div className="selection-action-panel__row">
            <label>
              <span>New album title</span>
              <input
                value={selectionActions.albumDraft.title}
                onChange={(event) => selectionActions.handleAlbumDraftChange('title', event.target.value)}
                placeholder="New album title"
              />
            </label>
            <label>
              <span>Genre / direction</span>
              <input
                value={selectionActions.albumDraft.genre}
                onChange={(event) => selectionActions.handleAlbumDraftChange('genre', event.target.value)}
                placeholder="psychedelic trance / metal core / ritual"
              />
            </label>
            <button onClick={selectionActions.handleCreateGroupFromSelection} disabled={!selectedTracks.size || !selectionActions.albumDraft.title.trim()}>
              Create album from selection
            </button>
          </div>
        </div>
      ) : null}

      {selectedTracks.size > 0 ? (
        <div className="selection-toolbar">
          <span>Selected: {selectedTracks.size}</span>
          <button onClick={deselectAll}>Clear selection</button>
          <button onClick={() => alert('Export selected')}>Export</button>
          <button onClick={() => alert('Delete selected')}>Delete</button>
        </div>
      ) : null}

      <div className="track-table-wrapper">
        <table className="track-table">
          <thead>
            <tr>
              {visibleColumns.map((colId) => {
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
                        checked={
                          paginatedTracks.length > 0 &&
                          paginatedTracks.every((track) => selectedTracks.has(track.id))
                        }
                        onChange={() =>
                          paginatedTracks.every((track) => selectedTracks.has(track.id))
                            ? deselectAll()
                            : selectAllVisible()
                        }
                      />
                    ) : (
                      <>
                        {colConfig.label}
                        {colConfig.sortable ? <span className="sort-icon">{getSortIcon(colId)}</span> : null}
                      </>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {paginatedTracks.map((track) => (
              <tr
                key={track.id}
                className={currentTrack?.id === track.id ? 'playing' : ''}
                onDoubleClick={() => handlePlay(track)}
              >
                {visibleColumns.map((colId) => (
                  <td key={colId}>{renderCell(track, colId)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="track-table-pagination">
        <div className="pagination-info">
          Showing {paginatedTracks.length} of {filteredTracks.length} tracks
        </div>
        <div className="pagination-controls">
          <button
            disabled={pagination.page === 1}
            onClick={() => setPage(pagination.page - 1)}
          >
            ←
          </button>

          {Array.from({ length: totalPages }, (_, index) => index + 1)
            .slice(Math.max(0, pagination.page - 3), Math.min(totalPages, pagination.page + 2))
            .map((page) => (
              <button
                key={page}
                className={pagination.page === page ? 'active' : ''}
                onClick={() => setPage(page)}
              >
                {page}
              </button>
            ))}

          <button
            disabled={pagination.page === totalPages || totalPages === 0}
            onClick={() => setPage(pagination.page + 1)}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
