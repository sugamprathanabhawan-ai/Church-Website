import React, { useState, useRef, useEffect } from 'react';
import { Download, Maximize, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';

export default function PDFViewer({ fileUrl, fileName, title }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, [fileUrl]);

  const isPdf = (() => {
    if (!fileUrl) return false;
    try {
      const urlObj = new URL(fileUrl, typeof window !== 'undefined' ? window.location.origin : 'https://localhost');
      const pathname = urlObj.pathname.toLowerCase();
      if (pathname.endsWith('.pdf')) return true;
    } catch {}
    const cleanUrl = String(fileUrl).split('?')[0].split('#')[0].toLowerCase();
    return cleanUrl.endsWith('.pdf') || String(fileName || '').toLowerCase().endsWith('.pdf');
  })();

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      }
    }
  };

  const isMobile = typeof window !== 'undefined' && (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    window.innerWidth <= 768
  );

  return (
    <div className="flex flex-col w-full space-y-3 font-sans">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-[#d4e8ee] shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-5 h-5 text-[#285c73] shrink-0" />
          <span className="font-semibold text-sm text-[#214b60] truncate">
            {title || fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <a
            href={fileUrl}
            download={fileName || 'document.pdf'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs font-semibold transition-all shadow-xs hover:shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
          {!isMobile && (
            <button
              type="button"
              onClick={handleFullscreen}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#214b60] hover:bg-[#183949] text-white rounded-xl text-xs font-semibold transition-all shadow-xs"
              title="Full Screen"
            >
              <Maximize className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Full Screen</span>
            </button>
          )}
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 bg-[#e4f3f8] hover:bg-[#dceef5] text-[#214b60] rounded-xl text-xs font-semibold transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Tab</span>
          </a>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div 
        ref={containerRef}
        className="relative w-full min-h-[360px] md:min-h-[650px] bg-[#f8faf7] rounded-3xl border border-[#d4e8ee] overflow-hidden shadow-lg flex items-center justify-center"
      >
        {isMobile && isPdf ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-white w-full h-full my-auto space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#e4f3f8] text-[#285c73] flex items-center justify-center shadow-xs">
              <FileText className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-base sm:text-lg font-bold text-[#214b60]">
                {title || fileName}
              </h4>
              <p className="text-xs text-[#52788d] max-w-sm mt-1.5 leading-relaxed">
                Mobile browsers open PDF documents in a dedicated reader tab for maximum legibility and zoom control.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs font-bold transition shadow-sm"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Document</span>
              </a>
              <a
                href={fileUrl}
                download={fileName || 'document.pdf'}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#e4f3f8] hover:bg-[#dceef5] text-[#214b60] rounded-xl text-xs font-bold transition border border-[#d4e8ee]"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </a>
            </div>
          </div>
        ) : (
          <>
            {loading && (
              <div className="absolute inset-0 bg-white/90 backdrop-blur-xs z-10 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-8 h-8 text-[#285c73] animate-spin mb-3" />
                <p className="text-sm font-semibold text-[#214b60]">Loading document...</p>
                <p className="text-xs text-[#52788d] mt-1">Please wait a moment.</p>
              </div>
            )}

            {error ? (
              <div className="flex flex-col items-center justify-center p-8 text-center bg-white w-full h-full">
                <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
                <h4 className="text-base font-bold text-[#214b60]">Preview not available in this browser</h4>
                <p className="text-xs text-[#52788d] max-w-sm mt-1 mb-4">
                  Please view the document directly in a new tab or download for offline viewing.
                </p>
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-5 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white rounded-xl text-xs font-semibold transition shadow-xs"
                >
                  Open Document
                </a>
              </div>
            ) : isPdf ? (
              <iframe
                src={`${fileUrl}#toolbar=1&navpanes=0&scrollbar=1`}
                title={title || fileName}
                className="w-full h-full border-0 absolute inset-0 bg-white"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            ) : (
              <img 
                src={fileUrl} 
                alt={title || fileName} 
                className="w-full h-full object-contain p-4"
                onLoad={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError(true);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
