import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  Printer, 
  RotateCw, 
  Calendar, 
  Bell, 
  Users, 
  UserCheck, 
  Sparkles,
  LayoutGrid,
  Table as TableIcon,
  Share2,
  Check
} from 'lucide-react';

const USER_IMAGES = {
  // Youth Leader & Captains
  "aryan rai": "/images/you3.png",
  "aryanrai": "/images/you3.png",
  "aryan": "/images/you3.png",

  "sara poudel": "/images/you1.jpg",
  "sarapoudel": "/images/you1.jpg",
  "sara": "/images/you1.jpg",
  "patrus": "/images/you1.jpg",
  "mams": "/images/you1.jpg",
  "mamatarai": "/images/you1.jpg",
  "mamta rai": "/images/you1.jpg",

  "suraj pokhrel": "/images/you2.jpg",
  "surajpokhrel": "/images/you2.jpg",
  "suraj": "/images/you2.jpg",
  "yakub": "/images/you2.jpg",
  "naren rai": "/images/you2.jpg",
  "narenrai": "/images/you2.jpg",

  "urmila chaudhary": "/images/you4.jpg",
  "urmilachaudhary": "/images/you4.jpg",
  "urmila": "/images/you4.jpg",
  "yahunna": "/images/you4.jpg",

  // Church Elders & Pastoral Staff
  "kiran thapa": "/images/ag1.webp",
  "deepak thapa": "/images/ag2.webp",
  "naresh rai": "/images/ag3.webp",
  "khadka chaudhary": "/images/ag4.webp",
  "bilas pokhrel": "/images/ag5.webp",
  "man bahadur shrestha": "/images/ag7.webp",
  "stephen tamang": "/images/ag8.webp"
};

function getMemberAvatar(name, index) {
  if (!name) return null;
  const rawClean = name.trim().toLowerCase();
  // Strip parenthetical designations like (Patrus), (Yakub), (Yahunna)
  const noParens = rawClean.replace(/\(.*?\)/g, '').trim();
  const noSpace = noParens.replace(/\s+/g, '');
  const rawNoSpace = rawClean.replace(/\s+/g, '');

  if (USER_IMAGES[noParens]) return USER_IMAGES[noParens];
  if (USER_IMAGES[noSpace]) return USER_IMAGES[noSpace];
  if (USER_IMAGES[rawClean]) return USER_IMAGES[rawClean];
  if (USER_IMAGES[rawNoSpace]) return USER_IMAGES[rawNoSpace];

  // Check substring keywords
  if (noParens.includes('sara') || rawClean.includes('patrus')) return '/images/you1.jpg';
  if (noParens.includes('suraj') || rawClean.includes('yakub')) return '/images/you2.jpg';
  if (noParens.includes('aryan')) return '/images/you3.png';
  if (noParens.includes('urmila') || rawClean.includes('yahunna')) return '/images/you4.jpg';

  // Fallback by captain index if available
  if (typeof index === 'number') {
    const captainDefaults = ['/images/you1.jpg', '/images/you2.jpg', '/images/you4.jpg'];
    return captainDefaults[index % captainDefaults.length];
  }

  return null;
}

export default function YouthRoutinePage() {
  const { youthData, loading, refreshData } = useData();
  const [viewMode, setViewMode] = useState('auto'); // 'auto', 'table', 'cards'
  const [copied, setCopied] = useState(false);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center px-4 pb-16 w-full pt-28 sm:pt-32">
      
      {/* Top Action Toolbar */}
      <div className="no-print max-w-4xl mx-auto w-full px-2 mb-6 flex flex-wrap justify-between items-center gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-sky-50 text-sky-700 text-xs font-semibold border border-sky-200/80 shadow-2xs transition-colors hover:scale-105 active:scale-95"
            title="Sync routine from Supabase"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync Live</span>
          </button>

          {/* View mode toggle for mobile */}
          <div className="sm:hidden flex bg-white border border-sky-200/80 rounded-xl p-0.5">
            <button
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'cards' ? 'bg-sky-500 text-white shadow-2xs' : 'text-slate-600'
              }`}
              title="Cards View"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-medium transition ${
                viewMode === 'table' ? 'bg-sky-500 text-white shadow-2xs' : 'text-slate-600'
              }`}
              title="Table View"
            >
              <TableIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-sky-50 text-slate-700 text-xs font-semibold rounded-xl border border-sky-200/80 shadow-2xs transition hover:scale-105"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-sky-600" />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95 focus:ring-2 focus:ring-sky-400 focus:outline-none"
          >
            <Printer className="w-4 h-4" />
            <span>Print Routine</span>
          </button>
        </div>
      </div>

      {/* Header Title Section */}
      <header className="text-center mb-8 no-print animate-fade-in">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-sky-800 text-xs font-bold uppercase tracking-wider mb-3">
          <Users className="w-3.5 h-3.5 text-sky-600" />
          Youth Fellowship
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 mb-2">
          Youth Routine &amp; Schedule
        </h1>
        <p className="text-sm sm:text-base text-sky-700 font-medium">Sugam Prathana Bhawan</p>
        <p className="text-xs sm:text-sm text-slate-500 mt-2 font-medium flex items-center justify-center gap-1.5">
          <Calendar className="w-3.5 h-3.5 text-sky-500" />
          <span>Today is {today}</span>
        </p>
      </header>

      {/* Main Printable Container */}
      <div id="print-area" className="print-area w-full max-w-4xl space-y-6">
        
        {/* Print Only Header */}
        <div className="hidden print:block text-center font-serif mb-6">
          <h1 className="text-3xl font-bold text-black mb-1">Youth Fellowship Routine</h1>
          <h2 className="text-xl text-gray-700">Sugam Prathana Bhawan</h2>
        </div>

        {/* Notices Section */}
        {youthData.notices && youthData.notices.length > 0 && (
          <div className="bg-white rounded-3xl p-5 sm:p-6 border border-sky-100 shadow-md shadow-sky-100/50 flex items-start space-x-4 animate-fade-in-up">
            <div className="w-11 h-11 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 shadow-2xs border border-sky-100">
              <Bell className="w-6 h-6" />
            </div>
            <div className="w-full">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-base font-bold text-slate-900">
                  Notice / सूचना
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-100 text-sky-800 uppercase tracking-wide">
                  Important
                </span>
              </div>
              <ul className="space-y-1.5 text-xs sm:text-sm text-slate-700">
                {youthData.notices.map((item, idx) => (
                  <li key={idx} className="flex items-start">
                    <span className="text-sky-500 mr-2 font-bold">•</span>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Monthly Schedules */}
        <div className="space-y-8">
          {(youthData.months || []).map((month, mIdx) => (
            <div key={mIdx} className="month-card animate-fade-in-up" style={{ animationDelay: `${mIdx * 0.1}s` }}>
              <div className="bg-sky-600 rounded-t-3xl p-4 text-center shadow-xs">
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide uppercase font-serif">
                  {month.title}
                </h2>
              </div>

              <div className="bg-white shadow-xl shadow-sky-100/80 rounded-b-3xl border border-sky-100 overflow-hidden">
                {/* Desktop & Default Table View */}
                <div className={`w-full overflow-x-auto ${viewMode === 'cards' ? 'hidden' : 'block'}`}>
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-sky-100/70 text-sky-950 border-b border-sky-200/80">
                      <tr>
                        <th scope="col" className="px-4 sm:px-6 py-3.5 font-bold text-xs uppercase tracking-wider w-1/4 sm:w-1/4">
                          S.N. / Date
                        </th>
                        <th scope="col" className="px-4 sm:px-6 py-3.5 font-bold text-xs uppercase tracking-wider w-3/4 sm:w-3/4">
                          Fellowship Activity / Program
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-sky-50 text-slate-700">
                      {(month.rows || []).map((row, rIdx) => (
                        <tr key={rIdx} className="odd:bg-white even:bg-sky-50/30 hover:bg-sky-100/40 transition-colors">
                          <td className="px-4 sm:px-6 py-3.5 text-xs sm:text-sm font-bold text-sky-900 border-b border-sky-100/60 align-top">
                            {row.date}
                          </td>
                          <td className="px-4 sm:px-6 py-3.5 text-xs sm:text-sm font-medium text-slate-800 border-b border-sky-100/60 leading-relaxed">
                            {row.activity}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View Alternative */}
                {viewMode === 'cards' && (
                  <div className="p-4 space-y-2.5 sm:hidden">
                    {(month.rows || []).map((row, rIdx) => (
                      <div key={rIdx} className="p-3.5 rounded-2xl bg-sky-50/50 border border-sky-100 flex flex-col gap-1">
                        <span className="text-xs font-bold text-sky-700 bg-sky-100/80 px-2.5 py-0.5 rounded-full w-fit">
                          Date: {row.date}
                        </span>
                        <p className="text-xs font-medium text-slate-800 mt-1 leading-relaxed">
                          {row.activity}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Youth Group Teams Breakdown */}
        {youthData.group && (youthData.group.leader || (youthData.group.teams && youthData.group.teams.length > 0)) && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-sky-100 shadow-md shadow-sky-100/50 animate-fade-in-up mt-8">
            <h2 className="text-2xl font-serif font-bold text-sky-950 mb-6 text-center border-b border-sky-100 pb-4">
              Youth Fellowship Teams
            </h2>
            
            {youthData.group.leader && (
              <div className="flex items-center justify-center mb-8">
                <div className="bg-sky-50/80 px-6 py-3 rounded-full border border-sky-200 shadow-2xs flex items-center gap-3">
                  <img 
                    src={getMemberAvatar(youthData.group.leader) || '/images/you3.png'} 
                    alt={youthData.group.leader} 
                    className="w-7 h-7 rounded-full object-cover border border-sky-300 shadow-2xs shrink-0"
                    onError={(e) => { e.currentTarget.src = '/images/you3.png'; }}
                  />
                  <span className="text-xs sm:text-sm font-semibold text-slate-600 uppercase tracking-wide">
                    Fellowship Leader: <span className="text-sky-700 font-bold ml-1">{youthData.group.leader}</span>
                  </span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {(youthData.group.teams || []).map((team, tIdx) => {
                const defaultCaptainAvatars = ['/images/you1.jpg', '/images/you2.jpg', '/images/you4.jpg'];
                const captainAvatar = getMemberAvatar(team.captain, tIdx) || defaultCaptainAvatars[tIdx % defaultCaptainAvatars.length];
                return (
                  <div key={tIdx} className="bg-sky-50/60 rounded-2xl p-5 border border-sky-100 shadow-2xs hover:shadow-md transition-all h-full glass-card-hover">
                    <h3 className="font-bold text-sm sm:text-base text-sky-950 flex items-center gap-2.5 mb-3 border-b border-sky-200/60 pb-2.5">
                      <img 
                        src={captainAvatar} 
                        alt={team.captain} 
                        className="w-6 h-6 rounded-full object-cover border border-sky-300 shadow-2xs shrink-0"
                        onError={(e) => { e.currentTarget.src = defaultCaptainAvatars[tIdx % defaultCaptainAvatars.length]; }}
                      />
                      <span>Captain: <span className="text-sky-700 font-bold">{team.captain}</span></span>
                    </h3>
                    <div>
                      <p className="text-xs font-bold text-slate-600 mb-1.5 uppercase tracking-wider">Members:</p>
                      <ul className="space-y-1 text-xs text-slate-700">
                        {(team.members || []).map((member, mIdx) => (
                          <li key={mIdx} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                            <span>{member}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Leadership Profile Highlights */}
      <section className="max-w-4xl mx-auto w-full mt-12 no-print">
        <div className="text-center mb-8">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-sky-800 text-[11px] font-bold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-sky-600" />
            Fellowship Guidance
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900">
            Youth Fellowship Leadership
          </h2>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
          
          {/* Overall Youth Leader */}
          {youthData.group?.leader && (
            <div className="hover-lift bg-gradient-to-b from-white to-sky-50/50 p-5 rounded-3xl border border-sky-100 shadow-sm flex flex-col items-center">
              <div className="relative w-[95px] h-[95px] flex justify-center items-center mb-3">
                <div className="loader-red absolute inset-0"></div>
                <img 
                  src={getMemberAvatar(youthData.group.leader) || '/images/you3.png'} 
                  alt={youthData.group.leader} 
                  className="w-[78px] h-[78px] rounded-full object-cover relative z-10 border-2 border-white shadow-md"
                  onError={(e) => { e.currentTarget.src = '/images/you3.png'; }}
                />
              </div>
              <span className="bg-rose-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-1 shadow-xs">
                Leader
              </span>
              <h3 className="text-slate-900 font-bold text-sm text-center">{youthData.group.leader}</h3>
              <p className="text-slate-500 text-xs font-medium mt-0.5">Youth Leader</p>
            </div>
          )}

          {/* Dynamic Team Captains */}
          {(youthData.group?.teams || []).map((team, idx) => {
            const defaultCaptainAvatars = ['/images/you1.jpg', '/images/you2.jpg', '/images/you4.jpg'];
            const fallbackAvatar = defaultCaptainAvatars[idx % defaultCaptainAvatars.length];
            const avatar = getMemberAvatar(team.captain, idx) || fallbackAvatar;
            const cleanName = team.captain.replace(/\(.*?\)/, '').trim();
            const groupTag = team.captain.match(/\((.*?)\)/)?.[0] || '';

            return (
              <div key={idx} className="hover-lift bg-gradient-to-b from-white to-sky-50/50 p-5 rounded-3xl border border-sky-100 shadow-sm flex flex-col items-center">
                <div className="relative w-[95px] h-[95px] flex justify-center items-center mb-3">
                  <div className="loader-skyblue absolute inset-0"></div>
                  <img 
                    src={avatar} 
                    alt={cleanName || team.captain} 
                    className="w-[78px] h-[78px] rounded-full object-cover relative z-10 border-2 border-white shadow-md"
                    onError={(e) => { e.currentTarget.src = fallbackAvatar; }}
                  />
                </div>
                <span className="bg-sky-500 text-white text-[10px] font-bold px-3 py-0.5 rounded-full uppercase tracking-wider mb-1 shadow-xs">
                  Captain
                </span>
                <h3 className="text-slate-900 font-bold text-sm text-center">{cleanName || team.captain}</h3>
                {groupTag && <p className="text-sky-600 text-xs font-medium mt-0.5">{groupTag}</p>}
              </div>
            );
          })}

        </div>
      </section>

    </div>
  );
}
