import React, { useState, useRef } from 'react';
import { Download, Maximize, ExternalLink, FileText, Loader2, AlertCircle } from 'lucide-react';

export default function PDFViewer({ fileUrl, fileName, title }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const containerRef = useRef(null);

  const isPdf = fileUrl.toLowerCase().endsWith('.pdf');

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (containerRef.current.requestFullscreen) {
        containerRef.current.requestFullscreen();
      } else if (containerRef.current.webkitRequestFullscreen) {
        containerRef.current.webkitRequestFullscreen();
      }
    }
  };

  return (
    <div className="flex flex-col w-full space-y-3">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-sky-100 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-5 h-5 text-sky-500 shrink-0" />
          <span className="font-semibold text-sm text-slate-800 truncate">
            {title || fileName}
          </span>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <a
            href={fileUrl}
            download={fileName || 'document.pdf'}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download</span>
          </a>
          <button
            type="button"
            onClick={handleFullscreen}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
            title="Full Screen"
          >
            <Maximize className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Full Screen</span>
          </button>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Open Tab</span>
          </a>
        </div>
      </div>

      {/* Main Viewer Area */}
      <div 
        ref={containerRef}
        className="relative w-full min-h-[500px] md:min-h-[650px] bg-slate-100 rounded-3xl border border-sky-100 overflow-hidden shadow-lg flex items-center justify-center"
      >
        {loading && (
          <div className="absolute inset-0 bg-white/90 backdrop-blur-xs z-10 flex flex-col items-center justify-center p-6 text-center">
            <Loader2 className="w-8 h-8 text-sky-500 animate-spin mb-3" />
            <p className="text-sm font-semibold text-sky-950">Loading document...</p>
            <p className="text-xs text-slate-500 mt-1">Please wait a moment.</p>
          </div>
        )}

        {error ? (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-white w-full h-full">
            <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
            <h4 className="text-base font-bold text-slate-800">Preview not available in this browser</h4>
            <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4">
              Some mobile browsers do not support direct PDF iframe embedding. You can download or view it in a new tab.
            </p>
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-semibold transition"
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
      </div>
    </div>
  );
}
