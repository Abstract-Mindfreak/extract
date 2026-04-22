import React, { useState, useEffect } from 'react';
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
    loadCustomFilters
  } = useTrackStore();
  
  const [newFilterText, setNewFilterText] = useState('');
  
  useEffect(() => {
    loadCustomFilters();
  }, [loadCustomFilters]);
  
  const handleAddFilter = () => {
    if (newFilterText.trim()) {
      addCustomFilter(newFilterText.trim());
      setNewFilterText('');
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddFilter();
    }
  };

  const handleAccountToggle = (accountId) => {
    const newAccounts = filters.accounts.includes(accountId)
      ? filters.accounts.filter(id => id !== accountId)
      : [...filters.accounts, accountId];
    setAccountFilter(newAccounts);
  };

  const hasActiveFilters = 
    filters.search || 
    filters.accounts.length > 0 || 
    filters.rating !== null ||
    customFilters.some(f => f.enabled);

  return (
    <div className="filter-panel">
      <div className="filter-header">
        <h3>Фильтры</h3>
        {hasActiveFilters && (
          <button className="clear-filters" onClick={clearFilters}>
            Сбросить
          </button>
        )}
      </div>

      {/* Search */}
      <div className="filter-section">
        <label>Поиск</label>
        <input
          type="text"
          placeholder="Название, промпт, lyrics..."
          value={filters.search}
          onChange={(e) => setSearchFilter(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Accounts */}
      <div className="filter-section">
        <label>Аккаунты</label>
        <div className="account-filters">
          {ACCOUNTS.map(account => (
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

      {/* Rating */}
      <div className="filter-section">
        <label>Минимальная оценка</label>
        <div className="rating-filters">
          <button
            className={filters.rating === null ? 'active' : ''}
            onClick={() => setRatingFilter(null)}
          >
            Любая
          </button>
          {RATING_OPTIONS.slice(1).map(option => (
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

      {/* Custom Filters */}
      <div className="filter-section">
        <label>Текстовые фильтры ({customFilters.length}/15)</label>
        <div className="custom-filter-input">
          <input
            type="text"
            placeholder="Введите текст фильтра..."
            value={newFilterText}
            onChange={(e) => setNewFilterText(e.target.value)}
            onKeyPress={handleKeyPress}
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
        {customFilters.length > 0 && (
          <div className="custom-filters-list">
            {customFilters.map(filter => (
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
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="filter-stats">
        <StatsDisplay />
      </div>
    </div>
  );
}

function StatsDisplay() {
  const { tracks, filteredTracks, selectedTracks } = useTrackStore();
  
  const totalDuration = filteredTracks.reduce((sum, t) => sum + (t.durationSeconds || 0), 0);
  const totalPlays = filteredTracks.reduce((sum, t) => sum + (t.playCount || 0), 0);
  const avgRating = filteredTracks.length > 0
    ? filteredTracks.reduce((sum, t) => sum + (t.rating || 0), 0) / filteredTracks.length
    : 0;

  const formatDuration = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}ч ${mins}м` : `${mins}м`;
  };

  return (
    <div className="stats-grid">
      <div className="stat-item">
        <span className="stat-value">{filteredTracks.length}</span>
        <span className="stat-label">треков</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{formatDuration(totalDuration)}</span>
        <span className="stat-label">всего</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{avgRating.toFixed(1)}</span>
        <span className="stat-label">ср. оценка</span>
      </div>
      <div className="stat-item">
        <span className="stat-value">{totalPlays}</span>
        <span className="stat-label">прослушиваний</span>
      </div>
      {selectedTracks.size > 0 && (
        <div className="stat-item selected">
          <span className="stat-value">{selectedTracks.size}</span>
          <span className="stat-label">выбрано</span>
        </div>
      )}
    </div>
  );
}
