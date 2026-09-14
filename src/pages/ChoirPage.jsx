import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { extractYouTubeId } from '../utils/dataSyncEngine';
import PDFViewer from '../components/PDFViewer';
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

export default function ChoirPage() {
  const { choirData, youtubeData, documents, loading, refreshData } = useData();
  const [resources, setResources] = useState(FALLBACK_RESOURCES);
  const [selectedResourceIndex, setSelectedResourceIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [playingVideoId, setPlayingVideoId] = useState(null);

  // Fetch resource manifest if available, or sync from live documents
  useEffect(() => {
    const dbChoirDocs = documents?.choir || [];
    if (dbChoirDocs.length > 0) {
      setResources(dbChoirDocs.map(d => ({
        id: d.id,
        name: d.title || d.name,
        file: d.fileUrl || d.file
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

  const activeResource = resources[selectedResourceIndex] || resources[0];
  const activeResourceUrl = activeResource
    ? (activeResource.file.startsWith('http') || activeResource.file.startsWith('/') || activeResource.file.startsWith('data:')
        ? activeResource.file
        : `/static/${encodeURIComponent(activeResource.file)}`)
    : '';

  return (
    <div className="flex flex-col min-h-screen">
      
      {/* 1. Hero Section */}
      <header className="relative w-full h-[70vh] sm:h-[80vh] flex items-center justify-center overflow-hidden pt-20">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-transform duration-[12s] ease-in-out hover:scale-105" 
          style={{ backgroundImage: "url('/images/choir2.webp')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-sky-950/80 via-sky-900/60 to-sky-950/90" />
        
        <div className="relative z-10 text-center px-6 max-w-4xl mx-auto flex flex-col items-center animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-sky-500/20 border border-sky-400/30 text-sky-300 text-xs font-semibold uppercase tracking-widest mb-4 backdrop-blur-md">
            <Music className="w-3.5 h-3.5" />
            Sugam Prathana Bhawan
          </span>

          <h1 className="font-serif text-4xl sm:text-6xl md:text-7xl font-bold text-white mb-4 leading-tight drop-shadow-lg">
            Church Choir Ministry
          </h1>

          <p className="text-base sm:text-2xl text-sky-100 font-light mb-8 drop-shadow max-w-2xl">
            Glorifying God through worship, choral praise, vocal training, and unity.
          </p>

          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/zensync"
              className="px-7 py-3 bg-sky-400 hover:bg-sky-300 text-slate-950 font-bold rounded-full shadow-lg shadow-sky-400/40 hover:-translate-y-0.5 transition-all text-sm hover:scale-105 flex items-center gap-2"
            >
              <Presentation className="w-4 h-4" />
              <span>Zen Sync Live</span>
            </Link>
            <a
              href="#choir-routine"
              className="px-7 py-3 bg-sky-500 hover:bg-sky-400 text-white font-semibold rounded-full shadow-lg shadow-sky-500/30 hover:-translate-y-0.5 transition-all text-sm hover:scale-105"
            >
              View Routine
            </a>
            <a 
              href="#resources" 
              className="px-7 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-full border border-white/20 hover:-translate-y-0.5 transition-all text-sm backdrop-blur-md hover:scale-105"
            >
              Choir Songbook
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
      <section id="choir-routine" className="py-16 sm:py-24 bg-white px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          
          <div className="text-center mb-12">
            <div className="flex justify-center mb-2">
              <button
                onClick={refreshData}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-sky-50 hover:bg-sky-100 text-sky-700 text-xs font-semibold border border-sky-200 shadow-2xs transition-colors hover:scale-105"
                title="Sync routine from Supabase"
              >
                <RotateCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Sync Live</span>
              </button>
            </div>
            <span className="text-sky-600 font-bold tracking-widest uppercase text-xs">Choir Fellowship</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-sky-950 mt-1">Notices &amp; Routine</h2>
            <div className="w-20 h-1 bg-sky-400 mx-auto rounded-full mt-4" />
          </div>

          {/* Notices */}
          {choirData.notices && choirData.notices.length > 0 && (
            <div className="mb-8 rounded-3xl border border-sky-100 bg-sky-50/70 p-5 sm:p-7 shadow-xs flex items-start gap-4 animate-fade-in-up">
              <div className="shrink-0 w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center shadow-xs">
                <Bell className="w-6 h-6" />
              </div>
              <div className="w-full">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-bold text-base sm:text-lg text-sky-950">Choir Notices</h3>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-200 text-sky-900 uppercase">
                    Important
                  </span>
                </div>
                <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                  {choirData.notices.map((notice, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-sky-500 font-bold">•</span>
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
                className="rounded-3xl overflow-hidden border border-sky-100 bg-white shadow-md shadow-sky-100/50 hover:shadow-xl transition-all duration-300 animate-fade-in-up"
                style={{ animationDelay: `${mIdx * 0.1}s` }}
              >
                <header className="bg-sky-700 text-white px-6 py-4 flex items-center gap-3">
                  <Calendar className="w-5 h-5 text-sky-300" />
                  <h3 className="font-serif text-lg sm:text-xl font-bold uppercase tracking-wide">
                    {month.name}
                  </h3>
                </header>

                <div className="divide-y divide-sky-100 p-2 sm:p-3">
                  {(month.dates || []).length > 0 ? (
                    month.dates.map((day, dIdx) => (
                      <div key={dIdx} className="p-4 rounded-2xl hover:bg-sky-50/40 transition-colors">
                        <span className="inline-block text-[11px] font-bold uppercase tracking-wider bg-sky-100 text-sky-800 px-2.5 py-0.5 rounded-full mb-3">
                          Date: {day.date}
                        </span>

                        {(day.items || []).length > 0 ? (
                          <div className="space-y-2">
                            {day.items.map((item, iIdx) => (
                              <div key={iIdx} className="grid grid-cols-[auto_1fr] gap-x-3 text-xs sm:text-sm">
                                <time className="font-semibold text-sky-900 whitespace-nowrap bg-slate-100 px-2 py-0.5 rounded-md h-fit">
                                  {item.time || 'Time TBA'}
                                </time>
                                <p className="text-slate-700 font-medium leading-relaxed">
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
            <section className="rounded-3xl border border-sky-100 bg-sky-50/60 p-6 sm:p-8 shadow-xs animate-fade-in-up">
              <div className="text-center mb-8">
                <span className="text-xs font-bold tracking-widest uppercase text-sky-600">Structure</span>
                <h3 className="font-serif text-2xl sm:text-3xl font-bold text-sky-950 mt-1">Monthly Practice Layout</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {choirData.layoutGroups.map((group, gIdx) => (
                  <article key={gIdx} className="rounded-2xl overflow-hidden bg-white border border-sky-100 shadow-2xs glass-card-hover">
                    <header className="bg-sky-100 px-5 py-3.5 border-b border-sky-200">
                      <h4 className="font-bold text-sm sm:text-base text-sky-950">{group.title}</h4>
                    </header>

                    <div className="divide-y divide-sky-100 p-2">
                      {(group.days || []).map((day, dayIdx) => (
                        <div key={dayIdx} className="p-4">
                          <h5 className="font-bold text-xs sm:text-sm text-sky-800 mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-sky-500"></span>
                            <span>{day.title || `${day.saturday} Saturday`}</span>
                          </h5>
                          <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700 pl-3">
                            {(day.activities || []).map((activity, actIdx) => (
                              <li key={actIdx} className="flex gap-2">
                                <span className="text-sky-400">•</span>
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
      <section id="resources" className="py-20 bg-slate-50/70 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-12">
            <span className="text-sky-600 font-bold tracking-widest uppercase text-xs">Songsheets &amp; Transpose</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-sky-950 mt-1">Choir Resources</h2>
            <div className="w-20 h-1 bg-sky-400 mx-auto rounded-full mt-4" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Available Files List */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="bg-white rounded-3xl p-6 shadow-sm border border-sky-100">
                <div className="flex justify-between items-center mb-4 px-1">
                  <h3 className="text-lg font-bold text-sky-950 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-500" />
                    <span>Available Files</span>
                  </h3>
                  <span className="text-xs font-bold bg-sky-100 text-sky-700 px-2.5 py-0.5 rounded-full">
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
                            ? 'bg-sky-600 text-white border-sky-600 shadow-sm' 
                            : 'bg-white text-sky-900 border-sky-100 hover:border-sky-300 hover:bg-sky-50'
                        }`}
                      >
                        <span className="font-semibold text-xs sm:text-sm capitalize truncate pr-2">
                          {res.name}
                        </span>
                        <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
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
                  fileName={activeResource.file}
                  title={activeResource.name}
                />
              )}
            </div>

          </div>

        </div>
      </section>

      {/* 4. Worship Songs to Listen (YouTube Grid) */}
      <section id="youtube-songs" className="py-24 bg-white px-4 sm:px-6">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center mb-8">
            <span className="text-sky-600 font-semibold tracking-widest uppercase text-xs">Worship Together</span>
            <h2 className="text-3xl sm:text-5xl font-serif font-bold text-sky-950 mt-1 mb-3">Songs to Listen</h2>
            <p className="text-slate-600 max-w-xl mx-auto text-xs sm:text-sm">
              Listen to and practise choir songs and worship melodies directly from this portal.
            </p>
            <div className="w-20 h-1 bg-sky-400 mx-auto rounded-full mt-4" />
          </div>

          {/* Search Box */}
          <div className="max-w-md mx-auto mb-10">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
              <input
                type="text"
                aria-label="Search songs by title"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search songs by title..."
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-sky-100 rounded-full text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all shadow-2xs"
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
                    className="rounded-3xl overflow-hidden bg-white border border-sky-100 shadow-md shadow-sky-100/60 hover:-translate-y-1.5 transition-all duration-300 flex flex-col glass-card-hover"
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
                            className="w-full h-full relative group cursor-pointer overflow-hidden block text-left focus:outline-none focus:ring-2 focus:ring-sky-400"
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
                        <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs">
                          Video preview unavailable
                        </div>
                      )}
                    </div>

                    <div className="p-4 flex items-center justify-between gap-4 mt-auto">
                      <h3 className="font-bold text-sm text-sky-950 leading-snug">
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
              <div className="col-span-full py-12 text-center bg-sky-50/50 rounded-3xl border border-dashed border-sky-200 p-8">
                <YoutubeIcon className="w-10 h-10 text-rose-400 mx-auto mb-2" />
                <p className="font-bold text-sky-950 text-sm">No matching worship songs found.</p>
                <p className="text-xs text-slate-500 mt-1">You can add songs via the Admin Portal.</p>
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
        className="fixed bottom-6 left-6 z-40 flex items-center gap-2 px-4 py-2.5 bg-sky-600 text-white text-xs font-semibold rounded-full shadow-lg shadow-sky-600/30 hover:bg-sky-500 hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 group hover:scale-105"
      >
        <History className="w-4 h-4 group-hover:-rotate-45 transition-transform duration-300" />
        <span>Member History</span>
      </a>

    </div>
  );
}

