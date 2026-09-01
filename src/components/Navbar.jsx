import React, { useState, useEffect } from 'react';
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
  ShieldAlert
} from 'lucide-react';

const NAV_LINKS = [
  { name: "Home", href: "/", icon: Church },
  { name: "Youth", href: "/youth", icon: Users },
  { name: "Choir", href: "/choir", icon: Music },
  { name: "Calendar", href: "/calendar", icon: Calendar },
  { name: "Games", href: "/quiz", icon: Gamepad2 },
  { name: "Laws", href: "/laws", icon: Scale },
];

const QUICK_LINKS = [
  { name: "Bible", href: "https://www.wordproject.org/bibles/ne/", icon: BookOpen },
  { name: "Bhajan", href: "https://nepalichristiansongs.com/", icon: Music },
  { name: "Attendance", href: "https://choir-attend.vercel.app/", icon: ClipboardCheck },
];

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();

  const isHome = location.pathname === '/';
  const isQuiz = location.pathname === '/quiz';
  const isChoir = location.pathname === '/choir';

  // Scroll detection for transparent vs glass navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
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

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogoClick = () => {
    setLogoClicks(prev => {
      const next = prev + 1;
      if (next >= 4) {
        navigate('/admin');
        return 0;
      }
      return next;
    });
    setTimeout(() => setLogoClicks(0), 2000);
  };

  // Determine navbar theme classes
  const isHeroTransparent = (isHome || isChoir) && !scrolled;
  const headerClass = isQuiz 
    ? 'church-glass-dark text-white' 
    : isHeroTransparent 
      ? 'bg-transparent text-white' 
      : 'church-glass text-slate-800 shadow-sm';

  return (
    <header className="no-print fixed top-0 left-0 w-full z-50 flex flex-col transition-all duration-300">
      {/* Top Quick Bar */}
      <div className="bg-sky-950 text-white/90 py-1 px-4 sm:px-8 md:px-12 flex justify-between sm:justify-end items-center gap-4 sm:gap-6 text-xs border-b border-sky-800/40 select-none">
        <div className="flex sm:hidden text-sky-300 font-semibold items-center gap-1.5 text-xs">
          <Church className="w-3.5 h-3.5 text-sky-400" />
          <span>Sugam Church</span>
        </div>
        <div className="flex items-center gap-4 sm:gap-6 ml-auto">
          {QUICK_LINKS.map(link => {
            const Icon = link.icon;
            return (
              <a 
                key={link.name} 
                href={link.href} 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-sky-400 transition-colors flex items-center gap-1.5 font-medium"
              >
                <Icon className="w-3.5 h-3.5 text-sky-400" />
                <span>{link.name}</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Main Navigation Bar */}
      <nav className={`w-full py-3 px-4 sm:px-8 md:px-12 transition-all duration-300 ${headerClass}`}>
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          
          {/* Logo & Church Name */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={handleLogoClick}>
            <Link to="/" className="flex items-center gap-3">
              <img 
                src="/images/logos.webp" 
                alt="Sugam Prathana Bhawan Logo" 
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-full object-cover shadow-md group-hover:scale-105 transition-transform"
                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/40'; }}
              />
              <div className="flex flex-col">
                <span className={`font-bold text-base sm:text-lg tracking-tight transition-colors ${
                  isQuiz ? 'text-white' : isHeroTransparent ? 'text-white' : 'text-slate-900 group-hover:text-sky-600'
                }`}>
                  Sugam Prathana Bhawan
                </span>
                <span className="text-[10px] text-sky-400 font-medium tracking-widest uppercase hidden sm:block">
                  Sugam Church • Nepal
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <div className="hidden lg:flex items-center space-x-7 font-medium text-sm">
            {NAV_LINKS.map(link => {
              const isActive = location.pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.name}
                  to={link.href}
                  className={`flex items-center gap-1.5 py-1 transition-all ${
                    isActive 
                      ? 'text-sky-500 font-bold border-b-2 border-sky-500' 
                      : isQuiz 
                        ? 'text-slate-200 hover:text-sky-400' 
                        : isHeroTransparent 
                          ? 'text-white hover:text-sky-300' 
                          : 'text-slate-700 hover:text-sky-600'
                  }`}
                >
                  <Icon className="w-4 h-4 opacity-80" />
                  <span>{link.name}</span>
                </Link>
              );
            })}

            <Link
              to="/#contact"
              className="px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-full text-xs font-semibold uppercase tracking-wider hover:shadow-lg hover:shadow-sky-500/25 transition-all transform hover:-translate-y-0.5"
            >
              Visit Us
            </Link>
          </div>

          {/* Mobile Hamburger Toggle Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={`lg:hidden p-2 rounded-xl text-xl z-50 focus:outline-none transition-colors ${
              isQuiz || isHeroTransparent ? 'text-white hover:bg-white/10' : 'text-slate-800 hover:bg-slate-100'
            }`}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </nav>

      {/* Mobile Drawer Navigation Menu */}
      <div 
        className={`fixed inset-0 bg-slate-950/95 backdrop-blur-2xl flex flex-col justify-between p-6 pt-24 text-white lg:hidden z-40 transition-transform duration-300 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col gap-2">
          <div className="text-xs uppercase font-bold tracking-widest text-sky-400 mb-2 px-3 flex items-center justify-between">
            <span>Navigation Menu</span>
            <Sparkles className="w-4 h-4 text-sky-400" />
          </div>

          {NAV_LINKS.map(link => {
            const isActive = location.pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                to={link.href}
                className={`flex items-center justify-between px-4 py-3.5 rounded-2xl transition-all text-base font-semibold ${
                  isActive 
                    ? 'bg-sky-500/20 text-sky-400 border border-sky-500/40 shadow-sm' 
                    : 'text-slate-200 hover:bg-white/5 active:bg-white/10'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{link.name}</span>
                </span>
                {isActive ? (
                  <span className="w-2 h-2 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]"></span>
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-500" />
                )}
              </Link>
            );
          })}
        </div>

        {/* Quick Links inside mobile drawer */}
        <div className="border-t border-slate-800/80 pt-5 mt-4 space-y-3">
          <div className="text-xs uppercase font-bold tracking-widest text-slate-400 px-3">
            Quick Resources
          </div>
          <div className="grid grid-cols-3 gap-2">
            {QUICK_LINKS.map(link => {
              const Icon = link.icon;
              return (
                <a
                  key={link.name}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-slate-900 border border-slate-800 hover:border-sky-500/40 text-xs text-slate-300 font-medium transition-colors"
                >
                  <Icon className="w-5 h-5 text-sky-400 mb-1" />
                  <span className="truncate">{link.name}</span>
                </a>
              );
            })}
          </div>

          <Link
            to="/admin"
            className="flex items-center justify-center gap-2 w-full py-2.5 bg-slate-900 border border-slate-800 hover:border-sky-500/40 rounded-2xl text-xs text-slate-400 font-medium transition-all"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
            <span>Admin Portal</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
