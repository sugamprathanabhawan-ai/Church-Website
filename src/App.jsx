import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Link, Navigate } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';
import { Loader2 } from 'lucide-react';

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
      <Loader2 className="w-9 h-9 text-sky-500 animate-spin mb-3" />
      <p className="text-xs font-semibold text-slate-500 tracking-wider uppercase">Loading page...</p>
    </div>
  );
}

// 404 Not Found Component
function NotFoundPage() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4 pt-32 pb-16">
      <div className="w-16 h-16 rounded-3xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl font-bold mb-4 shadow-sm">
        404
      </div>
      <h1 className="text-2xl sm:text-3xl font-serif font-bold text-slate-900 mb-2">Page Not Found</h1>
      <p className="text-slate-600 max-w-md text-xs sm:text-sm mb-6">
        The page or resource you are looking for does not exist or may have been relocated.
      </p>
      <Link
        to="/"
        className="px-6 py-2.5 bg-sky-600 hover:bg-sky-500 text-white text-xs sm:text-sm font-semibold rounded-full shadow-md transition-all hover:scale-105"
      >
        Return to Home
      </Link>
    </div>
  );
}

// Scroll restoration component with retry for dynamic/lazy elements
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      const id = hash.replace('#', '');
      const scrollToElement = () => {
        const el = document.getElementById(id);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return true;
        }
        return false;
      };

      if (!scrollToElement()) {
        const timer = setTimeout(scrollToElement, 150);
        return () => clearTimeout(timer);
      }
    }
  }, [pathname, hash]);

  return null;
}

function MainLayout() {
  const { pathname } = useLocation();
  const isZenSync = pathname.startsWith('/zensync') || pathname.startsWith('/sync');

  return (
    <div className="flex flex-col min-h-screen relative selection:bg-sky-200 selection:text-sky-950">
      {!isZenSync && <Navbar />}
      <main className="flex-grow">
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/youth" element={<YouthRoutinePage />} />
            <Route path="/youthroutine" element={<YouthRoutinePage />} />
            <Route path="/choir" element={<ChoirPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/calender" element={<CalendarPage />} />
            <Route path="/quiz" element={<BibleQuizPage />} />
            <Route path="/laws" element={<LawsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/zensync/*" element={<ZenSyncPage />} />
            <Route path="/sync/*" element={<ZenSyncPage />} />
            <Route path="/contact" element={<Navigate to="/#contact" replace />} />
            <Route path="/history" element={<Navigate to="/#leadership" replace />} />
            <Route path="/beliefs" element={<Navigate to="/laws" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </main>
      {!isZenSync && <Footer />}
      {!isZenSync && <Chatbot />}
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <Router>
        <ScrollToTop />
        <MainLayout />
      </Router>
    </DataProvider>
  );
}
