import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Menu, 
  X, 
  BookOpen, 
  Music, 
  ClipboardCheck, 
  Church, 
  Calendar, 
  Gamepad2, 
  Scale, 
  Users, 
  Sparkles,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Presentation,
  MapPin,
  ExternalLink,
  History,
  Headphones
} from 'lucide-react';

const NAV_LINKS = [
  { name: "Home", href: "/", icon: Church },
  { name: "Youth", href: "/youth", icon: Users },
  { name: "Choir", href: "/choir", icon: Music },
  { name: "Zen Sync", href: "/zensync", icon: Presentation },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Games", href: "/quiz", icon: Gamepad2 },
  { name: "Laws", href: "/laws", icon: Scale },
];

const QUICK_RESOURCES = [
  { name: "Audio Sermons & Bible", href: "/#audio-sermons", icon: Headphones, internal: true },
  { name: "Sugam Lyrics Book", href: "/choir#lyrics-book", icon: Music, internal: true },
  { name: "Nepali Holy Bible", href: "https://www.wordproject.org/bibles/ne/", icon: BookOpen },
  { name: "Christian Bhajan", href: "https://nepalichristiansongs.com/", icon: Music },
  { name: "Choir Attendance", href: "https://choir-attend.vercel.app/", icon: ClipboardCheck },
  { name: "Member History", href: "https://choir-attend.vercel.app/MemHistory.html", icon: History },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const logoClicksRef = useRef(0);
  const logoTimerRef = useRef(null);
  const resourcesRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === '/';
  const isQuiz = location.pathname === '/quiz';
  const isChoir = location.pathname === '/choir';

  // Scroll detection for transparent hero vs frosted glass (threshold filtered to avoid redundant re-renders)
  useEffect(() => {
    let prev = window.scrollY > 30;
    setScrolled(prev);

    const handleScroll = () => {
      const isPast = window.scrollY > 30;
      if (isPast !== prev) {
        prev = isPast;
        setScrolled(isPast);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (resourcesRef.current && !resourcesRef.current.contains(e.target)) {
        setResourcesOpen(false);
      }
    };
    document.addEventListener('pointerdown', handleClickOutside);
    return () => document.removeEventListener('pointerdown', handleClickOutside);
  }, []);

  // Admin shortcut: Ctrl+Shift+A or 4 clicks on logo
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey && e.shiftKey && (e.key === 'A' || e.key === 'a')) || 
          (e.altKey && (e.key === 'A' || e.key === 'a'))) {
        e.preventDefault();
        navigate('/admin');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Close mobile drawer on route or anchor change
  useEffect(() => {
    setMobileMenuOpen(false);
    setResourcesOpen(false);
  }, [location.pathname, location.hash]);

  const handleLogoClick = () => {
    logoClicksRef.current += 1;
    if (logoClicksRef.current >= 4) {
      navigate('/admin');
      logoClicksRef.current = 0;
      return;
    }
    clearTimeout(logoTimerRef.current);
    logoTimerRef.current = setTimeout(() => {
      logoClicksRef.current = 0;
    }, 2000);
  };

  // Determine dark vs light frosted glass surface
  const isHeroTransparent = (isHome || isChoir) && !scrolled;
  const isDarkTheme = isHeroTransparent || isQuiz;

  return (
    <header className="no-print fixed top-0 left-0 w-full z-50 transition-all duration-300 font-sans">
      {/* Single Pure Glassmorphism Header Bar - No Dark Blue */}
      <nav 
        className={`w-full py-3.5 px-4 sm:px-8 md:px-12 transition-all duration-300 border-b ${
          isDarkTheme
            ? 'text-white border-white/20 shadow-[0_4px_24px_rgba(0,0,0,0.12)]'
            : 'text-[#214b60] border-[#d4e8ee] shadow-[0_4px_24px_rgba(33,75,96,0.06)]'
        }`}
        style={{
          background: isDarkTheme
            ? 'linear-gradient(120deg, rgba(222, 243, 252, 0.22), rgba(192, 224, 239, 0.10))'
            : 'rgba(255, 255, 255, 0.82)',
          backdropFilter: 'blur(20px) saturate(140%)',
          WebkitBackdropFilter: 'blur(20px) saturate(140%)'
        }}
      >
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Logo & Church Name */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <Link to="/" className="flex items-center gap-2.5">
              <img 
                src="/images/logos.webp" 
                alt="Sugam Prathana Bhawan Logo" 
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shadow-md group-hover:scale-105 transition-transform"
                onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/images/logos.webp'; }}
              />
              <div className="flex items-baseline gap-1">
                <span className={`font-serif text-2xl sm:text-3xl font-medium tracking-tight transition-colors ${
                  isDarkTheme ? 'text-white' : 'text-[#214b60]'
                }`}>
                  sugam<span className="text-[#4b9fb9]">.</span>
                </span>
                <span className={`text-[10px] tracking-widest uppercase hidden md:inline ml-2 ${
                  isDarkTheme ? 'text-white/70' : 'text-[#60899b]'
                }`}>
                  Church
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-6 xl:space-x-7 font-medium text-sm">
            {NAV_LINKS.map(link => {
              const isActive = location.pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`flex items-center gap-1.5 py-1 transition-all ${
                    isActive 
                      ? 'text-[#4b9fb9] font-bold border-b-2 border-[#4b9fb9]' 
                      : isDarkTheme 
                        ? 'text-white/90 hover:text-[#d5eef6]' 
                        : 'text-[#214b60] hover:text-[#4b9fb9]'
                  }`}
                >
                  <Icon className="w-4 h-4 opacity-80" />
                  <span>{link.name}</span>
                </Link>
              );
            })}

            {/* Glassmorphic Resources Dropdown */}
            <div className="relative" ref={resourcesRef}>
              <button
                type="button"
                onClick={() => setResourcesOpen(!resourcesOpen)}
                className={`flex items-center gap-1 py-1 font-medium transition-colors cursor-pointer ${
                  isDarkTheme 
                    ? 'text-white/90 hover:text-[#d5eef6]' 
                    : 'text-[#214b60] hover:text-[#4b9fb9]'
                }`}
                aria-expanded={resourcesOpen}
                aria-haspopup="true"
              >
                <span>Resources</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${resourcesOpen ? 'rotate-180' : ''}`} />
              </button>

              {resourcesOpen && (
                <div 
                  className={`absolute top-full right-0 mt-3 w-60 rounded-2xl p-2 shadow-2xl border transition-all duration-200 z-50 animate-fade-in ${
                    isDarkTheme
                      ? 'border-white/25 text-white'
                      : 'border-[#d4e8ee] text-[#214b60]'
                  }`}
                  style={{
                    background: isDarkTheme 
                      ? 'linear-gradient(135deg, rgba(31, 72, 91, 0.94), rgba(34, 80, 101, 0.90))' 
                      : 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(24px)',
                    WebkitBackdropFilter: 'blur(24px)'
                  }}
                >
                  <span className={`block text-[9px] font-bold tracking-widest uppercase px-3 py-1.5 ${
                    isDarkTheme ? 'text-[#b6d8e8]' : 'text-[#60899b]'
                  }`}>
                    Quick Resources
                  </span>
                  {QUICK_RESOURCES.map(res => {
                    const Icon = res.icon;
                    if (res.internal) {
                      return (
                        <Link
                          key={res.name}
                          to={res.href}
                          onClick={() => setResourcesOpen(false)}
                          className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-colors ${
                            isDarkTheme
                              ? 'bg-white/10 hover:bg-white/20 text-[#7cc5dc]'
                              : 'bg-[#e4f3f8] hover:bg-[#dceef5] text-[#285c73]'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <Icon className="w-3.5 h-3.5 text-[#4b9fb9]" />
                            <span>{res.name}</span>
                          </div>
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-md bg-[#285c73] text-white">Console</span>
                        </Link>
                      );
                    }
                    return (
                      <a
                        key={res.name}
                        href={res.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setResourcesOpen(false)}
                        className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                          isDarkTheme
                            ? 'hover:bg-white/15 text-white'
                            : 'hover:bg-[#e4f3f8] text-[#214b60]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Icon className="w-3.5 h-3.5 text-[#4b9fb9]" />
                          <span>{res.name}</span>
                        </div>
                        <ExternalLink className="w-3 h-3 opacity-60" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-2 rounded-xl text-xl z-50 focus:outline-none transition-colors ${
              isDarkTheme ? 'text-white hover:bg-white/10' : 'text-[#214b60] hover:bg-[#e4f3f8]'
            }`}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation Menu */}
      <div 
        className={`fixed inset-0 flex flex-col justify-between p-6 pt-24 text-white lg:hidden z-40 transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          background: 'linear-gradient(135deg, rgba(15, 40, 53, 0.96), rgba(20, 52, 68, 0.94))',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)'
        }}
      >
        <div className="flex flex-col gap-2 overflow-y-auto">
          <div className="text-xs uppercase font-bold tracking-widest text-[#7cc5dc] mb-2 px-3 flex items-center justify-between">
            <span>Navigation Menu</span>
            <Sparkles className="w-4 h-4 text-[#7cc5dc]" />
          </div>

          {NAV_LINKS.map(link => {
            const isActive = location.pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                to={link.href}
                className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all text-sm sm:text-base font-semibold ${
                  isActive 
                    ? 'bg-[#4b9fb9]/25 text-[#7cc5dc] border border-[#4b9fb9]/40 shadow-sm' 
                    : 'text-slate-100 hover:bg-white/10 active:bg-white/15'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#7cc5dc]' : 'text-slate-300'}`} />
                  <span>{link.name}</span>
                </span>
                {isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[#7cc5dc] shadow-[0_0_8px_#7cc5dc]"></span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Links inside mobile drawer */}
        <div className="border-t border-white/15 pt-5 mt-4 space-y-3">
          <div className="text-xs uppercase font-bold tracking-widest text-[#7cc5dc] px-3">
            Quick Resources
          </div>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_RESOURCES.map(res => {
              const Icon = res.icon;
              if (res.internal) {
                return (
                  <Link
                    key={res.name}
                    to={res.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 p-3 rounded-2xl bg-[#4b9fb9]/20 border border-[#4b9fb9]/40 text-xs text-white font-medium transition-colors"
                  >
                    <Icon className="w-4 h-4 text-[#7cc5dc] shrink-0" />
                    <span className="truncate">{res.name}</span>
                  </Link>
                );
              }
              return (
                <a
                  key={res.name}
                  href={res.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 rounded-2xl bg-white/10 border border-white/15 hover:border-[#4b9fb9]/40 text-xs text-slate-100 font-medium transition-colors"
                >
                  <Icon className="w-4 h-4 text-[#7cc5dc] shrink-0" />
                  <span className="truncate">{res.name}</span>
                </a>
              );
            })}
          </div>

          <Link
            to="/#contact"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#285c73] hover:bg-[#214b60] rounded-2xl text-xs text-white font-semibold shadow-sm transition-all"
          >
            <MapPin className="w-3.5 h-3.5 text-white" />
            <span>Visit Us (Location &amp; Contact)</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
