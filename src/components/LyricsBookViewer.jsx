import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  Search, 
  Music, 
  Eye, 
  EyeOff, 
  Maximize2, 
  Minimize2, 
  Printer, 
  Copy, 
  Check, 
  ArrowLeft, 
  SlidersHorizontal, 
  BookOpen, 
  Sparkles,
  ChevronRight,
  RotateCcw,
  Volume2,
  FileText
} from 'lucide-react';
import { 
  transposeSongSections, 
  transposeChord, 
  formatSongToText,
  chordsToChordLine,
  transposeChordLine
} from '../utils/lyricsChordParser';

export default function LyricsBookViewer({ 
  songs = [], 
  loading = false, 
  initialSongId = null,
  onOpenAdmin = null
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedLanguage, setSelectedLanguage] = useState('All');
  const [activeSong, setActiveSong] = useState(null);
  
  // Viewer state
  const [showChords, setShowChords] = useState(true);
  const [transposeSemitones, setTransposeSemitones] = useState(0);
  const [rehearsalMode, setRehearsalMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [fontSize, setFontSize] = useState('normal'); // 'compact', 'normal', 'large'

  const viewerContainerRef = useRef(null);

  // Filter only published songs for choir members
  const publishedSongs = useMemo(() => {
    return (songs || []).filter(s => s.status === 'published');
  }, [songs]);

  // Handle URL or prop initialSongId
  useEffect(() => {
    if (initialSongId && publishedSongs.length > 0) {
      const match = publishedSongs.find(s => s.id === initialSongId);
      if (match) {
        setActiveSong(match);
        setTransposeSemitones(0);
      }
    }
  }, [initialSongId, publishedSongs]);

  // Extract unique categories & languages for filters
  const categories = useMemo(() => {
    const set = new Set();
    publishedSongs.forEach(s => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return ['All', ...Array.from(set)];
  }, [publishedSongs]);

  const languages = useMemo(() => {
    const set = new Set();
    publishedSongs.forEach(s => {
      if (s.language && s.language.trim()) set.add(s.language.trim());
    });
    return ['All', ...Array.from(set)];
  }, [publishedSongs]);

  // Filtered song list
  const filteredSongs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return publishedSongs.filter(song => {
      const matchesCategory = selectedCategory === 'All' || song.category === selectedCategory;
      const matchesLanguage = selectedLanguage === 'All' || song.language === selectedLanguage;
      
      if (!matchesCategory || !matchesLanguage) return false;
      if (!query) return true;

      const titleMatch = (song.title || '').toLowerCase().includes(query);
      const authorMatch = (song.author || '').toLowerCase().includes(query);
      const lyricsMatch = (song.search_text || '').toLowerCase().includes(query);

      return titleMatch || authorMatch || lyricsMatch;
    });
  }, [publishedSongs, searchQuery, selectedCategory, selectedLanguage]);

  // Transposed sections for active song
  const currentSections = useMemo(() => {
    if (!activeSong) return [];
    return transposeSongSections(activeSong.sections || [], transposeSemitones);
  }, [activeSong, transposeSemitones]);

  // Displayed key
  const displayedKey = useMemo(() => {
    if (!activeSong) return 'G';
    const baseKey = activeSong.key_signature || activeSong.keySignature || 'G';
    return transposeChord(baseKey, transposeSemitones);
  }, [activeSong, transposeSemitones]);

  const handleSelectSong = (song) => {
    setActiveSong(song);
    setTransposeSemitones(0);
    // Smooth scroll into viewer
    setTimeout(() => {
      viewerContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleCopyLyrics = async () => {
    if (!activeSong) return;
    const text = formatSongToText(currentSections, showChords);
    try {
      await navigator.clipboard.writeText(`${activeSong.title}\nKey: ${displayedKey}\n\n${text}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  // Resolve chord line for display with exact spacing and transposition
  const getDisplayChordLine = (line, semitones = 0) => {
    const raw = line.chord_line !== undefined && line.chord_line !== null
      ? line.chord_line
      : chordsToChordLine(line.chords || []);
    if (!raw || !raw.trim()) return '';
    if (semitones === 0) return raw;
    return transposeChordLine(raw, semitones);
  };

  return (
    <div ref={viewerContainerRef} className="w-full font-sans transition-all">
      
      {/* =========================================================================
          VIEW A: ACTIVE SONG DETAIL & CHORD VIEWER
         ========================================================================= */}
      {activeSong ? (
        <div className={`rounded-3xl border transition-all duration-300 ${
          rehearsalMode 
            ? 'bg-slate-950 text-white border-slate-800 shadow-2xl p-4 sm:p-8' 
            : 'bg-white text-[#214b60] border-[#d4e8ee] shadow-sm p-4 sm:p-8'
        }`}>
          
          {/* Top Bar / Navigation */}
          <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-inherit/20 mb-6">
            <button
              onClick={() => setActiveSong(null)}
              className={`self-start inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold transition hover:scale-105 active:scale-95 ${
                rehearsalMode
                  ? 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73]'
              }`}
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Song Library</span>
            </button>

            {/* Viewer Controls */}
            <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
              
              {/* Show/Hide Chords Toggle */}
              <button
                onClick={() => setShowChords(!showChords)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition ${
                  showChords
                    ? (rehearsalMode ? 'bg-[#4b9fb9] text-white border-[#4b9fb9]' : 'bg-[#285c73] text-white border-[#285c73]')
                    : (rehearsalMode ? 'bg-slate-900 text-slate-300 border-slate-700' : 'bg-slate-100 text-slate-700 border-slate-200')
                }`}
                title="Toggle chord visibility"
              >
                {showChords ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                <span>{showChords ? 'Chords On' : 'Lyrics Only'}</span>
              </button>

              {/* Transpose Controls */}
              {showChords && (
                <div className={`flex items-center rounded-xl border p-1 text-xs font-semibold ${
                  rehearsalMode ? 'bg-slate-900 border-slate-800 text-slate-200' : 'bg-white border-[#d4e8ee]'
                }`}>
                  <span className="px-2 text-[10px] text-slate-400 font-medium hidden sm:inline">KEY:</span>
                  <button
                    onClick={() => setTransposeSemitones(prev => prev - 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/10 transition font-bold"
                    title="Transpose Down (-1)"
                  >
                    ♭
                  </button>
                  <span className="px-2 font-mono font-bold text-[#4b9fb9] min-w-[28px] text-center">
                    {displayedKey}
                  </span>
                  <button
                    onClick={() => setTransposeSemitones(prev => prev + 1)}
                    className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-black/10 transition font-bold"
                    title="Transpose Up (+1)"
                  >
                    ♯
                  </button>
                  {transposeSemitones !== 0 && (
                    <button
                      onClick={() => setTransposeSemitones(0)}
                      className="ml-1 p-1 text-slate-400 hover:text-rose-500 rounded"
                      title="Reset Key Transpose"
                    >
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Font Size Selector */}
              <div className={`hidden md:flex items-center rounded-xl border p-1 text-xs ${
                rehearsalMode ? 'bg-slate-900 border-slate-800 text-slate-300' : 'bg-white border-[#d4e8ee]'
              }`}>
                <button
                  onClick={() => setFontSize('compact')}
                  className={`px-2 py-1 rounded-lg font-bold text-[10px] ${fontSize === 'compact' ? 'bg-[#4b9fb9] text-white' : ''}`}
                  title="Compact font"
                >
                  A-
                </button>
                <button
                  onClick={() => setFontSize('normal')}
                  className={`px-2 py-1 rounded-lg font-bold text-xs ${fontSize === 'normal' ? 'bg-[#4b9fb9] text-white' : ''}`}
                  title="Normal font"
                >
                  A
                </button>
                <button
                  onClick={() => setFontSize('large')}
                  className={`px-2 py-1 rounded-lg font-bold text-sm ${fontSize === 'large' ? 'bg-[#4b9fb9] text-white' : ''}`}
                  title="Large rehearsal font"
                >
                  A+
                </button>
              </div>

              {/* Copy Song */}
              <button
                onClick={handleCopyLyrics}
                className={`p-2 rounded-xl border transition ${
                  copied 
                    ? 'bg-emerald-600 text-white border-emerald-600' 
                    : (rehearsalMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800' : 'bg-white hover:bg-[#e4f3f8] text-[#285c73] border-[#d4e8ee]')
                }`}
                title="Copy lyrics & chords to clipboard"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>

              {/* Print Friendly Sheet */}
              <button
                onClick={handlePrint}
                className={`p-2 rounded-xl border transition ${
                  rehearsalMode ? 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800' : 'bg-white hover:bg-[#e4f3f8] text-[#285c73] border-[#d4e8ee]'
                }`}
                title="Print Choir Song Sheet"
              >
                <Printer className="w-4 h-4" />
              </button>

              {/* Distraction-Free Rehearsal Mode */}
              <button
                onClick={() => setRehearsalMode(!rehearsalMode)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition ${
                  rehearsalMode
                    ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                    : 'bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73] border-[#d4e8ee]'
                }`}
                title="Toggle high-contrast choir rehearsal mode"
              >
                {rehearsalMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{rehearsalMode ? 'Normal Mode' : 'Rehearsal Mode'}</span>
              </button>

            </div>
          </div>

          {/* Song Header */}
          <div className="mb-8 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
              {activeSong.category && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  rehearsalMode ? 'bg-slate-800 text-[#7cc5dc]' : 'bg-[#dceef5] text-[#214b60]'
                }`}>
                  {activeSong.category}
                </span>
              )}
              {activeSong.language && (
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                  rehearsalMode ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-600'
                }`}>
                  {activeSong.language}
                </span>
              )}
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                rehearsalMode ? 'bg-[#4b9fb9]/20 text-[#7cc5dc]' : 'bg-[#e4f3f8] text-[#285c73]'
              }`}>
                Key: {displayedKey} {activeSong.time_signature ? `• ${activeSong.time_signature}` : ''}
              </span>
            </div>

            <h1 className="font-serif text-3xl sm:text-5xl font-bold tracking-tight mb-2">
              {activeSong.title}
            </h1>

            {activeSong.author && (
              <p className={`text-xs sm:text-sm font-medium ${rehearsalMode ? 'text-slate-400' : 'text-[#395e70]'}`}>
                Written / Sourced by: <span className="font-semibold">{activeSong.author}</span>
              </p>
            )}
          </div>

          {/* Song Content & Chord Rendering */}
          <div className={`space-y-7 ${
            fontSize === 'compact' ? 'text-sm' : fontSize === 'large' ? 'text-xl' : 'text-base'
          }`}>
            {currentSections.length > 0 ? (
              currentSections.map((section, sIdx) => (
                <div 
                  key={section.id || sIdx} 
                  className={`rounded-2xl p-4 sm:p-6 transition-all ${
                    rehearsalMode 
                      ? 'bg-slate-900/60 border border-slate-800/80' 
                      : 'bg-[#f8faf7] border border-[#d4e8ee]/80'
                  }`}
                >
                  {section.title && (
                    <div className="flex items-center gap-2 mb-4">
                      <span className={`text-xs font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-md ${
                        rehearsalMode 
                          ? 'bg-slate-800 text-[#7cc5dc]' 
                          : 'bg-[#e4f3f8] text-[#285c73]'
                      }`}>
                        {section.title}
                      </span>
                      <div className={`h-px flex-1 ${rehearsalMode ? 'bg-slate-800' : 'bg-[#d4e8ee]'}`} />
                    </div>
                  )}

                  <div className="space-y-4">
                    {(section.lines || []).map((line, lIdx) => {
                      const displayChordLine = getDisplayChordLine(line, transposeSemitones);
                      return (
                        <div key={line.id || lIdx} className="overflow-x-auto no-scrollbar py-0.5">
                          
                          {/* Upper Layer: Chords */}
                          {showChords && displayChordLine && displayChordLine.trim() && (
                            <div 
                              className={`font-mono font-bold tracking-normal select-none whitespace-pre leading-none pb-1 ${
                                fontSize === 'compact' ? 'text-xs' : fontSize === 'large' ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                              } ${
                                rehearsalMode ? 'text-[#7cc5dc]' : 'text-[#285c73]'
                              }`}
                            >
                              {displayChordLine}
                            </div>
                          )}

                          {/* Lower Layer: Lyrics */}
                          <div className={`font-mono font-medium tracking-normal select-text whitespace-pre leading-relaxed ${
                            fontSize === 'compact' ? 'text-xs sm:text-sm' : fontSize === 'large' ? 'text-lg sm:text-xl' : 'text-sm sm:text-base'
                          } ${
                            rehearsalMode ? 'text-slate-100' : 'text-[#214b60]'
                          }`}>
                            {line.text || <span className="opacity-40 italic font-sans text-xs">[Instrumental break]</span>}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-slate-400 italic">No lyric lines available for this song.</p>
            )}
          </div>

          {/* Footer details */}
          <div className="mt-8 pt-4 border-t border-inherit/20 flex flex-wrap items-center justify-between gap-3 text-xs opacity-70">
            <div>
              <span>Sugam Prathana Bhawan • Choir Songbook</span>
              {activeSong.version && <span className="ml-2 font-mono">v{activeSong.version}</span>}
            </div>
            <div className="font-mono">
              Key: {displayedKey} | {activeSong.time_signature || '4/4'}
            </div>
          </div>

        </div>
      ) : (
        /* =========================================================================
            VIEW B: SONG LIBRARY (BROWSE & SEARCH)
           ========================================================================= */
        <div>
          
          {/* Header & Search */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#d4e8ee] shadow-sm mb-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#e4f3f8] text-[#285c73] text-xs font-bold uppercase tracking-wider mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#4b9fb9]" />
                  <span>Choir Songbook Library</span>
                </div>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#214b60]">
                  Sugam Lyrics Book
                </h3>
                <p className="text-xs sm:text-sm text-[#395e70] mt-1">
                  Search choir worship songs, hymns, and practice lyrics with structured chords.
                </p>
              </div>

              {/* Total Published Songs Badge */}
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#dceef5] text-[#214b60] border border-[#d4e8ee]">
                  {publishedSongs.length} Songs Available
                </span>
              </div>
            </div>

            {/* Search Input & Filter Pills */}
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52788d] pointer-events-none" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by title, lyrics, or author..."
                  className="w-full pl-10 pr-4 py-3 bg-[#f8faf7] border border-[#d4e8ee] rounded-2xl text-xs sm:text-sm font-medium text-[#214b60] placeholder-[#52788d] focus:outline-none focus:ring-2 focus:ring-[#285c73] transition-all"
                />
              </div>

              {/* Category Filter Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
                {categories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                      selectedCategory === cat
                        ? 'bg-[#285c73] text-white shadow-xs'
                        : 'bg-[#f8faf7] hover:bg-[#e4f3f8] text-[#214b60] border border-[#d4e8ee]'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Language filter pills if multiple */}
            {languages.length > 2 && (
              <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-[#d4e8ee]/50 text-xs">
                <span className="text-[#52788d] text-[11px] font-bold uppercase tracking-wider mr-1">Language:</span>
                {languages.map(lang => (
                  <button
                    key={lang}
                    onClick={() => setSelectedLanguage(lang)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                      selectedLanguage === lang
                        ? 'bg-[#4b9fb9] text-white font-bold'
                        : 'text-[#214b60] hover:bg-[#e4f3f8]'
                    }`}
                  >
                    {lang}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Songs Grid */}
          {loading ? (
            <div className="py-20 text-center">
              <div className="w-9 h-9 border-3 border-[#285c73] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs font-semibold uppercase tracking-wider text-[#52788d]">Loading songbook...</p>
            </div>
          ) : filteredSongs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSongs.map(song => {
                const totalLines = (song.sections || []).reduce((acc, s) => acc + (s.lines || []).length, 0);
                const totalChords = (song.sections || []).reduce((acc, s) => {
                  return acc + (s.lines || []).reduce((lAcc, l) => lAcc + (l.chords || []).length, 0);
                }, 0);

                return (
                  <article
                    key={song.id}
                    onClick={() => handleSelectSong(song)}
                    className="group bg-white rounded-3xl p-5 border border-[#d4e8ee] shadow-sm hover:shadow-md hover:border-[#4b9fb9] hover:-translate-y-1 transition-all duration-200 cursor-pointer flex flex-col justify-between"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-[#dceef5] text-[#214b60]">
                          {song.category || 'Worship'}
                        </span>
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[#f0f7fa] text-[#285c73] border border-[#d4e8ee]">
                          Key: {song.key_signature || song.keySignature || 'G'}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="font-serif text-lg sm:text-xl font-bold text-[#214b60] group-hover:text-[#4b9fb9] transition-colors line-clamp-1 mb-1">
                        {song.title}
                      </h4>

                      {/* Author */}
                      <p className="text-xs text-[#52788d] line-clamp-1 mb-4">
                        {song.author ? `By ${song.author}` : 'Sugam Church Choir'}
                      </p>

                      {/* Lyric Preview Snippet */}
                      <div className="p-3 rounded-2xl bg-[#f8faf7] border border-[#d4e8ee]/60 text-xs text-[#395e70] font-sans line-clamp-2 leading-relaxed mb-4">
                        {(song.sections?.[0]?.lines?.[0]?.text) || 'Open to view full chords and lyrics...'}
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div className="pt-3 border-t border-[#d4e8ee]/60 flex items-center justify-between">
                      <div className="text-[11px] text-[#52788d] flex items-center gap-2">
                        <span>{totalLines} lines</span>
                        {totalChords > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-[#285c73] font-semibold">{totalChords} chords</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        className="inline-flex items-center gap-1 text-xs font-bold text-[#285c73] group-hover:text-[#4b9fb9] transition-colors"
                      >
                        <span>Open Song</span>
                        <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-dashed border-[#d4e8ee] p-12 text-center">
              <Music className="w-12 h-12 text-[#9bbcc9] mx-auto mb-3" />
              {publishedSongs.length === 0 ? (
                <>
                  <h4 className="font-serif text-xl font-bold text-[#214b60] mb-2">
                    गीत संग्रह खाली छ (No Songs in Songbook Yet)
                  </h4>
                  <p className="text-xs sm:text-sm text-[#52788d] max-w-md mx-auto mb-2 leading-relaxed">
                    सुगम मण्डलीको गीत संग्रह अहिले खाली छ। नयाँ भजन र आत्मिक गीतहरू चाँडै उपलब्ध हुनेछन्।
                  </p>
                </>
              ) : (
                <>
                  <h4 className="font-serif text-lg font-bold text-[#214b60] mb-1">
                    कुनै मिल्दो गीत भेटिएन (No Matching Songs Found)
                  </h4>
                  <p className="text-xs text-[#52788d] max-w-sm mx-auto mb-4">
                    कृपया शीर्षक, शब्द, वा भाषा फेरेर फेरि खोज्नुहोस् वा फिल्टर हटाउनुहोस्।
                  </p>
                  <button
                    onClick={() => { setSearchQuery(''); setSelectedCategory('All'); setSelectedLanguage('All'); }}
                    className="px-4 py-2 bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73] rounded-xl text-xs font-semibold transition"
                  >
                    फिल्टर हटाउनुहोस् (Clear Filters)
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      )}

    </div>
  );
}

/**
 * Structured Chord Line Component: renders chords cleanly positioned above words
 * without proportional font breaking or clipping.
 */
function StructuredChordLine({ chords = [], textLength = 40 }) {
  if (!Array.isArray(chords) || chords.length === 0) return null;

  const sorted = [...chords].sort((a, b) => a.position - b.position);
  let chordString = '';
  let cursor = 0;

  for (const c of sorted) {
    const targetPos = Math.max(cursor, c.position || 0);
    const spaces = Math.max(0, targetPos - cursor);
    chordString += ' '.repeat(spaces) + c.chord;
    cursor = chordString.length;
  }

  return (
    <span className="inline-block whitespace-pre font-mono font-bold tracking-tight">
      {chordString}
    </span>
  );
}
