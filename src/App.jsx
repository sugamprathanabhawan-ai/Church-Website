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

// Route SEO, AEO & GEO Metadata Configuration
const ROUTE_SEO = {
  '/': {
    title: 'Sugam Prathana Bhawan | Sugam Church Kathmandu, Nepal',
    description: 'Sugam Prathana Bhawan (Sugam Church) is a vibrant Christian church in Kathmandu, Nepal. Join us for Saturday Worship (11:00 AM – 1:00 PM), Youth Fellowship, Choir ministry, and biblical prayer.',
    canonical: 'https://sugamchurch.org/'
  },
  '/youth': {
    title: 'Youth Fellowship & Routine | Sugam Church Kathmandu',
    description: 'Explore the youth fellowship routine, groups (Patrus, Yakub, Yahunna), worship programs, and team schedules at Sugam Prathana Bhawan, Kathmandu, Nepal.',
    canonical: 'https://sugamchurch.org/youth'
  },
  '/youthroutine': {
    title: 'Youth Fellowship & Routine | Sugam Church Kathmandu',
    description: 'Explore the youth fellowship routine, groups (Patrus, Yakub, Yahunna), worship programs, and team schedules at Sugam Prathana Bhawan, Kathmandu, Nepal.',
    canonical: 'https://sugamchurch.org/youth'
  },
  '/choir': {
    title: 'Choir Ministry & Christian Bhajan Lyrics | Sugam Church',
    description: 'Access Sugam Church choir worship songs, Nepali Christian bhajan lyrics with chords, choral arrangements, and Saturday practice schedules.',
    canonical: 'https://sugamchurch.org/choir'
  },
  '/choir/lyrics': {
    title: 'Lyrics & Bhajan Songbook | Sugam Church Kathmandu',
    description: 'Sing along with Sugam Church lyrics book: Nepali Christian worship songs, chords, transpose tools, and bhajan collection.',
    canonical: 'https://sugamchurch.org/choir'
  },
  '/calendar': {
    title: 'Church Calendar & Events Schedule | Sugam Church',
    description: 'View the official yearly calendar, Saturday services, fasting prayer days, and spiritual program dates of Sugam Prathana Bhawan in Kathmandu.',
    canonical: 'https://sugamchurch.org/calendar'
  },
  '/calender': {
    title: 'Church Calendar & Events Schedule | Sugam Church',
    description: 'View the official yearly calendar, Saturday services, fasting prayer days, and spiritual program dates of Sugam Prathana Bhawan in Kathmandu.',
    canonical: 'https://sugamchurch.org/calendar'
  },
  '/quiz': {
    title: 'Bible Quiz & Christian Trivia | Sugam Church',
    description: 'Test your biblical knowledge and deepen your Christian faith with our interactive bilingual (Nepali & English) Bible trivia quiz.',
    canonical: 'https://sugamchurch.org/quiz'
  },
  '/laws': {
    title: 'Church Constitution & Ministry Guidelines | Sugam Church',
    description: 'Read the official church guidelines, Aradhana laws, choir discipline, baptism process, and constitution of Sugam Prathana Bhawan.',
    canonical: 'https://sugamchurch.org/laws'
  },
  '/admin': {
    title: 'Admin Portal | Sugam Church',
    description: 'Administrative portal for Sugam Prathana Bhawan.',
    canonical: 'https://sugamchurch.org/admin',
    noindex: true
  },
  '/zensync': {
    title: 'ZenSync Live Display | Sugam Church',
    description: 'Congregation live worship display system for Sugam Church.',
    canonical: 'https://sugamchurch.org/zensync',
    noindex: true
  }
};

// Dynamic Route SEO, Canonical & Social Meta Updater
function RouteSeoManager() {
  const location = useLocation();
  const { pathname } = location;

  useEffect(() => {
    // Exact or prefix route match
    let matched = ROUTE_SEO[pathname];
    if (!matched) {
      const baseKey = Object.keys(ROUTE_SEO).find(key => key !== '/' && pathname.startsWith(key));
      matched = baseKey ? ROUTE_SEO[baseKey] : {
        title: 'Sugam Prathana Bhawan | Sugam Church Kathmandu, Nepal',
        description: 'Sugam Prathana Bhawan (Sugam Church) is a vibrant Christian church in Kathmandu, Nepal. Saturday Worship 11:00 AM – 1:00 PM.',
        canonical: `https://sugamchurch.org${pathname}`
      };
    }

    // Update document title
    document.title = matched.title;

    // Update meta description
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.setAttribute('content', matched.description);

    // Update OpenGraph Title & Description
    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute('content', matched.title);

    const ogDescription = document.querySelector('meta[property="og:description"]');
    if (ogDescription) ogDescription.setAttribute('content', matched.description);

    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', matched.canonical);

    // Update Twitter Title & Description
    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute('content', matched.title);

    const twDescription = document.querySelector('meta[name="twitter:description"]');
    if (twDescription) twDescription.setAttribute('content', matched.description);

    // Update Canonical link tag
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', matched.canonical);

    // Update robots meta tag for sensitive or internal routes
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    if (matched.noindex) {
      robots.setAttribute('content', 'noindex, nofollow');
    } else {
      robots.setAttribute('content', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    }
  }, [pathname]);

  return null;
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
        <RouteSeoManager />
        <ScrollToTop />
        <DataProvider>
          <MainLayout />
        </DataProvider>
      </Router>
    </AuthProvider>
  );
}
