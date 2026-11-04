import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { extractYouTubeId } from '../utils/dataSyncEngine';
import PDFViewer from '../components/PDFViewer';
import LyricsBookViewer from '../components/LyricsBookViewer';
import { 
  Music, 
  Calendar, 
  Bell, 
  Search, 
  FileText, 
  History, 
  RotateCw,
  Play,
  Presentation
} from 'lucide-react';

function YoutubeIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

const FALLBACK_RESOURCES = [
  { name: "Choir Songs Collection", file: "SONGS.pdf" },
  { name: "Boys & Girls Transpose Chart", file: "BOYS-GIRLSTRANSPOSE.png" }
];

function resolveResourceUrl(res, defaultFolder = '/static/') {
  if (!res) return '';
  const file = res.fileUrl || res.file_url || res.file;
  if (!file || typeof file !== 'string') return '';
  if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('/') || file.startsWith('data:')) {
    return file;
  }
  return `${defaultFolder}${encodeURIComponent(file)}`;
}

export default function ChoirPage() {
  const { choirData, youtubeData, documents, lyricsSongs, loading, refreshData } = useData();
  const [resources, setResources] = useState(FALLBACK_RESOURCES);
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingVideoId, setPlayingVideoId] = useState(null);

  // Tab between interactive Sugam Lyrics Book and PDF/Image documents
  const initialHash = typeof window !== 'undefined' ? window.location.hash : '';
  const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const initialTab = (initialHash === '#lyrics-book' || initialHash === '#lyrics' || searchParams?.get('tab') === 'lyrics')
    ? 'lyrics'
    : 'lyrics'; // default to lyrics book as modern primary experience
  const [resourceTab, setResourceTab] = useState(initialTab);

  // Fetch resource manifest if available, or sync from live documents
  useEffect(() => {
    const dbChoirDocs = documents?.choir || [];
    if (dbChoirDocs.length > 0) {
      setResources(dbChoirDocs.map(d => ({
        id: d.id,
        name: d.title || d.name || 'Resource Document',
        file: d.fileUrl || d.file_url || d.file || ''
      })));
      return;
    }

    fetch('/static/resource-manifest.json')
      .then(res => res.json())
      .then(manifest => {
        const files = Array.isArray(manifest) ? manifest : manifest.files || [];
        if (files.length > 0) {
          const parsed = files.map(f => ({
            name: typeof f === 'string' ? f.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Resource Document',
            file: f
          }));
          setResources(parsed);
        }
      })
      .catch(() => {
        // use default fallback
      });
  }, [documents?.choir]);

  // Filter YouTube Songs
  const songs = youtubeData.songs || [];
  const filteredSongs = songs.filter(s => 
    (s.name || '').toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const safeResourceIndex = (resources.length > 0 && selectedResourceIndex >= 0 && selectedResourceIndex < resources.length)
    ? selectedResourceIndex
    : 0;
  const activeResource = resources[safeResourceIndex] || resources[0];
  const activeResourceUrl = resolveResourceUrl(activeResource, '/static/');

  return (
    <div className="flex flex-col min-h-screen font-sans">
      
      {/* 1. Hero Section */}
      <header className="relative w-full h-[70vh] sm:h-[80vh] flex items-center justify-center overflow-hidden pt-20">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[12s] ease-in-out hover:scale-105" 
          style={{ backgroundImage: "url('/images/choir2.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0f2835]/90 via-[#183c4e]/75 to-[#0f2835]/95" />
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-[#e4f3f8] text-xs font-bold uppercase tracking-widest mb-4 backdrop-blur-md shadow-2xs">
            <Music className="w-3.5 h-3.5 text-[#7cc5dc]" />
            Sugam Prathana Bhawan
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold text-white mb-4 leading-tight drop-shadow-lg tracking-tight">
            Church Choir Ministry
          </h1>

          <p className="text-base sm:text-2xl text-[#e4f3f8] font-light mb-8 drop-shadow max-w-2xl">
            Glorifying God through worship, choral praise, vocal training, and unity.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <a
              href="#resources"
              onClick={() => setResourceTab('lyrics')}
              className="px-7 py-3 bg-[#4b9fb9] hover:bg-[#3d8da6] text-white font-bold rounded-full shadow-lg shadow-[#4b9fb9]/30 hover:-translate-y-0.5 transition-all text-sm hover:scale-105 flex items-center gap-2"
            >
              <Music className="w-4 h-4" />
              <span>Sugam Lyrics Book</span>
            </a>
            <Link
              to="/zensync"
              className="px-7 py-3 bg-[#285c73] hover:bg-[#214b60] text-white font-bold rounded-full shadow-lg shadow-[#285c73]/30 hover:-translate-y-0.5 transition-all text-sm hover:scale-105 flex items-center gap-2"
            >
              <Presentation className="w-4 h-4" />
              <span>Zen Sync Live</span>
            </Link>
            <a
              href="#choir-routine"
              className="px-7 py-3 bg-white/15 hover:bg-white/25 text-white font-semibold rounded-full border border-white/30 hover:-translate-y-0.5 transition-all text-sm backdrop-blur-md hover:scale-105"
            >
              View Routine
            </a>
            <a 
              href="#youtube-songs" 
              className="px-7 py-3 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-full shadow-lg hover:-translate-y-0.5 transition-all text-sm flex items-center gap-2 hover:scale-105"
            >
              <YoutubeIcon className="w-4 h-4" />
              <span>Practice Songs</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Choir Notices & Routine Schedule */}
      <section id="choir-routine" className="py-16 sm:py-24 bg-[#f8faf7] px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="flex justify-center mb-3">
              <button
                onClick={refreshData}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73] text-xs font-semibold border border-[#d4e8ee] shadow-2xs transition-colors hover:scale-105"
                title="Sync routine from Supabase"
              >
                <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync Live</span>
              </button>
            </div>
            <span className="text-[#285c73] font-bold tracking-widest uppercase text-xs">Choir Fellowship</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-[#214b60] mt-1 tracking-tight">Notices &amp; Routine</h2>
            <div className="w-20 h-1 bg-[#4b9fb9] mx-auto rounded-full mt-4" />
          </div>

          {/* Notices */}
          {choirData.notices && choirData.notices.length > 0 && (
            <div className="mb-8 rounded-3xl border border-[#d4e8ee] bg-[#e4f3f8]/50 p-5 sm:p-7 shadow-xs flex items-start gap-4 animate-fade-in-up">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-[#285c73] text-white flex items-center justify-center shadow-xs">
                <Bell className="w-6 h-6" />
              </div>
              <div className="w-full">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-base sm:text-lg text-[#214b60]">Choir Notices</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#dceef5] text-[#214b60] uppercase">
                    Important
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-[#395e70]">
                  {choirData.notices.map((notice, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-[#4b9fb9] font-bold">•</span>
                      <span className="leading-relaxed">{notice}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Month Schedule Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-12">
            {(choirData.months || []).map((month, mIdx) => (
              <article 
                key={mIdx} 
                className="rounded-3xl overflow-hidden border border-[#d4e8ee] bg-white shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${mIdx * 0.1}s` }}
              >
                <header className="bg-[#214b60] text-white px-6 py-4 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-[#7cc5dc]" />
                  <h3 className="font-serif text-lg sm:text-xl font-bold uppercase tracking-wide">
                    {month.name}
                  </h3>
                </header>

                <div className="divide-y divide-[#d4e8ee]/60 p-2 sm:p-3">
                  {(month.dates || []).length > 0 ? (
                    month.dates.map((day, dIdx) => (
                      <div key={dIdx} className="p-4 rounded-2xl hover:bg-[#e4f3f8]/30 transition-colors">
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-[#dceef5] text-[#214b60] px-2.5 py-0.5 rounded-full mb-3">
                          Date: {day.date}
                        </span>

                        {(day.items || []).length > 0 ? (
                          <div className="space-y-2">
                            {day.items.map((item, iIdx) => (
                              <div key={iIdx} className="grid grid-cols-[auto_1fr] gap-x-3 text-xs sm:text-sm">
                                <time className="font-semibold text-[#214b60] whitespace-nowrap bg-[#f0f7fa] px-2 py-0.5 rounded-md h-fit">
                                  {item.time || 'Time TBA'}
                                </time>
                                <p className="text-[#395e70] font-medium leading-relaxed">
                                  {item.work || 'Practice / Activity'}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 italic">Routine details TBA.</p>
                        )}
                      </div>
                    ))
                  ) : (
                    <p className="p-5 text-xs text-slate-400 italic text-center">No schedule rows added.</p>
                  )}
                </div>
              </article>
            ))}
          </div>

          {/* Monthly Practice Layouts */}
          {choirData.layoutGroups && choirData.layoutGroups.length > 0 && (
            <section className="rounded-3xl border border-[#d4e8ee] bg-white p-6 sm:p-8 shadow-sm animate-fade-in-up">
              <div className="text-center mb-8">
                <span className="text-xs font-bold tracking-widest uppercase text-[#285c73]">Structure</span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-[#214b60] mt-1">Monthly Practice Layout</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {choirData.layoutGroups.map((group, gIdx) => (
                  <article key={gIdx} className="rounded-2xl overflow-hidden bg-white border border-[#d4e8ee] shadow-2xs">
                    <header className="bg-[#e4f3f8] px-5 py-3.5 border-b border-[#d4e8ee]">
                      <h4 className="font-bold text-sm sm:text-base text-[#214b60]">{group.title}</h4>
                    </header>

                    <div className="divide-y divide-[#d4e8ee]/50 p-2">
                      {(group.days || []).map((day, dayIdx) => (
                        <div key={dayIdx} className="p-4">
                          <h5 className="font-bold text-xs sm:text-sm text-[#285c73] mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#4b9fb9]"></span>
                            <span>{day.title || `${day.saturday} Saturday`}</span>
                          </h5>
                          <ul className="space-y-1.5 text-xs sm:text-sm text-[#395e70] pl-3">
                            {(day.activities || []).map((activity, actIdx) => (
                              <li key={actIdx} className="flex gap-2">
                                <span className="text-[#4b9fb9]">•</span>
                                <span>{activity}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

        </div>
      </section>

      {/* 3. Choir Songbook & Resources Viewer */}
      <section id="resources" className="py-20 bg-white px-4 sm:px-6 scroll-mt-20">
        <div id="lyrics-book" className="scroll-mt-24" />
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-8">
            <span className="text-[#285c73] font-bold tracking-widest uppercase text-xs">Songsheets &amp; Transpose</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-[#214b60] mt-1">Choir Resources</h2>
            <div className="w-20 h-1 bg-[#4b9fb9] mx-auto rounded-full mt-4" />
          </div>

          {/* Sub-Navigation Tabs inside Choir Resources */}
          <div className="flex justify-center mb-10">
            <div className="inline-flex p-1.5 rounded-2xl bg-[#f0f7fa] border border-[#d4e8ee] shadow-2xs gap-1.5">
              <button
                type="button"
                onClick={() => setResourceTab('lyrics')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  resourceTab === 'lyrics'
                    ? 'bg-[#285c73] text-white shadow-sm scale-[1.02]'
                    : 'text-[#214b60] hover:bg-[#e4f3f8]'
                }`}
              >
                <Music className="w-4 h-4" />
                <span>Sugam Lyrics Book</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  resourceTab === 'lyrics' ? 'bg-white/20 text-white' : 'bg-[#dceef5] text-[#214b60]'
                }`}>
                  {(lyricsSongs || []).filter(s => s.status === 'published').length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setResourceTab('documents')}
                className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  resourceTab === 'documents'
                    ? 'bg-[#285c73] text-white shadow-sm scale-[1.02]'
                    : 'text-[#214b60] hover:bg-[#e4f3f8]'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Songsheets &amp; Files</span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  resourceTab === 'documents' ? 'bg-white/20 text-white' : 'bg-[#dceef5] text-[#214b60]'
                }`}>
                  {resources.length}
                </span>
              </button>
            </div>
          </div>

          {/* TAB 1: Sugam Lyrics Book (Interactive Chord & Lyric Library) */}
          {resourceTab === 'lyrics' && (
            <div className="animate-fade-in">
              <LyricsBookViewer songs={lyricsSongs} loading={loading} />
            </div>
          )}

          {/* TAB 2: Songsheets & Document Files (Existing PDF / Transpose chart viewer) */}
          {resourceTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start animate-fade-in">
              
              {/* Available Files List */}
              <div className="lg:col-span-4 flex flex-col gap-3">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#d4e8ee]">
                  <div className="flex justify-between items-center mb-4 px-1">
                    <h3 className="text-lg font-bold text-[#214b60] flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#285c73]" />
                      <span>Available Files</span>
                    </h3>
                    <span className="text-xs font-bold bg-[#dceef5] text-[#214b60] px-2.5 py-0.5 rounded-full">
                      {resources.length}
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-[60vh] overflow-y-auto pr-1">
                    {resources.map((res, index) => {
                      const isSelected = selectedResourceIndex === index;
                      return (
                        <button
                          key={index}
                          onClick={() => setSelectedResourceIndex(index)}
                          className={`w-full text-left px-4 py-3.5 rounded-2xl transition-all duration-200 border flex items-center justify-between group ${
                            isSelected 
                              ? 'bg-[#285c73] text-white border-[#285c73] shadow-sm' 
                              : 'bg-white text-[#214b60] border-[#d4e8ee] hover:border-[#4b9fb9] hover:bg-[#e4f3f8]/50'
                          }`}
                        >
                          <span className="font-semibold text-xs sm:text-sm capitalize truncate pr-2">
                            {res.name}
                          </span>
                          <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#4b9fb9]'}`} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Viewer Pane */}
              <div className="lg:col-span-8">
                {activeResource && (
                  <PDFViewer
                    fileUrl={activeResourceUrl}
                    fileName={(activeResource.fileName || activeResource.file || activeResource.name) || 'document.pdf'}
                    title={activeResource.name || 'Choir Resource'}
                  />
                )}
              </div>

            </div>
          )}

        </div>
      </section>

      {/* 4. Worship Songs to Listen (YouTube Grid) */}
      <section id="youtube-songs" className="py-24 bg-[#f8faf7] px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-8">
            <span className="text-[#285c73] font-semibold tracking-widest uppercase text-xs">Worship Together</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-[#214b60] mt-1 mb-3">Songs to Listen</h2>
            <p className="text-[#395e70] max-w-xl mx-auto text-xs sm:text-sm">
              Listen to and practise choir songs and worship melodies directly from this portal.
            </p>
            <div className="w-20 h-1 bg-[#4b9fb9] mx-auto rounded-full mt-4" />
          </div>

          {/* Search Box */}
          <div className="max-w-md mx-auto mb-10">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52788d] pointer-events-none" />
              <input
                type="text"
                aria-label="Search songs by title"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs by title..."
                className="w-full pl-10 pr-4 py-3 bg-white border border-[#d4e8ee] rounded-full text-xs sm:text-sm font-medium text-[#214b60] placeholder-[#52788d] focus:outline-none focus:ring-2 focus:ring-[#285c73] transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* Song Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-7">
            {filteredSongs.length > 0 ? (
              filteredSongs.map((song, idx) => {
                const videoId = extractYouTubeId(song.link || song.videoId);
                const isPlaying = playingVideoId === videoId;

                return (
                  <article 
                    key={idx} 
                    className="rounded-3xl overflow-hidden bg-white border border-[#d4e8ee] shadow-sm hover:shadow-md hover:-translate-y-1.5 transition-all duration-300 flex flex-col"
                  >
                    <div className="aspect-video bg-slate-900 relative overflow-hidden">
                      {videoId ? (
                        isPlaying ? (
                          <iframe
                            src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1`}
                            title={song.name}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            referrerPolicy="strict-origin-when-cross-origin"
                            allowFullScreen
                            className="w-full h-full border-0"
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setPlayingVideoId(videoId)}
                            className="w-full h-full relative group cursor-pointer overflow-hidden block text-left focus:outline-none focus:ring-2 focus:ring-[#4b9fb9]"
                            aria-label={`Play ${song.name}`}
                          >
                            <img
                              src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
                              alt={song.name}
                              loading="lazy"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                              onError={(e) => {
                                e.currentTarget.src = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
                              }}
                            />
                            <div className="absolute inset-0 bg-slate-950/30 group-hover:bg-slate-950/15 transition-colors flex items-center justify-center">
                              <div className="w-13 h-13 rounded-full bg-rose-600/90 text-white flex items-center justify-center shadow-lg group-hover:scale-110 group-hover:bg-rose-600 transition-all duration-200">
                                <Play className="w-6 h-6 fill-current ml-0.5" />
                              </div>
                            </div>
                          </button>
                        )
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[#52788d] text-xs">
                          Video preview unavailable
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex items-center justify-between gap-4 mt-auto">
                      <h3 className="font-bold text-sm text-[#214b60] leading-snug">
                        {song.name}
                      </h3>
                      {videoId && (
                        <a
                          href={`https://www.youtube.com/watch?v=${videoId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-rose-600 hover:text-rose-700 transition-colors shrink-0 p-1 hover:scale-110"
                          aria-label="Open on YouTube"
                        >
                          <YoutubeIcon className="w-5 h-5" />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="col-span-full py-12 text-center bg-[#e4f3f8]/50 rounded-3xl border border-dashed border-[#d4e8ee] p-8">
                <YoutubeIcon className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                <p className="font-bold text-[#214b60] text-sm">No matching worship songs found.</p>
                <p className="text-xs text-[#52788d] mt-1">Please try searching with another song title or clear your filters.</p>
              </div>
            )}
          </div>

        </div>
      </section>

      {/* Sticky Member History Pill Button */}
      <a 
        href="https://choir-attend.vercel.app/MemHistory.html" 
        target="_blank" 
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-[#285c73] text-white text-xs font-semibold rounded-full shadow-lg shadow-[#285c73]/30 hover:bg-[#214b60] hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group hover:scale-105"
      >
        <History className="w-4 h-4 group-hover:-rotate-45 transition-transform duration-300" />
        <span>Member History</span>
      </a>

    </div>
  );
}
