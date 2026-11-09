import React, { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Pause, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  RotateCw,
  ExternalLink,
  Headphones,
  Radio,
  Download,
  AlertCircle
} from 'lucide-react';
import { 
  ARCHIVE_COLLECTION_URL, 
  ARCHIVE_EMBED_URL, 
  DEFAULT_AUDIO_SERMONS 
} from '../utils/defaultSermons';
import { useData } from '../context/DataContext';

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
  const { audioSermons } = useData();
  const sermons = audioSermons && audioSermons.length > 0 ? audioSermons : DEFAULT_AUDIO_SERMONS;

  const [activeTab, setActiveTab] = useState('embed'); // 'embed' | 'direct'
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
  const safeAudioUrl = currentSermon?.audio_url ? encodeURI(decodeURI(currentSermon.audio_url)) : '';

  // Sync volume and muted state to audio element
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
      audioRef.current.muted = isMuted;
    }
  }, [volume, isMuted]);

  // Audio stream event listeners for direct player
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
      setAudioError('Audio stream error. You can also listen directly via the Internet Archive player.');
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

  // Lock screen media session
  useEffect(() => {
    if (typeof window !== 'undefined' && 'mediaSession' in navigator && currentSermon) {
      try {
        navigator.mediaSession.metadata = new window.MediaMetadata({
          title: currentSermon.title || 'Audio Sermon',
          artist: 'सुगम प्रार्थना भवन (Sugam Prathana Bhawan)',
          album: 'Sugam Church Bachan'
        });
        navigator.mediaSession.setActionHandler('play', () => {
          if (audioRef.current) audioRef.current.play().then(() => setIsPlaying(true)).catch(() => {});
        });
        navigator.mediaSession.setActionHandler('pause', () => {
          if (audioRef.current) {
            audioRef.current.pause();
            setIsPlaying(false);
          }
        });
      } catch (err) {
        // mediaSession not supported
      }
    }
  }, [currentSermon]);

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
        setAudioError('Unable to stream this audio track. Check your connection or use the Archive.org player.');
      });
    }
  };

  const handleSelectSermon = (index, autoPlay = true) => {
    setActiveTab('direct');
    if (index === selectedIndex) {
      togglePlay();
      return;
    }

    setSelectedIndex(index);
    setAudioError(null);
    setCurrentTime(0);

    const targetSermon = sermons[index];
    if (autoPlay && targetSermon?.audio_url) {
      setIsLoadingAudio(true);
      const targetUrl = encodeURI(decodeURI(targetSermon.audio_url));
      setTimeout(() => {
        const audio = audioRef.current;
        if (audio) {
          audio.src = targetUrl;
          audio.currentTime = 0;
          audio.volume = isMuted ? 0 : volume;
          audio.muted = isMuted;
          audio.play().then(() => {
            setIsPlaying(true);
            setIsLoadingAudio(false);
          }).catch((err) => {
            console.warn('Playback error:', err);
            setIsLoadingAudio(false);
          });
        }
      }, 50);
    }
  };

  const handleSkip = (seconds) => {
    const audio = audioRef.current;
    if (!audio) return;
    const current = typeof audio.currentTime === 'number' && !isNaN(audio.currentTime) ? audio.currentTime : 0;
    const total = duration || 9999;
    const target = Math.min(Math.max(current + seconds, 0), total);
    audio.currentTime = target;
    setCurrentTime(target);
  };

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

  const handleVolumeChange = (e) => {
    const newVol = parseFloat(e.target.value);
    setVolume(newVol);
    if (audioRef.current) audioRef.current.volume = newVol;
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
      className="church-section cv-auto bg-gradient-to-b from-[#f0f7fa] via-[#e8f3f8] to-[#f8fafc] border-t border-white/80 py-16 sm:py-24"
      aria-labelledby="audio-sermons-heading"
    >
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        
        {/* Section Heading */}
        <div className="church-section-heading text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/80 backdrop-blur-md border border-white/95 shadow-2xs text-[#285c73] text-xs font-bold uppercase tracking-wider mb-3">
            <Radio className="w-3.5 h-3.5 text-[#4b9fb9] animate-pulse" />
            <span>DIRECT AUDIO SERMON</span>
          </div>
          <h2 id="audio-sermons-heading" className="text-3xl sm:text-5xl font-serif font-bold text-[#214b60]">
            Audio <em>Sermon.</em>
          </h2>
          <p className="text-sm sm:text-base text-[#395e70] max-w-2xl mx-auto mt-2">
            Listen to weekly preachings and spiritual messages directly from Sugam Church's official Internet Archive collection.
          </p>
        </div>

        {/* Player Navigation / Mode Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-white/75 backdrop-blur-xl p-2.5 rounded-2xl border border-white/95 shadow-[0_8px_30px_rgba(33,75,96,0.05),inset_0_1px_1px_rgba(255,255,255,0.95)]">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setActiveTab('embed')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'embed'
                  ? 'bg-gradient-to-r from-[#214b60] to-[#285c73] text-white shadow-xs'
                  : 'text-[#214b60] hover:bg-white/80'
              }`}
            >
              <Radio className="w-4 h-4 text-[#7cc5dc]" />
              <span>Internet Archive Player</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('direct')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition flex items-center gap-2 ${
                activeTab === 'direct'
                  ? 'bg-gradient-to-r from-[#214b60] to-[#285c73] text-white shadow-xs'
                  : 'text-[#214b60] hover:bg-white/80'
              }`}
            >
              <Headphones className="w-4 h-4 text-[#4b9fb9]" />
              <span>Track Streamer ({sermons.length})</span>
            </button>
          </div>

          <a
            href={ARCHIVE_COLLECTION_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/80 hover:bg-white text-[#285c73] hover:text-[#214b60] text-xs font-semibold border border-white/90 shadow-2xs transition hover:scale-105"
            title="Open on Internet Archive (sugam_202610)"
          >
            <span>Open on Internet Archive</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* 1. INTERNET ARCHIVE EMBEDDED PLAYER (Direct playback of https://archive.org/details/sugam_202610/) */}
        {activeTab === 'embed' && (
          <div className="bg-white/85 backdrop-blur-2xl rounded-3xl p-4 sm:p-6 border border-white/95 shadow-[0_15px_40px_-5px_rgba(33,75,96,0.08),inset_0_1px_2px_rgba(255,255,255,1)] mb-10 transition-all animate-fade-in">
            <div className="flex items-center justify-between mb-3 px-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#4b9fb9] flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                Live Internet Archive Stream
              </span>
              <span className="text-xs text-[#60899b] font-medium">
                Collection: sugam_202610
              </span>
            </div>

            <div className="w-full overflow-hidden rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
              <iframe 
                src={ARCHIVE_EMBED_URL}
                width="100%" 
                height="380" 
                frameBorder="0" 
                webkitallowfullscreen="true" 
                mozallowfullscreen="true" 
                allowFullScreen
                allow="autoplay; fullscreen"
                loading="lazy"
                title="Sugam Church Bachan Audio Sermons - Internet Archive"
                className="w-full block"
              />
            </div>
            
            <p className="text-[11px] sm:text-xs text-[#60899b] text-center mt-3">
              Directly streaming Bachan sermons uploaded by Sugam Prathana Bhawan. Click any track inside the player to play.
            </p>
          </div>
        )}

        {/* 2. DIRECT HIGH-FIDELITY TRACK STREAMER */}
        {activeTab === 'direct' && (
          <div className="bg-white/85 backdrop-blur-2xl rounded-3xl p-6 sm:p-10 border border-white/95 shadow-[0_15px_40px_-5px_rgba(33,75,96,0.08),inset_0_1px_2px_rgba(255,255,255,1)] mb-10 text-center transition-all animate-fade-in">
            {/* Audio Element */}
            <audio
              ref={audioRef}
              src={safeAudioUrl}
              preload="metadata"
              playsInline
            />

            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-widest text-[#4b9fb9] mb-2 block">
              {isPlaying ? 'Now Playing Bachan' : 'Selected Audio Sermon'}
            </span>

            <h3 className="font-serif text-2xl sm:text-3xl text-[#214b60] font-normal mb-2 leading-snug max-w-2xl mx-auto">
              {currentSermon?.title}
            </h3>

            <p className="text-xs sm:text-sm text-[#60899b] mb-6">
              {currentSermon?.description || 'सुगम प्रार्थना भवनको साप्ताहिक बचन सन्देश'}
            </p>

            {audioError && (
              <div className="mb-6 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-center gap-2 max-w-lg mx-auto">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{audioError}</span>
              </div>
            )}

            {/* Scrubber Progress Bar */}
            <div className="max-w-xl mx-auto space-y-4">
              <div className="space-y-1.5">
                <div 
                  ref={progressBarRef}
                  onClick={handleSeek}
                  className="relative h-2.5 bg-[#dceef5] rounded-full cursor-pointer overflow-hidden border border-[#cde2ec]"
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

                <div className="flex justify-between items-center text-xs font-mono text-[#60899b]">
                  <span>{formatTime(currentTime)}</span>
                  <span>{isLoadingAudio ? 'Buffering...' : formatTime(duration)}</span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 sm:gap-6 pt-2">
                <button
                  type="button"
                  onClick={() => handleSkip(-15)}
                  className="w-10 h-10 rounded-full bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#285c73] flex items-center justify-center transition-colors border border-[#dcebf0]"
                  title="Skip backward 15 seconds"
                  aria-label="Skip backward 15 seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

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

                <button
                  type="button"
                  onClick={() => handleSkip(15)}
                  className="w-10 h-10 rounded-full bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#285c73] flex items-center justify-center transition-colors border border-[#dcebf0]"
                  title="Skip forward 15 seconds"
                  aria-label="Skip forward 15 seconds"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

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
        )}

        {/* 3. TRACKS LIST (All 7 sermon recordings in sugam_202610) */}
        <div className="max-w-3xl mx-auto">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-widest uppercase text-[#60899b]">
              SERMON RECORDINGS IN THIS COLLECTION ({sermons.length})
            </span>
            <span className="text-xs text-[#285c73] font-semibold">
              Internet Archive: sugam_202610
            </span>
          </div>

          <div className="space-y-2.5">
            {sermons.map((sermon, idx) => {
              const isSelected = activeTab === 'direct' && selectedIndex === idx;
              return (
                <div
                  key={sermon.id || idx}
                  className={`w-full text-left px-5 py-4 rounded-2xl transition-all duration-200 border flex items-center justify-between group ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#214b60] to-[#285c73] text-white border-transparent shadow-md'
                      : 'bg-white/75 backdrop-blur-md text-[#214b60] border-white/85 hover:border-[#4b9fb9]/50 hover:bg-white/95 shadow-2xs'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleSelectSermon(idx, true)}
                    className="flex-1 text-left flex flex-col sm:flex-row sm:items-center justify-between gap-1 pr-3"
                    aria-label={`Play ${sermon.title}`}
                  >
                    <span className="font-semibold text-xs sm:text-sm md:text-base leading-snug">
                      {sermon.title}
                    </span>
                    <span className={`text-[11px] font-mono ${isSelected ? 'text-[#dceef5]' : 'text-[#60899b]'}`}>
                      {sermon.duration}
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    <a
                      href={sermon.audio_url}
                      download={sermon.file_name}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isSelected 
                          ? 'bg-white/20 hover:bg-white/30 text-white' 
                          : 'bg-[#edf6fa] hover:bg-[#dceef5] text-[#285c73]'
                      }`}
                      title="Download audio recording (.m4a)"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </a>

                    <button
                      type="button"
                      onClick={() => handleSelectSermon(idx, true)}
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform ${
                        isSelected ? 'bg-white text-[#285c73]' : 'bg-[#e4f3f8] text-[#285c73] group-hover:scale-105'
                      }`}
                      title={isSelected && isPlaying ? 'Pause' : 'Play'}
                    >
                      {isSelected && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 fill-current" />
                      ) : (
                        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </section>
  );
}
