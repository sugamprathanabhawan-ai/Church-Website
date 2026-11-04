import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  MessageCircle, 
  X, 
  Send, 
  Bot, 
  Sparkles, 
  ChevronDown, 
  RotateCcw, 
  Mic, 
  MicOff, 
  Volume2, 
  VolumeX,
  Globe,
  ExternalLink,
  MapPin,
  ChevronRight,
  Share2,
  Database
} from 'lucide-react';
import { fetchFaqs } from '../services/supabaseService';
import { 
  askGemini, 
  getStoredGeminiConfig, 
  fetchRemoteGeminiConfig 
} from '../services/geminiService';
import DatabaseManagerModal from './DatabaseManagerModal';

// Custom Social Icons
function FacebookChatIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function YoutubeChatIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  );
}

// Internal church routes mapping
const ROUTE_INFO = {
  '/youth': { title: 'Youth Routine', desc: 'जवान संगति तालिका' },
  '/choir': { title: 'Choir Ministry', desc: 'गायक मण्डली र भजनहरू' },
  '/calendar': { title: 'Church Calendar', desc: 'वार्षिक क्यालेन्डर' },
  '/quiz': { title: 'Bible Trivia Quiz', desc: 'बाइबल क्विज खेल' },
  '/laws': { title: 'Church Constitution', desc: 'विधान र नियमहरू' },
  '/zensync': { title: 'Zen Sync Live', desc: 'स्क्रिन प्रेजेन्टेसन' },
};

// Social preview card component (Facebook, Google Maps, YouTube, External)
function SocialLinkCard({ url }) {
  const lowerUrl = url.toLowerCase();

  // Facebook Preview Card
  if (lowerUrl.includes('facebook.com') || lowerUrl.includes('fb.com') || lowerUrl.includes('fb.watch')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50/95 via-sky-50/70 to-blue-50/95 hover:from-blue-100 hover:to-sky-100/90 border border-blue-200/90 rounded-2xl transition-all duration-200 group no-underline shadow-xs hover:shadow-md hover:scale-[1.01]"
      >
        <div className="w-10 h-10 rounded-xl bg-[#1877F2] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
          <FacebookChatIcon className="w-5 h-5 fill-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-[#1877F2] tracking-wider">
            <span>Facebook</span>
            <span className="w-1 h-1 rounded-full bg-[#1877F2]"></span>
            <span className="text-slate-500 font-medium">Official Page</span>
          </div>
          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-[#1877F2] transition-colors">
            Sugam Prathana Bhawan Church
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            फेसबुकमा जोडिनुहोस् • View updates, live streams & photos
          </div>
        </div>
        <div className="p-1.5 rounded-lg bg-blue-100 group-hover:bg-[#1877F2] text-[#1877F2] group-hover:text-white transition-colors shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </a>
    );
  }

  // Google Maps Preview Card
  if (lowerUrl.includes('maps.google') || lowerUrl.includes('goo.gl/maps') || lowerUrl.includes('maps.app.goo.gl') || lowerUrl.includes('google.com/maps')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex items-center gap-3 p-3 bg-gradient-to-r from-emerald-50/95 via-teal-50/70 to-emerald-50/95 hover:from-emerald-100 hover:to-teal-100/90 border border-emerald-200/90 rounded-2xl transition-all duration-200 group no-underline shadow-xs hover:shadow-md hover:scale-[1.01]"
      >
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
          <MapPin className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
            <span>Google Maps</span>
            <span className="w-1 h-1 rounded-full bg-emerald-600"></span>
            <span className="text-slate-500 font-medium">स्थान & Directions</span>
          </div>
          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-emerald-700 transition-colors">
            Sugam Prathana Bhawan, Kathmandu
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            नक्सामा हेर्नुहोस् • Turn-by-Turn GPS Directions
          </div>
        </div>
        <div className="p-1.5 rounded-lg bg-emerald-100 group-hover:bg-emerald-600 text-emerald-700 group-hover:text-white transition-colors shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </a>
    );
  }

  // YouTube Preview Card
  if (lowerUrl.includes('youtube.com') || lowerUrl.includes('youtu.be')) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2.5 flex items-center gap-3 p-3 bg-gradient-to-r from-rose-50/95 via-red-50/70 to-rose-50/95 hover:from-rose-100 hover:to-red-100/90 border border-rose-200/90 rounded-2xl transition-all duration-200 group no-underline shadow-xs hover:shadow-md hover:scale-[1.01]"
      >
        <div className="w-10 h-10 rounded-xl bg-[#FF0000] text-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform">
          <YoutubeChatIcon className="w-5 h-5 fill-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-rose-600 tracking-wider">
            <span>YouTube</span>
            <span className="w-1 h-1 rounded-full bg-rose-600"></span>
            <span className="text-slate-500 font-medium">Sugam Church Media</span>
          </div>
          <div className="text-xs font-bold text-slate-800 truncate group-hover:text-rose-600 transition-colors">
            Official Church YouTube Channel
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            युट्युबमा हेर्नुहोस् • Watch Worship Songs & Gospel Sermons
          </div>
        </div>
        <div className="p-1.5 rounded-lg bg-rose-100 group-hover:bg-rose-600 text-rose-600 group-hover:text-white transition-colors shrink-0">
          <ExternalLink className="w-3.5 h-3.5" />
        </div>
      </a>
    );
  }

  // Generic External Link Card
  let cleanDomain = url;
  try {
    cleanDomain = new URL(url).hostname;
  } catch (e) {}

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs text-slate-700 transition font-medium group no-underline"
    >
      <div className="flex items-center gap-2 min-w-0 pr-2">
        <Share2 className="w-3.5 h-3.5 text-[#285c73] shrink-0" />
        <span className="truncate font-medium text-[11px]">{cleanDomain}</span>
      </div>
      <ExternalLink className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#285c73] shrink-0" />
    </a>
  );
}

// Helper to parse markdown links, raw URLs, and internal church route chips
function parseRichContent(text) {
  if (!text) return { elements: [], extractedUrls: [], churchRoutes: [] };

  // Detect church route mentions (/youth, /choir, /calendar, /quiz, /laws, /zensync)
  const routeRegex = /(?:^|\s)(\/(?:youth|choir|calendar|quiz|laws|zensync))\b/gi;
  const churchRoutes = [];
  let routeMatch;
  while ((routeMatch = routeRegex.exec(text)) !== null) {
    const route = routeMatch[1].toLowerCase();
    if (!churchRoutes.includes(route)) {
      churchRoutes.push(route);
    }
  }

  // Regex to match markdown links [label](url) and bare URLs https?://...
  const combinedRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>)"]+)/gi;

  const elements = [];
  const extractedUrls = [];
  let lastIndex = 0;
  let match;

  while ((match = combinedRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.substring(lastIndex, match.index));
    }

    if (match[1] && match[2]) {
      // Markdown link
      const label = match[1];
      const linkUrl = match[2];
      extractedUrls.push(linkUrl);
      elements.push(
        <a
          key={`md-${match.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1877f2] hover:text-[#0b5cba] underline font-semibold break-all inline-flex items-center gap-0.5 mx-0.5"
        >
          <span>{label}</span>
          <ExternalLink className="w-3 h-3 inline shrink-0" />
        </a>
      );
    } else if (match[3]) {
      // Bare URL
      const linkUrl = match[3];
      extractedUrls.push(linkUrl);

      let shortLabel = linkUrl;
      try {
        const u = new URL(linkUrl);
        shortLabel = u.hostname + (u.pathname.length > 1 ? u.pathname.substring(0, 15) + '...' : '');
      } catch (e) {}

      elements.push(
        <a
          key={`bare-${match.index}`}
          href={linkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#1877f2] hover:text-[#0b5cba] underline font-semibold break-all inline-flex items-center gap-0.5 mx-0.5"
        >
          <span>{shortLabel}</span>
          <ExternalLink className="w-3 h-3 inline shrink-0" />
        </a>
      );
    }

    lastIndex = combinedRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  const uniqueUrls = Array.from(new Set(extractedUrls));
  const lowerText = text.toLowerCase();

  // Smart Context Detection: If Facebook is discussed and no FB link was already included, attach official FB Card
  if (!uniqueUrls.some(u => u.includes('facebook.com') || u.includes('fb.com')) &&
      (lowerText.includes('facebook') || lowerText.includes('फेसबुक') || lowerText.includes('fb page'))) {
    uniqueUrls.push('https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr');
  }

  // Smart Context Detection: If YouTube/videos/sermons are discussed and no YT link was included, attach official YT Card
  if (!uniqueUrls.some(u => u.includes('youtube.com') || u.includes('youtu.be')) &&
      (lowerText.includes('youtube') || lowerText.includes('युट्युब') || lowerText.includes('भिडियो') || lowerText.includes('sermon') || lowerText.includes('worship song'))) {
    uniqueUrls.push('https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ');
  }

  // Smart Context Detection: If church location / directions / map are discussed and no Maps link was included, attach Maps Card
  if (!uniqueUrls.some(u => u.includes('maps.google') || u.includes('google.com/maps') || u.includes('maps.app.goo.gl')) &&
      (lowerText.includes('काठमाडौँ') || lowerText.includes('अवस्थित') || lowerText.includes('location') || lowerText.includes('direction') || lowerText.includes('map') || lowerText.includes('नक्सा') || lowerText.includes('ठेगाना') || lowerText.includes('where is the church') || lowerText.includes('चर्च कहाँ छ'))) {
    uniqueUrls.push('https://maps.app.goo.gl/JccnzNUZQzF47xp6A');
  }

  return { elements, extractedUrls: uniqueUrls, churchRoutes };
}

export default function Chatbot() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showDatabaseModal, setShowDatabaseModal] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'जयमसीह! (Peace be with you!) I am Fofu, your official church assistant for Sugam Prathana Bhawan. How can I help you today? मलाई सोध्नुहोस् (Ask me anything)!',
      options: [
        'चर्चको स्थान र नक्सा कहाँ छ? (Where is church?)',
        'फेसबुक र युट्युब लिङ्क दिनुहोस् (Facebook & YouTube)',
        'When are the church service times?',
        'Open live database manager (Fofu Database)'
      ]
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [faqData, setFaqData] = useState([]);
  const [geminiConfig, setGeminiConfig] = useState(getStoredGeminiConfig);
  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);

  // Global trigger: typing "fofu" anywhere on keyboard opens the database manager
  useEffect(() => {
    let keyBuffer = '';
    const handleGlobalKey = (e) => {
      const tag = e.target.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;
      keyBuffer += e.key.toLowerCase();
      if (keyBuffer.length > 8) keyBuffer = keyBuffer.slice(-8);
      if (keyBuffer.endsWith('fofu')) {
        setShowDatabaseModal(true);
        keyBuffer = '';
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  // Voice to text (Speech Recognition) state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('ne-NP');
  const [speechError, setSpeechError] = useState(null);
  const [speakingMsgId, setSpeakingMsgId] = useState(null);
  const recognitionRef = useRef(null);
  const baseTextBeforeSpeechRef = useRef('');

  // Check if browser supports Web Speech API
  const isSpeechSupported = typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  // Load FAQ & Gemini config on mount
  useEffect(() => {
    fetchFaqs()
      .then(faqs => {
        if (faqs && faqs.length > 0) {
          setFaqData(faqs);
        } else {
          setFaqData([
            {
              keywords: ['service', 'time', 'saturday', 'worship', 'start', 'timing', 'samaya'],
              question: 'When are the church service times?',
              answer: 'Main worship service is held every Saturday at 11:00 AM to 1:00 PM. Youth fellowship follows shortly after at 1:00 PM.\nYouth Routine: /youth\nChoir Routine: /choir'
            },
            {
              keywords: ['location', 'where', 'address', 'directions', 'place', 'map', 'naksa', 'sthan'],
              question: 'Where is the church located?',
              answer: 'Sugam Prathana Bhawan is located in Kathmandu, Nepal. Click below to view Google Maps directions:\nhttps://maps.app.goo.gl/JccnzNUZQzF47xp6A'
            },
            {
              keywords: ['facebook', 'fb', 'social', 'page'],
              question: 'What is the church Facebook page?',
              answer: 'Follow our official church Facebook page for updates, announcements, and live streams:\nhttps://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr'
            },
            {
              keywords: ['youtube', 'video', 'channel', 'sermon', 'worship', 'song', 'bhajan'],
              question: 'What is the church YouTube channel?',
              answer: 'Watch Sunday worship songs and gospel sermons on our official YouTube channel:\nhttps://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ'
            },
            {
              keywords: ['youth', 'routine', 'fellowship', 'sangati', 'jawan'],
              question: 'What is the youth routine?',
              answer: 'You can check the complete youth schedule, teams, and fellowship leaders under the Youth section:\n/youth'
            },
            {
              keywords: ['choir', 'practice', 'songs', 'music', 'gayak'],
              question: 'What is the choir routine?',
              answer: 'Choir practice is held every Saturday morning from 9:40 AM to 10:40 AM. Listen to choir songs and view routine:\n/choir'
            },
            {
              keywords: ['contact', 'pastor', 'phone', 'email'],
              question: 'How can I contact the church?',
              answer: 'You can reach us by email at sugamprathanabhawan@gmail.com or visit our church in Kathmandu.\nOfficial Facebook: https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr'
            }
          ]);
        }
      })
      .catch(err => {
        console.warn('FAQ load warning:', err);
      });

    // Check remote config from Supabase or localStorage
    fetchRemoteGeminiConfig().then(cfg => {
      setGeminiConfig(cfg);
    });
  }, []);

  // Sync config whenever chat opens
  useEffect(() => {
    if (isOpen) {
      setGeminiConfig(getStoredGeminiConfig());
    }
  }, [isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && chatScrollContainerRef.current) {
      chatScrollContainerRef.current.scrollTo({
        top: chatScrollContainerRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, isTyping, isOpen]);

  // Cleanup speech synthesis & recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Voice to text handler
  const startListening = () => {
    if (!isSpeechSupported) {
      setSpeechError('Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    try {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRec();
      recognition.lang = speechLang;
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.maxAlternatives = 1;

      baseTextBeforeSpeechRef.current = inputText;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      recognition.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            final += transcript;
          } else {
            interim += transcript;
          }
        }

        const recognized = (final || interim).trim();
        if (recognized) {
          const prefix = baseTextBeforeSpeechRef.current.trim();
          setInputText(prefix ? `${prefix} ${recognized}` : recognized);
        }
      };

      recognition.onerror = (event) => {
        console.warn('[Chatbot] Speech Recognition Error:', event.error);
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission blocked. Please allow microphone in browser.');
        } else if (event.error === 'no-speech') {
          // Silent timeout
        } else {
          setSpeechError(`Voice error: ${event.error}`);
        }
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error('[Chatbot] Failed to start speech recognition:', err);
      setIsListening(false);
      setSpeechError('Could not start microphone.');
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {}
    }
    setIsListening(false);
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleSpeechLang = () => {
    const nextLang = speechLang === 'ne-NP' ? 'en-US' : 'ne-NP';
    setSpeechLang(nextLang);
    if (isListening) {
      stopListening();
    }
  };

  // Text to speech playback handler
  const handleToggleSpeak = (msgId, text) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (speakingMsgId === msgId) {
      window.speechSynthesis.cancel();
      setSpeakingMsgId(null);
      return;
    }

    window.speechSynthesis.cancel();
    // Strip URLs before reading to sound natural
    const cleanSpeechText = text.replace(/https?:\/\/[^\s]+/g, '').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
    const utterance = new SpeechSynthesisUtterance(cleanSpeechText || text);
    utterance.lang = speechLang === 'ne-NP' ? 'ne-NP' : 'en-US';
    utterance.rate = 1.0;

    utterance.onend = () => setSpeakingMsgId(null);
    utterance.onerror = () => setSpeakingMsgId(null);

    setSpeakingMsgId(msgId);
    window.speechSynthesis.speak(utterance);
  };

  const findBestAnswer = (userQuery) => {
    const q = userQuery.toLowerCase().trim();
    if (!q) return null;

    for (const item of faqData) {
      if (item.keywords && item.keywords.some(k => q.includes(k.toLowerCase()))) {
        return item.answer;
      }
      if (item.question && item.question.toLowerCase().includes(q)) {
        return item.answer;
      }
    }

    if (q.includes('hello') || q.includes('hi') || q.includes('jayamasih') || q.includes('namaste')) {
      return 'जयमसीह! (Jayamasih!) How can I assist you with church routines, services, Facebook, YouTube, or ministries today? मलाई सोध्नुहोस्!';
    }

    if (q.includes('facebook') || q.includes('fb') || q.includes('फेसबुक')) {
      if (q.includes('youtube') || q.includes('युट्युब') || q.includes('video') || q.includes('भिडियो')) {
        return 'सुगम प्रार्थना भवनको आधिकारिक फेसबुक र युट्युब प्रत्यक्ष लिङ्कहरू यहाँ छन्:\n• Facebook: https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr\n• YouTube: https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ';
      }
      return 'सुगम प्रार्थना भवनको आधिकारिक फेसबुक पेज (Official Facebook Page):\nhttps://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr';
    }

    if (q.includes('youtube') || q.includes('video') || q.includes('युट्युब') || q.includes('sermon') || q.includes('भिडियो')) {
      return 'सुगम प्रार्थना भवनको आधिकारिक युट्युब च्यानल (Official YouTube Channel):\nhttps://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ';
    }

    if (q.includes('map') || q.includes('location') || q.includes('directions') || q.includes('where') || q.includes('नक्सा') || q.includes('स्थान') || q.includes('कहाँ')) {
      return 'सुगम प्रार्थना भवन काठमाडौँ, नेपालमा अवस्थित छ। गुगल म्याप्समा प्रत्यक्ष हेर्नुहोस्:\nhttps://maps.app.goo.gl/JccnzNUZQzF47xp6A';
    }

    if (q.includes('youth') || q.includes('जवान') || q.includes('routine') || q.includes('तालिका')) {
      if (q.includes('karthik') || q.includes('कात्तिक') || q.includes('कार्तिक')) {
        return 'कात्तिक महिनाको जवान संगति तालिका (Karthik Youth Routine):\n• Date 7: चेला बन्ने विषय (Patrus group)\n• Date 14: 1 hour youth sangati (Yahunna group)\n• Date 21: Fellowship & Bible study (Yakub group)\n• Date 28: Spiritual growth & discussion\nथप जानकारीको लागि /youth हेर्नुहोस्।';
      }
      if (q.includes('mangsir') || q.includes('मंसिर') || q.includes('मङ्गसिर')) {
        return 'मंसिर महिनाको जवान संगति तालिका (Mangsir Youth Routine):\n• Date 5: fellowship sharing (Yakub group)\n• Date 12: Bible study & prayer (Patrus group)\n• Date 19: testimony & group sharing (Yahunna group)\n• Date 26: special fellowship\nसम्पूर्ण विवरण /youth मा उपलब्ध छ।';
      }
      return 'जवान संगति (Youth Fellowship) प्रत्येक शनिबार दिउँसो १:०० बजे देखि २:३०/३:०० बजेसम्म हुन्छ (regular 12:30 PM - 1:00 PM; 2nd Saturday 2:00 PM - 3:00 PM)। जवान समूहहरू: पत्रुस (Sara Poudel), याकूब (Suraj Pokhrel), यूहन्ना (Urmila Chaudhary)। विस्तृत तालिका हेर्न /youth मा जानुहोस्।';
    }

    if (q.includes('choir') || q.includes('गायक') || q.includes('carol') || q.includes('क्यारोल') || q.includes('practice') || q.includes('अभ्यास')) {
      if (q.includes('carol') || q.includes('क्यारोल') || q.includes('christmas')) {
        return 'क्रिसमस क्यारोल अभ्यास (Christmas Carol Practice) कात्तिक १४, २१ र २८ गते बिहान ९:०० देखि १०:५० सम्म हुनेछ। नियमित गायक मण्डली अभ्यास शनिबार बिहान ९:४० देखि १०:४० सम्म हुन्छ। थप विवरण /choir मा हेर्नुहोस्।';
      }
      return 'गायक मण्डली अभ्यास (Choir Practice) प्रत्येक शनिबार बिहान ९:४० देखि १०:४० सम्म सञ्चालन हुन्छ (१ देखि ५ औं शनिबारको विशेष ढाँचासहित)। भजनका शब्द र अभ्यास तालिका /choir मा उपलब्ध छ।';
    }

    if (q.includes('service') || q.includes('worship') || q.includes('समय') || q.includes('time') || q.includes('संगति') || q.includes('आराधना')) {
      return 'सुगम प्रार्थना भवनको मुख्य आराधना (Main Worship) प्रत्येक शनिबार बिहान ११:०० देखि दिउँसो १:०० सम्म हुन्छ। त्यसपछि दिउँसो १:०० बजे देखि जवान संगति (Youth Fellowship) हुन्छ।';
    }

    return 'Thank you for asking! For specific inquiries, feel free to visit us during Saturday service or check our Facebook page:\nhttps://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr\nOr check /youth for youth routines and /choir for choir schedules.';
  };

  const handleSend = async (textToSend) => {
    const query = (textToSend || inputText).trim();
    if (!query) return;

    if (isListening) {
      stopListening();
    }

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    baseTextBeforeSpeechRef.current = '';

    // Direct Fofu Database trigger: opening the currently running database
    const lowerQuery = query.toLowerCase();
    const isFofuTrigger = lowerQuery.includes('fofu') || 
                          lowerQuery.includes('database') || 
                          lowerQuery.includes('open db') ||
                          lowerQuery.includes('delete session') ||
                          lowerQuery.includes('delete data');

    if (isFofuTrigger) {
      setShowDatabaseModal(true);
      const fofuResponse = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'जयमसीह! I am Fofu. I have opened the Database Manager for the currently running Supabase instance (aiufpdabglxhojmmkedp).\n\nYou can inspect active presentation sessions and delete them directly.',
        isDatabaseAction: true,
      };
      setMessages(prev => [...prev, fofuResponse]);
      setIsTyping(false);
      return;
    }

    setIsTyping(true);

    const activeConfig = getStoredGeminiConfig();
    const isGeminiEnabled = activeConfig.enabled !== false;

    if (isGeminiEnabled) {
      try {
        const response = await askGemini({
          prompt: query,
          history: messages
        });

        const botMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: response.text,
          modelUsed: response.modelUsed || 'Sugam Church Bot'
        };
        setMessages(prev => [...prev, botMessage]);
        setIsTyping(false);
        return;
      } catch (err) {
        console.warn('[Chatbot] Server chat call issue, attempting verified FAQ lookup:', err.message);
      }
    }

    // Fallback: rule-based FAQ matching from verified church FAQs
    const faqAnswer = findBestAnswer(query);
    if (faqAnswer) {
      setTimeout(() => {
        const botMessage = {
          id: (Date.now() + 1).toString(),
          sender: 'bot',
          text: faqAnswer,
          modelUsed: 'Church FAQ'
        };
        setMessages(prev => [...prev, botMessage]);
        setIsTyping(false);
      }, 400);
      return;
    }

    // If both server and FAQ fail, display resilient error card with retry button
    setTimeout(() => {
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: 'चर्च सहायकसँग सम्पर्क हुन सकेन (Unable to reach church assistant). कृपया पुन: प्रयास गर्नुहोस्।',
        isError: true,
        retryQuery: query,
        modelUsed: 'Sugam Church Bot'
      };
      setMessages(prev => [...prev, errorMessage]);
      setIsTyping(false);
    }, 400);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  const handleResetChat = () => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMsgId(null);
    setMessages([
      {
        id: 'welcome',
        sender: 'bot',
        text: 'जयमसीह! (Peace be with you!) Welcome to Sugam Prathana Bhawan. How can I help you today? मलाई सोध्नुहोस् (Ask me anything)!',
        options: [
          'चर्चको स्थान र नक्सा कहाँ छ? (Where is church?)',
          'फेसबुक र युट्युब लिङ्क दिनुहोस् (Facebook & YouTube)',
          'When are the church service times?',
          'What is the youth routine?'
        ]
      }
    ]);
  };

  const isAiOnline = geminiConfig.enabled !== false;

  return (
    <div className="fixed bottom-6 right-6 z-50 no-print font-sans">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#214b60] via-[#285c73] to-[#4b9fb9] text-white flex items-center justify-center shadow-xl shadow-[#285c73]/30 hover:scale-110 active:scale-95 transition-all duration-300 relative group glow-primary"
          aria-label="Open Chatbot Assistant (मलाई सोध्नुहोस्)"
          title="मलाई सोध्नुहोस् • Sugam Church Assistant"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full animate-pulse"></span>
          
          {/* Tooltip on hover */}
          <span className="absolute right-full mr-3 px-3 py-1.5 bg-[#173a4b] text-white text-xs font-semibold rounded-xl whitespace-nowrap shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
            मलाई सोध्नुहोस् • Ask Me Anything
          </span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[94vw] sm:w-[420px] max-w-[420px] h-[590px] max-h-[88vh] bg-white/94 backdrop-blur-2xl rounded-3xl shadow-[0_25px_60px_-15px_rgba(33,75,96,0.22),inset_0_1px_2px_rgba(255,255,255,1)] border border-white/95 flex flex-col overflow-hidden animate-scale-in">
          
          {/* 1. TOP ANIMATED LINE: मलाई सोध्नुहोस् (Malai Sodhnuhos) */}
          <div className="bg-gradient-to-r from-[#173a4b] via-[#214b60] to-[#173a4b] text-white px-3 py-1.5 border-b border-[#285c73]/40 flex items-center justify-between overflow-hidden relative shadow-inner">
            <div className="flex items-center gap-2 overflow-hidden w-full">
              {/* Left glowing animated badge */}
              <div className="flex items-center gap-1.5 shrink-0 bg-gradient-to-r from-amber-400/25 to-amber-500/25 text-amber-300 px-2.5 py-0.5 rounded-full text-[10px] font-bold border border-amber-300/40 shadow-xs animate-pulse">
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>मलाई सोध्नुहोस्</span>
              </div>

              {/* Running marquee animation line */}
              <div className="overflow-hidden relative flex-1 min-w-0">
                <div className="whitespace-nowrap animate-marquee text-[11px] text-[#e4f3f8] font-medium flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    ✨ <strong className="text-white font-bold">मलाई सोध्नुहोस्</strong> — Sugam Church Bot
                  </span>
                  <span className="text-[#7cc5dc]">•</span>
                  <span>स्थान, समय, फेसबुक, युट्युब, सेवा र संगति बारे सोध्नुहोस्</span>
                  <span className="text-[#7cc5dc]">•</span>
                  <span className="text-amber-300 font-semibold">मलाई सोध्नुहोस् • Malai Sodhnuhos</span>
                  <span className="text-[#7cc5dc]">•</span>
                  <span>जयमसीह! Peace be with you</span>
                </div>
              </div>
            </div>
          </div>

          {/* 2. Chat Header */}
          <div className="bg-gradient-to-r from-[#214b60] via-[#285c73] to-[#214b60] p-3.5 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center border border-white/20 shadow-xs">
                  <Bot className="w-5 h-5 text-white" />
                </div>
                <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-400 border-2 border-[#214b60] rounded-full animate-pulse"></span>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-sm leading-tight text-white">
                    Fofu • Church Assistant
                  </h3>
                </div>
                <div className="text-[11px] text-[#dceef5] flex items-center gap-1.5 mt-0.5">
                  <span className="text-amber-200 font-semibold">मलाई सोध्नुहोस् (Ask Fofu)</span>
                  <span className="text-white/40">•</span>
                  <span>{isAiOnline ? 'Online • Verified Church AI' : 'FAQ Mode • Church Assistant'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
                title="Restart chat"
                aria-label="Restart chat"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => {
                  stopListening();
                  setIsOpen(false);
                }}
                className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 3. Messages Container */}
          <div ref={chatScrollContainerRef} className="flex-1 p-3.5 sm:p-4 overflow-y-auto space-y-3 bg-[#f8faf7]">
            {messages.map(msg => {
              const isUser = msg.sender === 'user';
              const { elements, extractedUrls, churchRoutes } = !isUser 
                ? parseRichContent(msg.text) 
                : { elements: [msg.text], extractedUrls: [], churchRoutes: [] };

              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-line shadow-2xs relative group ${
                      isUser
                        ? 'bg-[#285c73] text-white rounded-br-none'
                        : msg.isError
                          ? 'bg-rose-50/90 text-rose-900 border border-rose-200 rounded-bl-none'
                          : 'bg-white text-[#214b60] border border-[#d4e8ee] rounded-bl-none'
                    }`}
                  >
                    {isUser ? (
                      msg.text
                    ) : (
                      <div>
                        {/* Main Response Text with in-line links */}
                        <div className="leading-relaxed">
                          {elements}
                        </div>

                        {/* Retry Button if this response resulted from a connection/service error */}
                        {msg.isError && msg.retryQuery && (
                          <div className="mt-2.5 pt-2 border-t border-rose-200/80">
                            <button
                              type="button"
                              onClick={() => handleSend(msg.retryQuery)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs transition hover:scale-102 active:scale-98"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>पुन: प्रयास गर्नुहोस् (Retry)</span>
                            </button>
                          </div>
                        )}

                        {/* Rich Social Media & Map Preview Cards */}
                        {extractedUrls.length > 0 && !msg.isError && (
                          <div className="mt-2 space-y-2">
                            {extractedUrls.map((url, uIdx) => (
                              <SocialLinkCard key={uIdx} url={url} />
                            ))}
                          </div>
                        )}

                        {/* Quick Internal Route Jump Chips */}
                        {churchRoutes.length > 0 && !msg.isError && (
                          <div className="mt-2.5 pt-2 border-t border-slate-100 flex flex-wrap gap-1.5">
                            {churchRoutes.map((route) => {
                              const info = ROUTE_INFO[route] || { title: route, desc: 'खोल्नुहोस्' };
                              return (
                                <button
                                  key={route}
                                  type="button"
                                  onClick={() => navigate(route)}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#e4f3f8] hover:bg-[#dceef5] text-[#214b60] font-semibold text-[11px] rounded-lg border border-[#d4e8ee] transition shadow-2xs hover:scale-102"
                                >
                                  <span>{info.title}</span>
                                  <ChevronRight className="w-3 h-3 text-[#4b9fb9]" />
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Interactive Database Action Button */}
                        {msg.isDatabaseAction && (
                          <div className="mt-2.5 pt-2 border-t border-slate-200/80">
                            <button
                              type="button"
                              onClick={() => setShowDatabaseModal(true)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#285c73] hover:bg-[#1f4a5c] text-white rounded-xl text-xs font-bold shadow-xs transition hover:scale-102"
                            >
                              <Database className="w-3.5 h-3.5 text-sky-300" />
                              <span>Open Database Manager</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Text-to-speech speaker button on bot responses */}
                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleToggleSpeak(msg.id, msg.text)}
                        className={`absolute -top-2 -right-2 p-1 rounded-full text-xs shadow-xs border transition ${
                          speakingMsgId === msg.id
                            ? 'bg-rose-500 text-white border-rose-600 animate-pulse'
                            : 'bg-white text-slate-400 hover:text-[#285c73] border-[#d4e8ee] opacity-0 group-hover:opacity-100'
                        }`}
                        title={speakingMsgId === msg.id ? 'Stop reading' : 'Read aloud'}
                        aria-label="Read response aloud"
                      >
                        {speakingMsgId === msg.id ? (
                          <VolumeX className="w-3 h-3" />
                        ) : (
                          <Volume2 className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Quick Question Buttons if present on welcome message */}
                  {msg.options && (
                    <div className="mt-2 space-y-1.5 w-full">
                      {msg.options.map((opt, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSend(opt)}
                          className="w-full text-left text-xs p-2.5 rounded-xl bg-white hover:bg-[#e4f3f8] border border-[#d4e8ee] text-[#214b60] font-medium transition flex items-center justify-between group shadow-2xs hover:scale-[1.01]"
                        >
                          <span>{opt}</span>
                          <ChevronDown className="w-3 h-3 -rotate-90 text-[#4b9fb9] group-hover:translate-x-0.5 transition-transform shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {isTyping && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-white border border-[#d4e8ee] w-fit text-xs text-[#285c73] shadow-2xs animate-pulse">
                <Sparkles className="w-3.5 h-3.5 text-[#4b9fb9] animate-spin" />
                <span className="font-medium text-[#52788d]">Sugam Church Bot is typing...</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4b9fb9] animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#285c73] animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#214b60] animate-bounce [animation-delay:0.4s]"></span>
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Voice Listening Real-time Indicator Banner */}
          {isListening && (
            <div className="px-3.5 py-2 bg-gradient-to-r from-rose-50 via-rose-100/70 to-rose-50 border-t border-rose-200 flex items-center justify-between text-xs text-rose-900 animate-fade-in shadow-inner">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-600"></span>
                </span>
                <span className="font-semibold text-[11px] text-rose-950">
                  {speechLang === 'ne-NP' ? 'सुन्दैछ... नेपालीमा बोल्नुहोस्' : 'Listening in English... Speak now'}
                </span>
                <div className="flex items-center gap-0.5 ml-1">
                  <span className="w-1 h-3 bg-rose-500 rounded-full animate-bounce [animation-delay:0.1s]"></span>
                  <span className="w-1 h-4 bg-rose-500 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1 h-2.5 bg-rose-500 rounded-full animate-bounce [animation-delay:0.3s]"></span>
                </div>
              </div>
              <button
                type="button"
                onClick={stopListening}
                className="text-[10px] font-bold text-rose-800 hover:text-white bg-rose-200 hover:bg-rose-600 px-2.5 py-0.5 rounded-lg transition"
              >
                Done
              </button>
            </div>
          )}

          {/* Speech Error Banner */}
          {speechError && (
            <div className="px-3 py-1.5 bg-amber-50 text-[11px] text-amber-900 border-t border-amber-200 flex items-center justify-between">
              <span className="truncate pr-2">{speechError}</span>
              <button
                type="button"
                onClick={() => setSpeechError(null)}
                className="text-amber-700 hover:text-amber-950 font-bold px-1"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-[#d4e8ee] space-y-1.5">
            <div className="flex items-center gap-1.5">
              {/* Language Switcher Pill */}
              <button
                type="button"
                onClick={toggleSpeechLang}
                className="px-2 py-1.5 rounded-xl bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#214b60] text-[10px] font-bold transition flex items-center gap-1 border border-[#d4e8ee] shrink-0"
                title={`Switch Voice Language (Current: ${speechLang === 'ne-NP' ? 'Nepali' : 'English'})`}
                aria-label="Switch Voice Language"
              >
                <Globe className="w-3 h-3 text-[#285c73]" />
                <span>{speechLang === 'ne-NP' ? '🇳🇵 NE' : '🇺🇸 EN'}</span>
              </button>

              {/* Text Input */}
              <input
                type="text"
                aria-label="Ask a question"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  isListening
                    ? (speechLang === 'ne-NP' ? 'नेपालीमा बोल्दै हुनुहुन्छ...' : 'Speaking in English...')
                    : 'मलाई सोध्नुहोस् (Ask Church Assistant)...'
                }
                className={`flex-1 px-3 py-2 bg-[#f8faf7] border rounded-xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#285c73] text-[#214b60] placeholder-[#52788d] transition ${
                  isListening ? 'border-rose-400 bg-rose-50/30' : 'border-[#d4e8ee]'
                }`}
              />

              {/* Microphone Voice-to-Text Button */}
              <button
                type="button"
                onClick={toggleListening}
                className={`p-2 rounded-xl transition flex items-center justify-center shrink-0 ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-md ring-4 ring-rose-400/40 animate-pulse'
                    : 'bg-[#f0f7fa] hover:bg-[#e4f3f8] text-[#285c73]'
                }`}
                title={
                  isListening
                    ? 'Click to stop listening'
                    : `Speak in ${speechLang === 'ne-NP' ? 'Nepali (नेपाली)' : 'English'}`
                }
                aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
              >
                {isListening ? (
                  <MicOff className="w-4 h-4" />
                ) : (
                  <Mic className="w-4 h-4" />
                )}
              </button>

              {/* Send Button */}
              <button
                onClick={() => handleSend()}
                disabled={!inputText.trim() || isTyping}
                className="p-2 bg-[#285c73] hover:bg-[#214b60] disabled:opacity-40 text-white rounded-xl transition shadow-xs flex items-center justify-center shrink-0"
                aria-label="Send message"
                title="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-between text-[10px] text-[#52788d] px-1">
              <span>नेपाली/English मा सोध्नुहोस् • <strong>मलाई सोध्नुहोस्</strong></span>
              <span>Fofu Church Bot</span>
            </div>
          </div>
        </div>
      )}

      {/* Live Database Manager Modal triggered by writing to Fofu */}
      <DatabaseManagerModal
        isOpen={showDatabaseModal}
        onClose={() => setShowDatabaseModal(false)}
      />
    </div>
  );
}
