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

function resolveDocumentUrl(doc, defaultFolder = '/law/') {
  if (!doc) return '';
  const file = doc.fileUrl || doc.file_url || doc.file;
  if (!file || typeof file !== 'string') return '';
  if (file.startsWith('http://') || file.startsWith('https://') || file.startsWith('/') || file.startsWith('data:')) {
    return file;
  }
  return `${defaultFolder}${encodeURIComponent(file)}`;
}

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
        name: d.title || d.name || 'Church Law',
        file: d.fileUrl || d.file_url || d.file || ''
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

  const filteredLaws = laws.filter(l => {
    const title = (l.name || l.title || '').toLowerCase();
    return title.includes(searchQuery.toLowerCase().trim());
  });

  const safeIndex = (laws.length > 0 && selectedIndex >= 0 && selectedIndex < laws.length)
    ? selectedIndex
    : 0;
  const activeLaw = laws[safeIndex] || laws[0];
  const activeLawUrl = resolveDocumentUrl(activeLaw, '/law/');

  return (
    <div className="min-h-screen bg-[#f8faf7] flex flex-col items-center px-4 pb-20 w-full pt-28 sm:pt-36">
      <div className="max-w-7xl w-full mx-auto">
        
        {/* Header */}
        <div className="text-center max-w-3xl mx-auto mb-10 animate-fade-in">
          <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-[#dceef5] border border-[#d4e8ee] text-[#214b60] text-xs font-bold uppercase tracking-wider mb-4 shadow-2xs">
            <Scale className="w-3.5 h-3.5 text-[#285c73]" />
            Church Governance &amp; Ministry
          </span>
          <h1 className="text-3xl sm:text-5xl font-serif font-bold text-[#214b60] mb-3 tracking-tight">
            Church Laws &amp; Guidelines
          </h1>
          <p className="text-sm sm:text-base text-[#395e70] font-normal leading-relaxed">
            Official ministry policies, choir regulations, baptism procedures, and leadership constitution for Sugam Prathana Bhawan.
          </p>
          <div className="w-16 h-1 bg-[#4b9fb9] mx-auto rounded-full mt-4" />
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
          
          {/* Left Column: Documents List */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white rounded-3xl p-5 sm:p-6 space-y-4 border border-[#d4e8ee] shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base text-[#214b60] flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#285c73]" />
                  <span>Available Documents</span>
                </h2>
                <span className="text-xs font-bold bg-[#dceef5] text-[#214b60] px-2.5 py-0.5 rounded-full">
                  {laws.length}
                </span>
              </div>

              {/* Search filter */}
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#52788d]" />
                <input
                  type="text"
                  aria-label="Filter documents"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter documents..."
                  className="w-full pl-9 pr-3 py-2.5 bg-[#f8faf7] border border-[#d4e8ee] rounded-xl text-xs sm:text-sm text-[#214b60] placeholder-[#52788d] focus:outline-none focus:ring-2 focus:ring-[#285c73] focus:bg-white transition-all"
                />
              </div>

              {/* List */}
              <div className="space-y-2 max-h-[52vh] overflow-y-auto pr-1">
                {filteredLaws.length === 0 ? (
                  <div className="py-8 text-center text-xs text-[#52788d]">
                    No documents found matching &ldquo;{searchQuery}&rdquo;
                  </div>
                ) : (
                  filteredLaws.map((law, idx) => {
                    const originalIndex = laws.findIndex(l => l.file === law.file);
                    const isSelected = selectedIndex === (originalIndex !== -1 ? originalIndex : idx);

                    return (
                      <button
                        key={law.file || idx}
                        onClick={() => {
                          const targetIndex = originalIndex !== -1 ? originalIndex : laws.indexOf(law);
                          setSelectedIndex(targetIndex !== -1 ? targetIndex : idx);
                        }}
                        className={`w-full text-left px-4 py-3 rounded-2xl transition-all duration-200 border flex items-center justify-between group ${
                          isSelected 
                            ? 'bg-[#285c73] text-white border-[#285c73] shadow-xs' 
                            : 'bg-white text-[#214b60] border-[#d4e8ee] hover:border-[#4b9fb9] hover:bg-[#e4f3f8]/50'
                        }`}
                      >
                        <span className="font-semibold text-xs sm:text-sm capitalize truncate pr-2">
                          {law.name}
                        </span>
                        <FileText className={`w-4 h-4 shrink-0 ${isSelected ? 'text-white' : 'text-[#4b9fb9]'}`} />
                      </button>
                    );
                  })
                )}
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
    </div>
  );
}
