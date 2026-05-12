import React, { useEffect, useState } from 'react';
import { useTrackStore } from '../../hooks/useTrackStore';
import { ACCOUNTS, RATING_OPTIONS } from '../../constants/app';
import './styles.css';

export default function FilterPanel() {
  const {
    filters,
    customFilters,
    setSearchFilter,
    setAccountFilter,
    setRatingFilter,
    clearFilters,
    addCustomFilter,
    removeCustomFilter,
    toggleCustomFilter,
    loadCustomFilters,
  } = useTrackStore();

  const [newFilterText, setNewFilterText] = useState('');

  useEffect(() => {
    loadCustomFilters();
  }, [loadCustomFilters]);

  const handleAddFilter = () => {
    if (!newFilterText.trim()) return;
    addCustomFilter(newFilterText.trim());
    setNewFilterText('');
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter') {
      handleAddFilter();
    }
  };

  const handleAccountToggle = (accountId) => {
    const nextAccounts = filters.accounts.includes(accountId)
      ? filters.accounts.filter((id) => id !== accountId)
      : [...filters.accounts, accountId];
    setAccountFilter(nextAccounts);
  };

  const hasActiveFilters =
    filters.search ||
    filters.accounts.length > 0 ||
    filters.rating !== null ||
    customFilters.some((filter) => filter.enabled);

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Filters</h3>
        {hasActiveFilters ? (
          <button className="clear-filters" onClick={clearFilters}>
            Reset
          </button>
        ) : null}
      </div>

      <div className="filter-section">
        <label>Search</label>
        <input
          type="text"
          placeholder="Title, prompt, lyrics..."
          value={filters.search}
          onChange={(event) => setSearchFilter(event.target.value)}
          className="search-input"
        />
      </div>

      <div className="filter-section">
        <label>Accounts</label>
        <div className="account-filters">
          {ACCOUNTS.map((account) => (
            <label
              key={account.id}
              className="account-checkbox"
              style={{ '--account-color': account.color }}
            >
              <input
                type="checkbox"
                checked={filters.accounts.includes(account.id)}
                onChange={() => handleAccountToggle(account.id)}
              />
              <span className="account-indicator" style={{ backgroundColor: account.color }} />
              <span className="account-name">{account.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label>Minimum rating</label>
        <div className="rating-filters">
          <button
            className={filters.rating === null ? 'active' : ''}
            onClick={() => setRatingFilter(null)}
          >
            Any
          </button>
          {RATING_OPTIONS.slice(1).map((option) => (
            <button
              key={option.value}
              className={filters.rating === option.value ? 'active' : ''}
              onClick={() => setRatingFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="filter-section">
        <label>Text filters ({customFilters.length}/15)</label>
        <div className="custom-filter-input">
          <input
            type="text"
            placeholder="Enter filter text..."
            value={newFilterText}
            onChange={(event) => setNewFilterText(event.target.value)}
            onKeyDown={handleKeyPress}
            disabled={customFilters.length >= 15}
            className="filter-text-input"
          />
          <button
            onClick={handleAddFilter}
            disabled={customFilters.length >= 15 || !newFilterText.trim()}
            className="add-filter-btn"
          >
            +
          </button>
        </div>
        {customFilters.length > 0 ? (
          <div className="custom-filters-list">
            {customFilters.map((filter) => (
              <div key={filter.id} className="custom-filter-item">
                <input
                  type="checkbox"
                  checked={filter.enabled}
                  onChange={() => toggleCustomFilter(filter.id)}
                  className="custom-filter-checkbox"
                />
                <span className={`custom-filter-text ${filter.enabled ? 'enabled' : 'disabled'}`}>
                  {filter.text}
                </span>
                <button
                  onClick={() => removeCustomFilter(filter.id)}
                  className="remove-filter-btn"
                >
                  x
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="filter-stats">
        <StatsDisplay />
      </div>
    </div>
  );
}

function StatsDisplay() {
  const { filteredTracks, selectedTracks } = useTrackStore();

  const totalDuration = filteredTracks.reduce((sum, track) => sum + (track.durationSeconds || 0), 0);
  const totalPlays = filteredTracks.reduce((sum, track) => sum + (track.playCount || 0), 0);
  const avgRating = filteredTracks.length
    ? filteredTracks.reduce((sum, track) => sum + (track.rating || 0), 0) / filteredTracks.length
    : 0;

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-value">{filteredTracks.length}</span>
        <span className="stat-label">tracks</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{formatDuration(totalDuration)}</span>
        <span className="stat-label">total</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{avgRating.toFixed(1)}</span>
        <span className="stat-label">avg rating</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{totalPlays}</span>
        <span className="stat-label">plays</span>
      </div>
      {selectedTracks.size > 0 ? (
        <div className="stat-item selected">
          <span className="stat-value">{selectedTracks.size}</span>
          <span className="stat-label">selected</span>
        </div>
      ) : null}
    </div>
  );
}
