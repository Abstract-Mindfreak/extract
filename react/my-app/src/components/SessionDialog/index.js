import React, { useState, useEffect } from 'react';
import mockDataService from '../../services/MockDataService';
import { formatDateTime, formatDuration } from '../../utils/format';
import { ACCOUNTS } from '../../constants/app';
import './styles.css';

export default function SessionDialog({ track, onClose }) {
  const [session, setSession] = useState(null);
  const [activeTab, setActiveTab] = useState('chat');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (track?.conversationId) {
      loadSession(track.conversationId);
    }
  }, [track]);

  const loadSession = async (conversationId) => {
    setLoading(true);
    try {
      const sessionData = await mockDataService.getSession(conversationId);
      setSession(sessionData);
    } catch (error) {
      console.error('Failed to load session:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!track) return null;

  const account = ACCOUNTS.find(a => a.id === track.accountId);

  return (
    <div className="session-dialog-backdrop" onClick={handleBackdropClick}>
      <div className="session-dialog">
        {/* Header */}
        <div className="session-dialog-header">
          <div className="track-info">
            <img 
              src={track.coverUrl || '/default-cover.png'} 
              alt={track.title}
              className="track-cover-small"
            />
            <div className="track-meta">
              <h2>{track.title}</h2>
              <div className="track-details">
                <span className="account-badge" style={{ backgroundColor: account?.color }}>
                  {account?.name}
                </span>
                <span>{formatDuration(track.durationSeconds)}</span>
                <span>Conversation: {track.conversationId?.slice(0, 8)}...</span>
              </div>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Tabs */}
        <div className="session-tabs">
          <button 
            className={activeTab === 'chat' ? 'active' : ''}
            onClick={() => setActiveTab('chat')}
          >
            Чат сессии
          </button>
          <button 
            className={activeTab === 'tracks' ? 'active' : ''}
            onClick={() => setActiveTab('tracks')}
          >
            Треки в сессии ({session?.linkedTracks?.length || 0})
          </button>
          <button 
            className={activeTab === 'fragments' ? 'active' : ''}
            onClick={() => setActiveTab('fragments')}
          >
            Фрагменты
          </button>
        </div>

        {/* Content */}
        <div className="session-content">
          {loading ? (
            <div className="loading">Загрузка...</div>
          ) : !session ? (
            <div className="no-session">Сессия не найдена</div>
          ) : (
            <>
              {activeTab === 'chat' && <ChatTab session={session} track={track} />}
              {activeTab === 'tracks' && <TracksTab session={session} currentTrackId={track.id} />}
              {activeTab === 'fragments' && <FragmentsTab session={session} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="session-dialog-footer">
          <button onClick={onClose}>Закрыть</button>
          <button 
            className="primary"
            onClick={() => window.open(track.sourceUrl, '_blank')}
          >
            Открыть на сайте
          </button>
        </div>
      </div>
    </div>
  );
}

function ChatTab({ session, track }) {
  return (
    <div className="chat-tab">
      <div className="messages-list">
        {session.messages?.map((message, index) => (
          <div key={message.id || index} className={`message ${message.role}`}>
            <div className="message-header">
              <span className="message-role">
                {message.role === 'user' ? '👤 Пользователь' : '🤖 Assistant'}
              </span>
              <span className="message-time">
                {formatDateTime(message.timestamp)}
              </span>
            </div>
            <div className="message-content">
              {message.content}
            </div>
            {message.linkedTrackId && (
              <div className="message-track">
                <span>🎵 </span>
                {message.linkedTrackId === track.id ? (
                  <strong>Текущий трек</strong>
                ) : (
                  <span>Track: {message.linkedTrackId.slice(0, 8)}...</span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TracksTab({ session, currentTrackId }) {
  return (
    <div className="tracks-tab">
      {session.linkedTracks?.map((linkedTrack) => (
        <div 
          key={linkedTrack.trackId} 
          className={`linked-track ${linkedTrack.trackId === currentTrackId ? 'current' : ''}`}
        >
          <img 
            src={linkedTrack.coverPath || linkedTrack.quickMeta?.coverUrl || '/default-cover.png'} 
            alt={linkedTrack.title}
          />
          <div className="linked-track-info">
            <h4>{linkedTrack.title}</h4>
            <p>{truncate(linkedTrack.prompt, 100)}</p>
            <div className="linked-track-meta">
              <span>{formatDuration(linkedTrack.quickMeta?.durationSeconds)}</span>
              <span>★ {linkedTrack.rating || '—'}</span>
              <span>▶ {linkedTrack.quickMeta?.playCount || 0}</span>
            </div>
          </div>
          {linkedTrack.trackId === currentTrackId && (
            <span className="current-badge">Текущий</span>
          )}
        </div>
      ))}
    </div>
  );
}

function FragmentsTab({ session }) {
  const allFragments = session.messages?.flatMap(m => m.textFragments || []) || [];

  if (allFragments.length === 0) {
    return <div className="no-fragments">Нет связанных фрагментов</div>;
  }

  return (
    <div className="fragments-tab">
      {allFragments.map((fragment) => (
        <div key={fragment.fragmentId} className="fragment-item">
          <div className="fragment-text">{fragment.text}</div>
          <div className="fragment-meta">
            <span>Сообщение: {fragment.startIndex}-{fragment.endIndex}</span>
            {fragment.linkedTrackId && (
              <span>→ Трек: {fragment.linkedTrackId.slice(0, 8)}...</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function truncate(text, length) {
  if (!text) return '';
  return text.length > length ? text.substring(0, length) + '...' : text;
}
