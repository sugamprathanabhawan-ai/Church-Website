import React from 'react';
import { Link } from 'react-router-dom';
import { Heart, Mail } from 'lucide-react';

function FacebookIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function YoutubeIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="no-print bg-sky-950 border-t border-sky-800/80 py-10 text-white w-full mt-auto">
      <div className="max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Church Info */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center gap-3">
              <img 
                src="/images/logos.webp" 
                alt="Sugam Prathana Bhawan Church Logo" 
                className="w-10 h-10 rounded-full object-cover border border-sky-400/40 shadow-sm"
                onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/40'; }}
              />
              <div>
                <h3 className="font-bold text-base font-serif text-sky-100">Sugam Prathana Bhawan</h3>
                <p className="text-xs text-sky-400 font-medium">A Christian Community of Worship &amp; Faith in Nepal</p>
              </div>
            </div>
            <p className="text-xs text-slate-300 max-w-md leading-relaxed">
              Serving God through worship, fellowship, bible teaching, prayer, and community outreach. 
              All are welcome to join our services every Saturday.
            </p>
            <div className="flex gap-3 pt-2">
              <a 
                href="https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-full bg-sky-900 hover:bg-sky-800 flex items-center justify-center text-sky-300 hover:text-white transition shadow-sm"
                aria-label="Facebook"
              >
                <FacebookIcon className="w-4 h-4" />
              </a>
              <a 
                href="https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="w-8 h-8 rounded-full bg-red-900/60 hover:bg-red-800 flex items-center justify-center text-red-300 hover:text-white transition shadow-sm"
                aria-label="YouTube"
              >
                <YoutubeIcon className="w-4 h-4" />
              </a>
              <a 
                href="mailto:sugamprathanabhawan@gmail.com" 
                className="w-8 h-8 rounded-full bg-sky-900 hover:bg-sky-800 flex items-center justify-center text-sky-300 hover:text-white transition shadow-sm"
                aria-label="Email"
              >
                <Mail className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Ministries & Fellowship */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-sky-400 mb-3">Ministries</h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><Link to="/youth" className="hover:text-sky-300 transition">Youth Fellowship</Link></li>
              <li><Link to="/choir" className="hover:text-sky-300 transition">Choir Ministry</Link></li>
              <li><Link to="/zensync" className="hover:text-sky-300 transition">Zen Sync (Live Presentation)</Link></li>
              <li><Link to="/calendar" className="hover:text-sky-300 transition">Church Calendar</Link></li>
              <li><Link to="/laws" className="hover:text-sky-300 transition">Church Laws &amp; Policies</Link></li>
              <li><Link to="/quiz" className="hover:text-sky-300 transition">Bible Trivia Game</Link></li>
            </ul>
          </div>

          {/* Quick External Links */}
          <div>
            <h4 className="font-bold text-xs uppercase tracking-widest text-sky-400 mb-3">Quick Resources</h4>
            <ul className="space-y-2 text-xs text-slate-300">
              <li><a href="https://www.wordproject.org/bibles/ne/" target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 transition">Nepali Holy Bible</a></li>
              <li><a href="https://nepalichristiansongs.com/" target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 transition">Nepali Christian Bhajan</a></li>
              <li><a href="https://choir-attend.vercel.app/" target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 transition">Choir Attendance Portal</a></li>
              <li><a href="https://choir-attend.vercel.app/MemHistory.html" target="_blank" rel="noopener noreferrer" className="hover:text-sky-300 transition">Member History</a></li>
            </ul>
          </div>

        </div>

        <div className="border-t border-sky-800/60 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {currentYear} Sugam Prathana Bhawan. All rights reserved.</p>
          <p className="flex items-center gap-1 text-slate-400">
            <span>To God be the Glory</span>
            <Heart className="w-3 h-3 text-red-400 fill-red-400" />
          </p>
        </div>
      </div>
    </footer>
  );
}
