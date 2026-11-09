import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  Sparkles, 
  Send, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  Copy, 
  Check, 
  Zap, 
  Clock, 
  HelpCircle,
  Save,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Mic,
  MicOff,
  Globe,
  Key
} from 'lucide-react';
import { 
  askGemini, 
  testGeminiConnection, 
  getStoredGeminiConfig, 
  fetchRemoteGeminiConfig, 
  saveGeminiConfig,
  fetchGeminiKeyStatus,
  saveGeminiApiKey,
  DEFAULT_MODEL, 
  DEFAULT_SYSTEM_PROMPT 
} from '../services/geminiService';

export default function AdminChatbotTab({ showToast }) {
  // Config state - server-side AI configuration
  const [systemPrompt, setSystemPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);

  // Voice to text state
  const [isListening, setIsListening] = useState(false);
  const [speechLang, setSpeechLang] = useState('ne-NP');
  const [speechError, setSpeechError] = useState(null);
  const adminRecRef = useRef(null);
  const baseAdminTextRef = useRef('');

  // Connection testing state
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState(null);

  // Gemini API Key state
  const [keyStatus, setKeyStatus] = useState({ configured: false, maskedKey: null });
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [showKeyInput, setShowKeyInput] = useState(false);

  // Chat interaction state
  const [chatMessages, setChatMessages] = useState([
    {
      id: 'init-bot',
      sender: 'bot',
      text: 'जयमसीह! I am Sugam Prathana Bhawan Assistant running strictly on verified church data.\n\nI answer only what is asked using verified church data, with complete respect and zero discrimination. Ask any question below to test.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: DEFAULT_MODEL
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const chatScrollRef = useRef(null);
  const chatInputRef = useRef(null);

  // Load config on mount
  useEffect(() => {
    const local = getStoredGeminiConfig();
    setSystemPrompt(local.systemPrompt || DEFAULT_SYSTEM_PROMPT);
    setAiEnabled(local.enabled !== false);

    fetchRemoteGeminiConfig().then(cfg => {
      if (cfg) {
        setSystemPrompt(cfg.systemPrompt || DEFAULT_SYSTEM_PROMPT);
        setAiEnabled(cfg.enabled !== false);
      }
    });

    fetchGeminiKeyStatus().then(st => {
      if (st) setKeyStatus(st);
    });
  }, []);

  const handleSaveApiKey = async (e) => {
    if (e) e.preventDefault();
    if (!apiKeyInput.trim()) {
      if (showToast) showToast('Please enter an API key.', 'error');
      return;
    }
    setSavingKey(true);
    try {
      const res = await saveGeminiApiKey(apiKeyInput.trim());
      setKeyStatus({ configured: true, maskedKey: res.maskedKey });
      setShowKeyInput(false);
      setApiKeyInput('');
      if (showToast) showToast('Gemini API key saved! Both Chatbot & Lyrics Book are now active.');
    } catch (err) {
      if (showToast) showToast(err.message || 'Failed to save API key', 'error');
    } finally {
      setSavingKey(false);
    }
  };

  // Cleanup voice recognition on unmount
  useEffect(() => {
    return () => {
      if (adminRecRef.current) {
        try { adminRecRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  const isSpeechSupported = typeof window !== 'undefined' && Boolean(
    window.SpeechRecognition || window.webkitSpeechRecognition
  );

  const startVoiceInput = () => {
    if (!isSpeechSupported) {
      if (showToast) showToast('Voice to text is not supported in this browser (Use Chrome or Edge).', 'error');
      return;
    }

    try {
      if (adminRecRef.current) {
        try { adminRecRef.current.abort(); } catch (e) {}
      }

      const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new SpeechRec();
      rec.lang = speechLang;
      rec.continuous = false;
      rec.interimResults = true;
      rec.maxAlternatives = 1;

      baseAdminTextRef.current = chatInput;

      rec.onstart = () => {
        setIsListening(true);
        setSpeechError(null);
      };

      rec.onresult = (event) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) final += t;
          else interim += t;
        }

        const recognized = (final || interim).trim();
        if (recognized) {
          const prefix = baseAdminTextRef.current.trim();
          setChatInput(prefix ? `${prefix} ${recognized}` : recognized);
        }
      };

      rec.onerror = (event) => {
        if (event.error === 'not-allowed') {
          setSpeechError('Microphone permission blocked.');
        } else if (event.error !== 'no-speech') {
          setSpeechError(`Voice error: ${event.error}`);
        }
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      adminRecRef.current = rec;
      rec.start();
    } catch (err) {
      console.warn('Speech error:', err);
      setIsListening(false);
    }
  };

  const stopVoiceInput = () => {
    if (adminRecRef.current) {
      try { adminRecRef.current.stop(); } catch (e) {}
    }
    setIsListening(false);
  };

  const toggleVoiceInput = () => {
    if (isListening) stopVoiceInput();
    else startVoiceInput();
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, isAsking]);

  // Handle saving configuration
  const handleSaveSettings = async (e) => {
    if (e) e.preventDefault();
    setSavingConfig(true);

    try {
      const saved = await saveGeminiConfig({
        systemPrompt,
        enabled: aiEnabled
      });

      if (!saved) {
        throw new Error('Remote database persistence could not be verified.');
      }

      if (showToast) {
        showToast('Chatbot settings saved successfully!', 'success');
      }
      setTestResult(null);
    } catch (err) {
      if (showToast) {
        showToast(`Failed to save settings: ${err.message || 'Unknown persistence error'}`, 'error');
      }
    } finally {
      setSavingConfig(false);
    }
  };

  // Test API connection
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setTestResult(null);

    const result = await testGeminiConnection();
    setTestingConnection(false);
    setTestResult(result);

    if (result.success && showToast) {
      showToast(`Connected to Sugam Church Bot! (${result.latency}ms)`, 'success');
    }
  };

  // Send message to Sugam Church Bot
  const handleSendMessage = async (textToSend) => {
    const query = (textToSend || chatInput).trim();
    if (!query || isAsking) return;

    if (isListening) {
      stopVoiceInput();
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setIsAsking(true);

    const startTime = performance.now();
    try {
      const response = await askGemini({
        prompt: query,
        history: chatMessages
      });

      const latencyMs = Math.round(performance.now() - startTime);

      const botMsg = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: response.text,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: DEFAULT_MODEL,
        latency: latencyMs
      };

      setChatMessages(prev => [...prev, botMsg]);
    } catch (err) {
      const latencyMs = Math.round(performance.now() - startTime);
      const errorMsg = {
        id: `err-${Date.now()}`,
        sender: 'bot',
        isError: true,
        text: `⚠️ Chatbot Error: ${err.message}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        latency: latencyMs
      };
      setChatMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopyText = (id, text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    setChatMessages([
      {
        id: 'init-bot',
        sender: 'bot',
        text: `जयमसीह! Chat history cleared. Ask any church question to test ${DEFAULT_MODEL}.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: DEFAULT_MODEL
      }
    ]);
  };

  const sampleQuestions = [
    'Who is the youth leader and who are the team captains?',
    'What is the youth routine on Ashoj 10?',
    'Who are the members of Yakub team?',
    'When is Christmas carol choir practice?',
    'What are the current youth notices from the database?'
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-sky-950 via-slate-900 to-sky-900 rounded-3xl p-6 sm:p-7 text-white shadow-md border border-sky-800/60 flex flex-wrap items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 uppercase tracking-wider">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Exclusive Model: {DEFAULT_MODEL}
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-sky-500/20 text-sky-200 border border-sky-400/20">
              <ShieldCheck className="w-3.5 h-3.5 text-sky-400" />
              Strict Church Data Only
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Server Architecture Active
            </span>
          </div>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-white">
            Church Chatbot Console ({DEFAULT_MODEL})
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Direct question-answering powered by <strong>Sugam Church Bot</strong>. The model answers only what is asked using verified church facts and schedules, summarizing in 1-2 lines with zero preachiness or outside tangents, and strictly maintains peace with zero disrespect or hatred towards any religion or deity.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition hover:scale-[1.02] active:scale-95"
          >
            <Zap className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
            <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Chatbot Interactive Console (Left 7 Cols) & Settings (Right 5 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* ============================================================== */}
        {/* LEFT COLUMN: CHATBOT TEXT BOX & CONSOLE (7 COLS)               */}
        {/* ============================================================== */}
        <div className="lg:col-span-7 flex flex-col bg-white rounded-3xl border border-sky-100 shadow-sm overflow-hidden h-[760px]">
          
          {/* Header */}
          <div className="p-4 bg-slate-50/90 border-b border-sky-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-sky-500 text-white flex items-center justify-center shadow-xs">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                  <span>Chatbot Text Box &amp; Live Console</span>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                </h3>
                <p className="text-[11px] text-slate-500 flex items-center gap-2">
                  <span className="font-mono text-sky-700 font-semibold">{DEFAULT_MODEL}</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleClearChat}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-xl transition text-xs font-medium flex items-center gap-1"
              title="Clear conversation"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>

          {/* Messages Display Area */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-slate-50/30">
            {chatMessages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-2 mb-1 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {msg.sender === 'user' ? 'Questioner' : 'Sugam Church Bot'}
                  </span>
                  <span className="text-[10px] text-slate-400">{msg.timestamp}</span>
                  {msg.latency && (
                    <span className="text-[10px] text-emerald-600 font-mono">
                      {msg.latency}ms
                    </span>
                  )}
                </div>

                <div
                  className={`max-w-[90%] sm:max-w-[85%] p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap relative group shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-xs'
                      : msg.isError
                      ? 'bg-rose-50 text-rose-800 border border-rose-200 rounded-bl-xs'
                      : 'bg-white text-slate-800 border border-sky-100 rounded-bl-xs'
                  }`}
                >
                  {msg.text}

                  {msg.sender === 'bot' && !msg.isError && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {isAsking && (
              <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-white border border-sky-100 w-fit text-xs text-sky-800 shadow-2xs animate-pulse">
                <Sparkles className="w-4 h-4 text-sky-500 animate-spin" />
                <span className="font-semibold text-slate-600">Sugam Church Bot is typing...</span>
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-bounce [animation-delay:0.4s]"></span>
                </span>
              </div>
            )}
            <div ref={chatScrollRef} />
          </div>

          {/* Quick Question Chips */}
          <div className="p-3 bg-slate-50/70 border-t border-sky-100">
            <p className="text-[11px] font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
              <HelpCircle className="w-3 h-3 text-sky-600" />
              <span>Test Questions:</span>
            </p>
            <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(q)}
                  disabled={isAsking}
                  className="text-left text-[11px] px-3 py-1.5 rounded-xl bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-800 border border-sky-100 transition truncate max-w-full font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
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
                onClick={stopVoiceInput}
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

          {/* THE CHATBOT TEXT BOX FOOTER */}
          <div className="p-4 bg-white border-t border-sky-100">
            <div className="relative flex items-end gap-2 bg-slate-50 border border-sky-200 rounded-2xl p-2 focus-within:border-sky-500 focus-within:ring-2 focus-within:ring-sky-200 transition">
              {/* Language Switcher Pill */}
              <button
                type="button"
                onClick={() => setSpeechLang(speechLang === 'ne-NP' ? 'en-US' : 'ne-NP')}
                className="px-2 py-2 rounded-xl bg-white hover:bg-sky-50 text-slate-700 hover:text-sky-700 text-[11px] font-bold transition flex items-center gap-1 border border-slate-200 shrink-0 self-center"
                title={`Switch Voice Language (Current: ${speechLang === 'ne-NP' ? 'Nepali' : 'English'})`}
                aria-label="Switch Voice Language"
              >
                <Globe className="w-3.5 h-3.5 text-sky-600" />
                <span>{speechLang === 'ne-NP' ? '🇳🇵 NE' : '🇺🇸 EN'}</span>
              </button>

              <textarea
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder={
                  isListening
                    ? (speechLang === 'ne-NP' ? 'नेपालीमा बोल्दै हुनुहुन्छ...' : 'Speaking in English...')
                    : 'Ask a church question to Sugam Church Bot or tap mic...'
                }
                className="flex-1 bg-transparent border-0 resize-none text-xs sm:text-sm text-slate-800 focus:outline-none p-1.5 placeholder:text-slate-400 max-h-28 overflow-y-auto"
              />

              {/* Voice-to-Text Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`p-3 rounded-xl transition shrink-0 flex items-center justify-center ${
                  isListening
                    ? 'bg-rose-600 text-white shadow-md ring-4 ring-rose-400/40 animate-pulse'
                    : 'bg-white hover:bg-sky-100 text-slate-600 hover:text-sky-700 border border-slate-200'
                }`}
                title={
                  isListening
                    ? 'Click to stop listening'
                    : `Speak in ${speechLang === 'ne-NP' ? 'Nepali' : 'English'}`
                }
                aria-label="Voice input"
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => handleSendMessage()}
                disabled={!chatInput.trim() || isAsking}
                className="p-3 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-xl shadow-md transition hover:scale-105 active:scale-95 shrink-0 flex items-center justify-center"
                title={`Send question to ${DEFAULT_MODEL}`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 px-1 mt-2">
              <span>Model: <strong className="font-mono text-slate-600">{DEFAULT_MODEL}</strong> • Mic: <strong>{speechLang === 'ne-NP' ? 'Nepali 🇳🇵' : 'English 🇺🇸'}</strong></span>
              <span>Press <strong>Enter</strong> to send</span>
            </div>
          </div>
        </div>

        {/* ============================================================== */}
        {/* RIGHT COLUMN: CONFIGURATION & STRICT DATA SETTINGS (5 COLS)     */}
        {/* ============================================================== */}
        <div className="lg:col-span-5 space-y-6">

          {/* Server-Side AI Configuration Form */}
          <form onSubmit={handleSaveSettings} className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Server-Side Chatbot Configuration</h3>
                  <p className="text-[11px] text-slate-500">Sole Model: {DEFAULT_MODEL}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                <span className="text-[11px] font-semibold text-slate-600">
                  {aiEnabled ? 'AI Active' : 'AI Disabled'}
                </span>
              </div>
            </div>

            {/* AI Enable/Disable Switch */}
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <label htmlFor="ai-enabled-toggle" className="text-xs font-bold text-slate-800 block cursor-pointer">
                  Enable AI Assistant
                </label>
                <p className="text-[11px] text-slate-500">
                  When enabled, queries route to serverless AI. When disabled, falls back directly to verified church FAQs.
                </p>
              </div>
              <button
                id="ai-enabled-toggle"
                type="button"
                role="switch"
                aria-checked={aiEnabled}
                onClick={() => setAiEnabled(!aiEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-sky-500 ${
                  aiEnabled ? 'bg-sky-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    aiEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Server-Side Credentials Info */}
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold text-emerald-950">Secure Server-Side Architecture</p>
                  <p className="text-[11px] text-emerald-800 leading-relaxed mt-0.5">
                    Gemini API credentials are maintained exclusively in server environment variables (<code>GEMINI_API_KEY</code>). Client storage and bundles never hold API keys.
                  </p>
                </div>
              </div>
            </div>

            {/* Strict Guardrails Notice */}
            <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1">
              <p className="text-xs font-bold flex items-center gap-1.5 text-amber-900">
                <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Strict Guardrails Enforced</span>
              </p>
              <ul className="text-[11px] list-disc list-inside space-y-0.5 text-amber-900/90">
                <li>Answers strictly what the user asked and nothing more (1-2 lines).</li>
                <li>Uses only verified church data; never speculates or fabricates.</li>
                <li>No hate, disrespect, or disparagement of any other religion or god.</li>
              </ul>
            </div>

            {/* Connection Test Result Feedback */}
            {testResult && (
              <div className={`p-3.5 rounded-2xl text-xs border flex items-start gap-2.5 animate-fade-in ${
                testResult.success 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                  : 'bg-rose-50 border-rose-200 text-rose-900'
              }`}>
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="font-bold">
                    {testResult.success ? 'Sugam Bot Connected!' : 'Connection Failed'}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-relaxed">
                    {testResult.success 
                      ? `Latency: ${testResult.latency}ms • Reply: "${testResult.reply}"`
                      : testResult.error
                    }
                  </p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection}
                className="px-4 py-2.5 rounded-xl border border-sky-200 hover:bg-sky-50 text-sky-700 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Zap className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                <span>{testingConnection ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="submit"
                disabled={savingConfig}
                className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-xl text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-2 hover:scale-[1.02]"
              >
                <Save className={`w-4 h-4 ${savingConfig ? 'animate-spin' : ''}`} />
                <span>{savingConfig ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </form>

          {/* System Prompt & Church Knowledge Base Editor */}
          <div className="bg-white rounded-3xl p-6 border border-sky-100 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Church Data &amp; Constraints Prompt</h4>
                <p className="text-[11px] text-slate-500">Strict rules &amp; verified facts supplied to {DEFAULT_MODEL}</p>
              </div>

              <button
                type="button"
                onClick={() => setSystemPrompt(DEFAULT_SYSTEM_PROMPT)}
                className="text-[11px] text-slate-500 hover:text-sky-700 font-semibold"
                title="Restore default church prompt"
              >
                Reset Default
              </button>
            </div>

            <div>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={8}
                className="w-full p-3 bg-slate-50 border border-sky-100 rounded-xl text-xs text-slate-700 font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveSettings}
                disabled={savingConfig}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Prompt</span>
              </button>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
