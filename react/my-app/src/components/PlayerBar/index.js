import React, { useEffect, useRef, useState } from 'react';
import {
  FaBackwardStep,
  FaCompactDisc,
  FaCompress,
  FaForwardStep,
  FaPause,
  FaPlay,
  FaShuffle,
  FaUpRightFromSquare,
  FaVolumeHigh,
  FaVolumeLow,
  FaVolumeXmark,
} from 'react-icons/fa6';
import { useTrackStore } from '../../hooks/useTrackStore';
import { useMMSSThemeAlbumGroupsWorkspaceService } from '../../services/MMSSThemeAlbumGroupsWorkspaceService';
import { formatDuration } from '../../utils/format';
import { ACCOUNTS } from '../../constants/app';
import './styles.css';

function getTrackSourceUrl(track) {
  if (!track) return '';
  if (track.sourceUrl) return track.sourceUrl;
  if (track.sessionUrl) return track.sessionUrl;
  if (track.rawData?.source_url) return track.rawData.source_url;
  if (track.conversationId && track.id) {
    return `https://www.flowmusic.app/session/${track.conversationId}#song-${track.id}`;
  }
  return '';
}

export default function PlayerBar({ embedded = false }) {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [shuffleEnabled, setShuffleEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [themeGroups, setThemeGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [trackMemberships, setTrackMemberships] = useState([]);
  const themeAlbumService = useMMSSThemeAlbumGroupsWorkspaceService();

  const { currentTrack, setCurrentTrack, filteredTracks, updateTrackRating } = useTrackStore();

  useEffect(() => {
    let cancelled = false;
    async function loadGroups() {
      try {
        const groups = await themeAlbumService.listGroups('abstract-mind-lab');
        if (!cancelled) {
          setThemeGroups(groups);
          setSelectedGroupId((current) => current || groups[0]?.group_id || '');
        }
      } catch (_error) {
        if (!cancelled) {
          setThemeGroups([]);
        }
      }
    }
    loadGroups();
    return () => {
      cancelled = true;
    };
  }, [themeAlbumService]);

  useEffect(() => {
    let cancelled = false;
    async function loadMemberships() {
      if (!currentTrack?.id) {
        if (!cancelled) setTrackMemberships([]);
        return;
      }
      try {
        const memberships = await themeAlbumService.listMemberships('abstract-mind-lab', [currentTrack.id]);
        if (!cancelled) {
          setTrackMemberships(memberships[String(currentTrack.id)] || []);
        }
      } catch (_error) {
        if (!cancelled) {
          setTrackMemberships([]);
        }
      }
    }
    loadMemberships();
    return () => {
      cancelled = true;
    };
  }, [currentTrack, themeAlbumService]);

  useEffect(() => {
    let cancelled = false;

    async function syncTrackPlayback() {
      if (!currentTrack || !audioRef.current) {
        setIsPlaying(false);
        setCurrentTime(0);
        setDuration(0);
        return;
      }

      const audio = audioRef.current;
      setIsPlaying(false);
      setCurrentTime(0);
      setDuration(0);

      if (audio.src !== currentTrack.audioUrl) {
        audio.pause();
        audio.src = currentTrack.audioUrl;
        audio.load();
      }

      try {
        await audio.play();
        if (!cancelled) {
          setIsPlaying(true);
        }
      } catch (error) {
        if (!cancelled && error?.name !== 'AbortError') {
          setIsPlaying(false);
        }
      }
    }

    void syncTrackPlayback();

    return () => {
      cancelled = true;
    };
  }, [currentTrack]);

  const togglePlay = async () => {
    if (!audioRef.current || !currentTrack) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      return;
    }

    try {
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setIsPlaying(false);
      }
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (event) => {
    const time = Number(event.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (event) => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    if (audioRef.current) {
      audioRef.current.volume = nextVolume;
    }
  };

  const playNext = () => {
    if (!currentTrack || filteredTracks.length === 0) return;

    if (shuffleEnabled && filteredTracks.length > 1) {
      const candidates = filteredTracks.filter((track) => track.id !== currentTrack.id);
      const nextTrack = candidates[Math.floor(Math.random() * candidates.length)];
      if (nextTrack) {
        setCurrentTrack(nextTrack);
      }
      return;
    }

    const currentIndex = filteredTracks.findIndex((track) => track.id === currentTrack.id);
    const nextTrack = filteredTracks[currentIndex + 1] || filteredTracks[0];
    if (nextTrack) {
      setCurrentTrack(nextTrack);
    }
  };

  const playPrevious = () => {
    if (!currentTrack || filteredTracks.length === 0) return;

    const currentIndex = filteredTracks.findIndex((track) => track.id === currentTrack.id);
    const prevTrack = filteredTracks[currentIndex - 1] || filteredTracks[filteredTracks.length - 1];
    if (prevTrack) {
      setCurrentTrack(prevTrack);
    }
  };

  const handleEnded = () => {
    playNext();
  };

  const handleAddCurrentTrackToGroup = async () => {
    if (!currentTrack?.id || !selectedGroupId) return;
    await themeAlbumService.addTrackToGroup(selectedGroupId, {
      database: 'abstract-mind-lab',
      track_id: currentTrack.id,
      assignment_source: 'player_manual',
      is_confirmed: true,
    });
    const memberships = await themeAlbumService.listMemberships('abstract-mind-lab', [currentTrack.id]);
    setTrackMemberships(memberships[String(currentTrack.id)] || []);
  };

  if (!currentTrack) {
    return embedded ? (
      <div className="player-bar-shell player-bar-shell--embedded">
        <div className="player-bar player-bar--embedded player-bar--empty">
          <span>No track selected. Start playback from Archives, Skills, or Theme Album Groups.</span>
        </div>
      </div>
    ) : null;
  }

  if (collapsed) {
    return (
      <div className={`player-bar-shell${embedded ? ' player-bar-shell--embedded' : ''}`}>
        <div className={`player-bar player-bar--collapsed${embedded ? ' player-bar--embedded' : ''}`}>
          <button className="control-btn" onClick={() => setCollapsed(false)} title="Expand player" aria-label="Expand player">
            <FaCompactDisc />
          </button>
          <span>{currentTrack.title}</span>
        </div>
      </div>
    );
  }

  const account = ACCOUNTS.find((entry) => entry.id === currentTrack.accountId);
  const sourceUrl = getTrackSourceUrl(currentTrack);

  return (
    <div className={`player-bar-shell${embedded ? ' player-bar-shell--embedded' : ''}`}>
      <div className={`player-bar${embedded ? ' player-bar--embedded' : ''}`}>
        <audio
          ref={audioRef}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={handleEnded}
        />

        <div className="player-track-info">
          <img
            src={currentTrack.coverUrl || '/default-cover.png'}
            alt={currentTrack.title}
            className="player-cover"
          />
          <div className="player-meta">
            <div className="player-title"><FaCompactDisc /> {currentTrack.title}</div>
            <div className="player-account" style={{ color: account?.color }}>
              {account?.name}
            </div>
            {trackMemberships.length ? (
              <div className="player-tags">
                {trackMemberships.slice(0, 3).map((membership) => (
                  <span key={membership.group_id} className="player-tag">
                    {membership.title}
                  </span>
                ))}
              </div>
            ) : null}
            {sourceUrl ? (
              <button
                className="player-link"
                type="button"
                onClick={() => window.open(sourceUrl, '_blank', 'noopener,noreferrer')}
              >
                <FaUpRightFromSquare />
                Open in Flowmusic
              </button>
            ) : null}
          </div>
        </div>

        <div className="player-controls">
          <button className="control-btn" onClick={playPrevious} title="Previous" aria-label="Previous">
            <FaBackwardStep />
          </button>
          <button
            className={`control-btn${shuffleEnabled ? ' control-btn--active' : ''}`}
            onClick={() => setShuffleEnabled((current) => !current)}
            title={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
            aria-label={shuffleEnabled ? 'Shuffle on' : 'Shuffle off'}
          >
            <FaShuffle />
          </button>
          <button className="control-btn play" onClick={togglePlay} title={isPlaying ? 'Pause' : 'Play'} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? <FaPause /> : <FaPlay />}
          </button>
          <button className="control-btn" onClick={playNext} title="Next" aria-label="Next">
            <FaForwardStep />
          </button>
          <button className="control-btn" onClick={() => setCollapsed(true)} title="Collapse player" aria-label="Collapse player">
            <FaCompress />
          </button>
        </div>

        <div className="player-progress">
          <span className="time">{formatDuration(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || currentTrack.durationSeconds}
            value={currentTime}
            onChange={handleSeek}
            className="progress-bar"
          />
          <span className="time">{formatDuration(duration || currentTrack.durationSeconds)}</span>
        </div>

        <div className="player-sidecar">
          <div className="player-rating">
            <span>Rating</span>
            <select value={currentTrack.rating || 0} onChange={(event) => updateTrackRating(currentTrack.id, Number(event.target.value))}>
              <option value="0">0</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
            </select>
          </div>
          <div className="player-album-assign">
            <select value={selectedGroupId} onChange={(event) => setSelectedGroupId(event.target.value)}>
              <option value="">Select album</option>
              {themeGroups.map((group) => (
                <option key={group.group_id} value={group.group_id}>{group.title}</option>
              ))}
            </select>
            <button className="player-album-button" onClick={handleAddCurrentTrackToGroup} disabled={!selectedGroupId}>
              Add to album
            </button>
          </div>
          <div className="player-volume">
            <span className="player-volume-label">
              {volume === 0 ? <FaVolumeXmark /> : volume < 0.5 ? <FaVolumeLow /> : <FaVolumeHigh />}
              {volume === 0 ? 'Mute' : volume < 0.5 ? 'Low' : 'High'}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={volume}
              onChange={handleVolumeChange}
              className="volume-slider"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
