import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { DataProvider } from './context/DataContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Chatbot from './components/Chatbot';

import HomePage from './pages/HomePage';
import YouthRoutinePage from './pages/YouthRoutinePage';
import ChoirPage from './pages/ChoirPage';
import CalendarPage from './pages/CalendarPage';
import BibleQuizPage from './pages/BibleQuizPage';
import LawsPage from './pages/LawsPage';
import AdminPage from './pages/AdminPage';
import ZenSyncPage from './pages/ZenSyncPage';

// Scroll restoration component
function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
    } else {
      const id = hash.replace('#', '');
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [pathname, hash]);

  return null;
}

function MainLayout() {
  const { pathname } = useLocation();
  const isZenSync = pathname === '/zensync' || pathname === '/sync';

  return (
    <div className="flex flex-col min-h-screen relative selection:bg-sky-200 selection:text-sky-950">
      {!isZenSync && <Navbar />}
      <main className="flex-grow">
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
          <Route path="/zensync" element={<ZenSyncPage />} />
          <Route path="/sync" element={<ZenSyncPage />} />
          <Route path="*" element={<HomePage />} />
        </Routes>
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
