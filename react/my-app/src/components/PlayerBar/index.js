import React, { useRef, useEffect, useState } from 'react';
import { useTrackStore } from '../../hooks/useTrackStore';
import { formatDuration } from '../../utils/format';
import { ACCOUNTS } from '../../constants/app';
import './styles.css';

export default function PlayerBar() {
  const audioRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  const { currentTrack, setCurrentTrack, filteredTracks } = useTrackStore();

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      audioRef.current.src = currentTrack.audioUrl;
      audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {
        // Auto-play blocked
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  const togglePlay = () => {
    if (!audioRef.current || !currentTrack) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
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

  const handleSeek = (e) => {
    const time = Number(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e) => {
    const vol = Number(e.target.value);
    setVolume(vol);
    if (audioRef.current) {
      audioRef.current.volume = vol;
    }
  };

  const playNext = () => {
    if (!currentTrack || filteredTracks.length === 0) return;
    
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    const nextTrack = filteredTracks[currentIndex + 1] || filteredTracks[0];
    if (nextTrack) {
      setCurrentTrack(nextTrack);
    }
  };

  const playPrevious = () => {
    if (!currentTrack || filteredTracks.length === 0) return;
    
    const currentIndex = filteredTracks.findIndex(t => t.id === currentTrack.id);
    const prevTrack = filteredTracks[currentIndex - 1] || filteredTracks[filteredTracks.length - 1];
    if (prevTrack) {
      setCurrentTrack(prevTrack);
    }
  };

  const handleEnded = () => {
    playNext();
  };

  if (!currentTrack) return null;

  const account = ACCOUNTS.find(a => a.id === currentTrack.accountId);

  return (
    <div className="player-bar">
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
          <div className="player-title">{currentTrack.title}</div>
          <div className="player-account" style={{ color: account?.color }}>
            {account?.name}
          </div>
        </div>
      </div>

      <div className="player-controls">
        <button className="control-btn" onClick={playPrevious}>⏮</button>
        <button className="control-btn play" onClick={togglePlay}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button className="control-btn" onClick={playNext}>⏭</button>
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

      <div className="player-volume">
        <span>{volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}</span>
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
  );
}
