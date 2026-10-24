import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  RotateCw,
  AlertCircle
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { DEFAULT_AUDIO_SERMONS } from '../utils/defaultSermons';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remMins = mins % 60;
    return `${hrs}:${remMins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export default function AudioSermonsSection() {
  const { audioSermons = [] } = useData();

  // Sermon list with fallback
  const sermons = (audioSermons && audioSermons.length > 0) 
    ? audioSermons 
    : DEFAULT_AUDIO_SERMONS;

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.9);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [audioError, setAudioError] = useState(null);

  const audioRef = useRef(null);
  const progressBarRef = useRef(null);

  const currentSermon = sermons[selectedIndex] || sermons[0];

  // Sync index if sermons array changes
  useEffect(() => {
    if (selectedIndex >= sermons.length) {
      setSelectedIndex(0);
    }
  }, [sermons.length, selectedIndex]);

  // Sync volume and muted state to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Audio stream event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
      setIsLoadingAudio(false);
      setAudioError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      // Auto-advance to next sermon in playlist
      if (sermons.length > 1) {
        const nextIndex = (selectedIndex + 1) % sermons.length;
        handleSelectSermon(nextIndex, true);
      }
    };

    const handleWaiting = () => setIsLoadingAudio(true);
    const handlePlaying = () => {
      setIsLoadingAudio(false);
      setIsPlaying(true);
    };
    const handlePause = () => setIsPlaying(false);
    const handleError = () => {
      setIsLoadingAudio(false);
      setIsPlaying(false);
      setAudioError('Audio stream unavailable. Please check your connection or try another sermon.');
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('error', handleError);
    };
  }, [currentSermon?.audio_url, selectedIndex, sermons.length]);

  // Mobile Lock Screen & Background MediaSession
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator && currentSermon) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: currentSermon.title || 'Audio Sermon',
          artist: currentSermon.speaker || 'Sugam Prathana Bhawan',
          album: 'Audio Sermons'
        });

        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current) {
            audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
          }
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        });
      } catch (err) {
        console.warn('[AudioSermonsSection] MediaSession setup notice:', err);
      }
    }
  }, [currentSermon]);

  // Play / Pause toggle
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      setAudioError(null);
      setIsLoadingAudio(true);
      audio.play().then(() => {
        setIsPlaying(true);
        setIsLoadingAudio(false);
      }).catch((err) => {
        console.error('Audio play error:', err);
        setIsLoadingAudio(false);
        setIsPlaying(false);
        setAudioError('Unable to stream this audio track. Check your connection.');
      });
    }
  };

  // Select sermon from the list below
  const handleSelectSermon = (index, autoPlay = true) => {
    if (index === selectedIndex) {
      togglePlay();
      return;
    }

    setSelectedIndex(index);
    setAudioError(null);
    setCurrentTime(0);

    if (autoPlay) {
      setIsLoadingAudio(true);
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.currentTime = 0;
          audio.volume = isMuted ? 0 : volume;
          audio.muted = isMuted;
          audio.play().then(() => {
            setIsPlaying(true);
            setIsLoadingAudio(false);
          }).catch((err) => {
            console.warn('[AudioSermonsSection] Playback notice:', err);
            setIsLoadingAudio(false);
          });
        }
      }, 50);
    }
  };

  // Skip 15s forward / backward
  const handleSkip = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = typeof audio.currentTime === 'number' && !isNaN(audio.currentTime) ? audio.currentTime : 0;
    const total = duration || (typeof audio.duration === 'number' && !isNaN(audio.duration) ? audio.duration : 9999);
    const target = Math.min(Math.max(current + seconds, 0), total);
    audio.currentTime = target;
    setCurrentTime(target);
  };

  // Seek bar scrubber with mouse and touch support
  const handleSeek = (e) => {
    const bar = progressBarRef.current;
    const audio = audioRef.current;
    if (!bar || !audio || !duration) return;

    const rect = bar.getBoundingClientRect();
    const clientX = e.touches && e.touches[0] ? e.touches[0].clientX : e.clientX;
    if (typeof clientX !== 'number' || isNaN(clientX)) return;

    const clickX = clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = ratio * duration;
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  // Volume & Mute
  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
    if (newVol > 0 && isMuted) {
      setIsMuted(false);
      if (audioRef.current) audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const nextMuted = !isMuted;
      setIsMuted(nextMuted);
      audioRef.current.muted = nextMuted;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <section 
      id="audio-sermons" 
      className="church-section bg-[#edf6fa] border-t border-[#dcebf0]"
      aria-labelledby="audio-sermons-heading"
    >
      <div className="max-w-4xl mx-auto">
        
        {/* Section Heading matching landing page */}
        <div className="church-section-heading">
          <div className="section-label">AUDIO SERMON</div>
          <h2 id="audio-sermons-heading">
            Audio <em>Sermon.</em>
          </h2>
          <p>
            Listen to weekly preachings, biblical messages, and spiritual encouragement from Sugam Church.
          </p>
        </div>

        {/* Persistent Audio Element without destructive key remounting */}
        <audio
          ref={audioRef}
          src={currentSermon?.audio_url || ''}
          preload="metadata"
          playsInline
        />

        {/* Selected Sermon Title and Audio Player Area */}
        <div className="bg-white rounded-3xl p-6 sm:p-10 border border-[#dcebf0] shadow-sm mb-12 text-center transition-all">
          
          <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#4b9fb9] mb-3 block">
            {isPlaying ? 'Now Playing' : 'Selected Sermon'}
          </span>

          {/* Title that comes up when a person clicks an audio sermon */}
          <h3 className="font-serif text-2xl sm:text-3xl md:text-4xl text-[#214b60] font-normal mb-8 leading-snug max-w-2xl mx-auto">
            {currentSermon?.title}
          </h3>

          {/* Error Message if stream fails */}
          {audioError && (
            <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-center gap-2 max-w-lg mx-auto">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{audioError}</span>
            </div>
          )}

          {/* Audio Player Controls */}
          <div className="max-w-xl mx-auto space-y-4">
            
            {/* Scrubber Progress Bar */}
            <div className="space-y-1.5">
              <div 
                ref={progressBarRef}
                onClick={handleSeek}
                className="relative h-2 bg-[#dceef5] rounded-full cursor-pointer overflow-hidden border border-[#cde2ec]"
                role="slider"
                aria-label="Audio scrubber"
                aria-valuemin={0}
                aria-valuemax={duration || 100}
                aria-valuenow={currentTime}
              >
                <div 
                  className="absolute top-0 left-0 bottom-0 bg-[#285c73] rounded-full transition-all duration-100"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {/* Time Indicators */}
              <div className="flex justify-between items-center text-xs font-mono text-[#60899b]">
                <span>{formatTime(currentTime)}</span>
                <span>{isLoadingAudio ? 'Loading audio...' : formatTime(duration)}</span>
              </div>
            </div>

            {/* Transport Controls */}
            <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2">
              
              {/* Skip 15s Backward */}
              <button
                type="button"
                onClick={() => handleSkip(-15)}
                className="w-10 h-10 rounded-full bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#285c73] flex items-center justify-center transition-colors border border-[#dcebf0]"
                title="Skip backward 15 seconds"
                aria-label="Skip backward 15 seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              {/* Main Play / Pause Button */}
              <button
                type="button"
                onClick={togglePlay}
                disabled={isLoadingAudio}
                className="w-16 h-16 rounded-full bg-[#285c73] hover:bg-[#214b60] text-white flex items-center justify-center shadow-md transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
                aria-label={isPlaying ? 'Pause sermon' : 'Play sermon'}
              >
                {isLoadingAudio ? (
                  <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-1" />
                )}
              </button>

              {/* Skip 15s Forward */}
              <button
                type="button"
                onClick={() => handleSkip(15)}
                className="w-10 h-10 rounded-full bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#285c73] flex items-center justify-center transition-colors border border-[#dcebf0]"
                title="Skip forward 15 seconds"
                aria-label="Skip forward 15 seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume / Mute Toggle */}
              <button
                type="button"
                onClick={toggleMute}
                className="w-10 h-10 rounded-full bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#285c73] flex items-center justify-center transition-colors border border-[#dcebf0]"
                title={isMuted ? 'Unmute' : 'Mute'}
                aria-label={isMuted ? 'Unmute audio' : 'Mute audio'}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-4 h-4 text-rose-500" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              {/* Volume slider (desktop) */}
              <div className="hidden sm:flex items-center">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="w-16 h-1 bg-[#dceef5] rounded-lg appearance-none cursor-pointer accent-[#285c73]"
                  aria-label="Volume controller"
                />
              </div>

            </div>

          </div>

        </div>

        {/* Selection of different audios - ONLY the title of the sermon */}
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 text-left">
            <span className="text-[10px] font-bold tracking-widest uppercase text-[#60899b]">
              SELECT A SERMON TO LISTEN
            </span>
          </div>

          <div className="space-y-2.5">
            {sermons.map((sermon, idx) => {
              const isSelected = selectedIndex === idx;
              return (
                <button
                  key={sermon.id || idx}
                  type="button"
                  onClick={() => handleSelectSermon(idx, true)}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-200 border flex items-center justify-between group ${
                    isSelected
                      ? 'bg-[#285c73] text-white border-[#285c73] shadow-sm'
                      : 'bg-white text-[#214b60] border-[#dcebf0] hover:border-[#4b9fb9] hover:bg-[#f0f7fa]'
                  }`}
                  aria-pressed={isSelected}
                >
                  {/* ONLY the title of the sermon */}
                  <span className="font-medium text-xs sm:text-sm md:text-base pr-3 leading-snug">
                    {sermon.title}
                  </span>

                  <span className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                    isSelected ? 'bg-white text-[#285c73]' : 'bg-[#e4f3f8] text-[#285c73] group-hover:scale-105'
                  }`}>
                    {isSelected && isPlaying ? (
                      <Pause className="w-3.5 h-3.5 fill-current" />
                    ) : (
                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
