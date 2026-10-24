import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { DataProvider } from './context/DataContext';
import ProtectedRoute from './components/ProtectedRoute';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import ErrorBoundary from './components/ErrorBoundary';
import { Loader2, WifiOff, Wifi, Compass, ArrowRight } from 'lucide-react';

const HomePage = lazy(() => import('./pages/HomePage'));
const YouthRoutinePage = lazy(() => import('./pages/YouthRoutinePage'));
const ChoirPage = lazy(() => import('./pages/ChoirPage'));
const CalendarPage = lazy(() => import('./pages/CalendarPage'));
const BibleQuizPage = lazy(() => import('./pages/BibleQuizPage'));
const LawsPage = lazy(() => import('./pages/LawsPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const ZenSyncPage = lazy(() => import('./pages/ZenSyncPage'));

// Clean loading placeholder for code-split chunks
function PageLoader() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
      <Loader2 className="w-9 h-9 text-[#285c73] animate-spin mb-3" />
      <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading page...</p>
    </div>
  );
}

// Global Online / Offline Resilience Banner
function OfflineBanner() {
  const [isOnline, setIsOnline] = React.useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = React.useState(false);

  React.useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      const timer = setTimeout(() => setShowReconnected(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOnline) {
    return (
      <div className="bg-amber-600 text-white text-xs px-4 py-2 text-center font-medium flex items-center justify-center gap-2 shadow-md sticky top-0 z-50 animate-fade-in">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>इन्टरनेट सम्पर्क टुटेको छ (Offline Mode) • Live updates paused. Retrying connection...</span>
      </div>
    );
  }

  if (showReconnected) {
    return (
      <div className="bg-emerald-600 text-white text-xs px-4 py-2 text-center font-medium flex items-center justify-center gap-2 shadow-md sticky top-0 z-50 animate-fade-in">
        <Wifi className="w-4 h-4 shrink-0" />
        <span>पुनः जडान भयो (Back Online) • Sync connection restored.</span>
      </div>
    );
  }

  return null;
}

// 404 Not Found Component with Church Navigation Chips
function NotFoundPage() {
  return (
    <div className="min-h-[75vh] flex flex-col items-center justify-center text-center px-4 pt-32 pb-20 bg-[#f8faf7]">
      <div className="w-16 h-16 rounded-3xl bg-[#dceef5] text-[#214b60] flex items-center justify-center text-2xl font-bold mb-4 shadow-xs border border-[#d4e8ee]">
        404
      </div>
      <h1 className="text-2xl sm:text-4xl font-serif font-bold text-[#214b60] mb-2">
        पृष्ठ भेटिएन (Page Not Found)
      </h1>
      <p className="text-slate-600 max-w-md text-xs sm:text-sm mb-6 leading-relaxed">
        तपाईंले खोज्नुभएको पृष्ठ उपलब्ध छैन वा नाम परिवर्तन गरिएको हुनसक्छ। तल दिइएका मुख्य लिङ्कहरूबाट अगाडि बढ्नुहोस्:
      </p>

      {/* Church Quick Navigation Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-md w-full mb-8 text-left">
        <Link
          to="/"
          className="p-3 bg-white hover:bg-[#e4f3f8] border border-[#d4e8ee] rounded-2xl transition flex items-center justify-between group shadow-2xs"
        >
          <div>
            <div className="text-xs font-bold text-[#214b60]">गृहपृष्ठ (Home)</div>
            <div className="text-[10px] text-slate-500">Welcome & Service Overview</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#4b9fb9] group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          to="/youth"
          className="p-3 bg-white hover:bg-[#e4f3f8] border border-[#d4e8ee] rounded-2xl transition flex items-center justify-between group shadow-2xs"
        >
          <div>
            <div className="text-xs font-bold text-[#214b60]">युवा संगति (Youth Routine)</div>
            <div className="text-[10px] text-slate-500">Weekly routine & teams</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#4b9fb9] group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          to="/choir"
          className="p-3 bg-white hover:bg-[#e4f3f8] border border-[#d4e8ee] rounded-2xl transition flex items-center justify-between group shadow-2xs"
        >
          <div>
            <div className="text-xs font-bold text-[#214b60]">गायक मण्डली (Choir Ministry)</div>
            <div className="text-[10px] text-slate-500">Worship songs & schedules</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#4b9fb9] group-hover:translate-x-1 transition-transform" />
        </Link>

        <Link
          to="/quiz"
          className="p-3 bg-white hover:bg-[#e4f3f8] border border-[#d4e8ee] rounded-2xl transition flex items-center justify-between group shadow-2xs"
        >
          <div>
            <div className="text-xs font-bold text-[#214b60]">बाइबल क्विज (Bible Trivia)</div>
            <div className="text-[10px] text-slate-500">Test your biblical faith</div>
          </div>
          <ArrowRight className="w-4 h-4 text-[#4b9fb9] group-hover:translate-x-1 transition-transform" />
        </Link>
      </div>

      <Link
        to="/"
        className="px-6 py-2.5 bg-[#285c73] hover:bg-[#214b60] text-white text-xs sm:text-sm font-semibold rounded-full shadow-md transition-all hover:scale-105 active:scale-95"
      >
        मुख्य पृष्ठमा फर्कनुहोस्
      </Link>
    </div>
  );
}

// Scroll restoration component with retry for dynamic/lazy elements
function ScrollToTop() {
  const location = useLocation();
  const { pathname, hash } = location;

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      const id = decodeURIComponent(hash.replace('#', ''));
      let attempts = 0;
      const maxAttempts = 30;
      let timer = null;

      const tryScroll = () => {
        const el = document.getElementById(id) || document.querySelector(`[name="${id}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        attempts++;
        if (attempts < maxAttempts) {
          timer = setTimeout(tryScroll, 100);
        }
        return false;
      };

      timer = setTimeout(tryScroll, 50);
      return () => {
        if (timer) clearTimeout(timer);
      };
    }
  }, [pathname, hash, location.key]);

  return null;
}

function MainLayout() {
  const { pathname } = useLocation();
  const isZenSync = pathname.startsWith('/zensync') || pathname.startsWith('/sync');

  return (
    <div className="flex flex-col min-h-screen relative selection:bg-[#dceef5] selection:text-[#214b60]">
      <OfflineBanner />
      {!isZenSync && <Navbar />}
      <main className="flex-grow">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/youth" element={<YouthRoutinePage />} />
              <Route path="/youthroutine" element={<YouthRoutinePage />} />
              <Route path="/choir" element={<ChoirPage />} />
              <Route path="/choir/lyrics" element={<ChoirPage />} />
              <Route path="/lyrics" element={<Navigate to="/choir#lyrics-book" replace />} />
              <Route path="/songbook" element={<Navigate to="/choir#lyrics-book" replace />} />
              <Route path="/calendar" element={<CalendarPage />} />
              <Route path="/calender" element={<CalendarPage />} />
              <Route path="/quiz" element={<BibleQuizPage />} />
              <Route path="/laws" element={<LawsPage />} />
              <Route 
                path="/admin" 
                element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                } 
              />
              <Route path="/zensync/*" element={<ZenSyncPage />} />
              <Route path="/sync/*" element={<ZenSyncPage />} />
              <Route path="/contact" element={<Navigate to="/#contact" replace />} />
              <Route path="/history" element={<Navigate to="/#leadership" replace />} />
              <Route path="/beliefs" element={<Navigate to="/laws" replace />} />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      {!isZenSync && <Footer />}
      {!isZenSync && <Chatbot />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <ScrollToTop />
        <DataProvider>
          <MainLayout />
        </DataProvider>
      </Router>
    </AuthProvider>
  );
}
