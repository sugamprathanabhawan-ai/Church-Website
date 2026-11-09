import React from 'react';
import { AlertTriangle, RotateCw, Home, ChevronDown, ChevronUp } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Uncaught application error:', error, errorInfo);
    this.setState({ errorInfo });

    // Handle stale Vite dynamic import chunk failures gracefully on build deployments
    if (error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('Importing a module script failed')) {
      const hasReloaded = sessionStorage.getItem('sugam_chunk_reload');
      if (!hasReloaded) {
        sessionStorage.setItem('sugam_chunk_reload', 'true');
        window.location.reload();
      }
    }
  }

  handleReload = () => {
    sessionStorage.removeItem('sugam_chunk_reload');
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  toggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }));
  };

  render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.message?.includes('Failed to fetch dynamically imported module');

      return (
        <div className="min-h-[80vh] flex items-center justify-center p-6 bg-[#f8faf7] font-sans">
          <div className="max-w-md w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl text-center animate-scale-in">
            <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto mb-5 shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#214b60] mb-1">
              समस्या देखा पर्यो
            </h2>
            <p className="text-sm font-semibold text-slate-500 mb-3">
              Something went wrong while rendering this page
            </p>

            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              {isChunkError
                ? 'A new version of the church website was published. Please refresh to load the latest update.'
                : 'हामी क्षमाप्रार्थी छौं। पृष्ठ पुनः लोड गर्नुहोस् वा मुख्य पृष्ठमा फर्कनुहोस्।'}
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5 justify-center mb-6">
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#285c73] hover:bg-[#214b60] text-white text-xs sm:text-sm font-semibold transition shadow-xs hover:scale-102 active:scale-98"
              >
                <RotateCw className="w-4 h-4" />
                <span>पुनः लोड गर्नुहोस् (Reload)</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold transition hover:scale-102 active:scale-98"
              >
                <Home className="w-4 h-4" />
                <span>गृहपृष्ठ (Home)</span>
              </button>
            </div>

            {/* Collapsible Technical Details */}
            {this.state.error && (
              <div className="border-t border-slate-100 pt-4 text-left">
                <button
                  type="button"
                  onClick={this.toggleDetails}
                  className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                >
                  <span>प्राविधिक विवरण (Technical Details)</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>

                {this.state.showDetails && (
                  <pre className="mt-2.5 p-3 rounded-xl bg-slate-900 text-amber-300 text-[10px] font-mono overflow-x-auto max-h-40 whitespace-pre-wrap leading-relaxed">
                    {this.state.error?.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
