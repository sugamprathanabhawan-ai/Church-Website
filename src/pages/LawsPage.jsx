import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import PDFViewer from '../components/PDFViewer';
import { Scale, FileText, Search } from 'lucide-react';

const FALLBACK_LAWS = [
  { name: "Sugam Choir Laws", file: "SUGAM CHOIR LAWS.pdf" },
  { name: "Youth Fellowship Laws", file: "Youth laws.pdf" },
  { name: "Aradhana Laws & Guidelines", file: "Aradhana Laws.pdf" },
  { name: "Sugam Media Laws", file: "Sugam Media Law.pdf" },
  { name: "Carol Celebration Rules", file: "CAROL RULE.pdf" },
  { name: "Baptism Process & Doctrine", file: "baptismprocess.pdf" },
  { name: "Choir User Guide", file: "Sugam_Choir_User_Guide.pdf" },
];

export default function LawsPage() {
  const { documents } = useData();
  const [laws, setLaws] = useState(FALLBACK_LAWS);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const dbLaws = documents?.laws || [];
    if (dbLaws.length > 0) {
      setLaws(dbLaws.map(d => ({
        id: d.id,
        name: d.title || d.name,
        file: d.fileUrl || d.file
      })));
      return;
    }

    fetch('/law/pdf-manifest.json')
      .then(res => res.json())
      .then(manifest => {
        const files = Array.isArray(manifest) ? manifest : manifest.files || [];
        if (files.length > 0) {
          const parsed = files.map(f => ({
            name: typeof f === 'string' ? f.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') : 'Church Law',
            file: f
          }));
          setLaws(parsed);
        }
      })
      .catch(() => {
        // use fallback
      });
  }, [documents?.laws]);

  const filteredLaws = laws.filter(l => 
    l.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const activeLaw = laws[selectedIndex] || laws[0];
  const activeLawUrl = activeLaw
    ? (activeLaw.file.startsWith('http') || activeLaw.file.startsWith('/') || activeLaw.file.startsWith('data:')
        ? activeLaw.file
        : `/law/${encodeURIComponent(activeLaw.file)}`)
    : '';

  return (
    <div className="flex-grow flex flex-col items-center px-4 pb-16 w-full pt-28 sm:pt-32 max-w-7xl mx-auto">
      
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 animate-fade-in">
        <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-sky-100/80 border border-sky-200 text-sky-800 text-xs font-bold uppercase tracking-wider mb-3">
          <Scale className="w-3.5 h-3.5 text-sky-600" />
          Church Governance &amp; Ministry
        </span>
        <h1 className="text-3xl sm:text-5xl font-serif font-bold text-slate-900 mb-2">
          Church Laws &amp; Guidelines
        </h1>
        <p className="text-xs sm:text-sm text-slate-600">
          Official ministry policies, choir regulations, baptism procedures, and leadership constitution for Sugam Prathana Bhawan.
        </p>
      </div>

      {/* Main Content Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        
        {/* Left Column: Documents List */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-4 border border-sky-100 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <span>Available Documents</span>
              </h2>
              <span className="text-xs font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">
                {laws.length}
              </span>
            </div>

            {/* Search filter */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                aria-label="Filter documents"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter documents..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-sky-100 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-sky-400 focus:bg-white transition-all"
              />
            </div>

            {/* List */}
            <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
              {filteredLaws.map((law, idx) => {
                const originalIndex = laws.findIndex(l => l.file === law.file);
                const isSelected = selectedIndex === originalIndex;

                return (
                  <button
                    key={idx}
                    onClick={() => setSelectedIndex(originalIndex)}
                    className={`w-full text-left px-4 py-3 rounded-2xl transition-all duration-200 border flex items-center justify-between group ${
                      isSelected 
                        ? 'bg-sky-600 text-white border-sky-600 shadow-xs' 
                        : 'bg-white text-slate-800 border-sky-100 hover:border-sky-300 hover:bg-sky-50'
                    }`}
                  >
                    <span className="font-semibold text-xs sm:text-sm capitalize truncate pr-2">
                      {law.name}
                    </span>
                    <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-sky-400'}`} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: PDF Viewer */}
        <div className="lg:col-span-8 w-full">
          {activeLaw && (
            <PDFViewer
              fileUrl={activeLawUrl}
              fileName={activeLaw.file}
              title={activeLaw.name}
            />
          )}
        </div>

      </div>

    </div>
  );
}
