import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, ChevronDown } from 'lucide-react';
import { fetchFaqs } from '../services/supabaseService';

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      sender: 'bot',
      text: 'जयमसीह! (Peace be with you!) Welcome to Sugam Prathana Bhawan. How can I help you today?',
      options: ['When are the church service times?', 'What is the youth routine?', 'Where is the church located?']
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [faqData, setFaqData] = useState([]);
  const messagesEndRef = useRef(null);

  // Load FAQ from Supabase database
  useEffect(() => {
    fetchFaqs()
      .then(faqs => {
        if (faqs && faqs.length > 0) {
          setFaqData(faqs);
        } else {
          // Fallback FAQs if empty
          setFaqData([
            {
              keywords: ['service', 'time', 'saturday', 'worship', 'start', 'timing'],
              question: 'When are the church service times?',
              answer: 'Main worship service is held every Saturday at 11:00 AM to 1:00 PM. Youth fellowship follows shortly after at 1:00 PM.'
            },
            {
              keywords: ['location', 'where', 'address', 'directions', 'place'],
              question: 'Where is the church located?',
              answer: 'Sugam Prathana Bhawan is located in Kathmandu, Nepal. You can find directions using the interactive map on our home page.'
            },
            {
              keywords: ['youth', 'routine', 'fellowship', 'sangati'],
              question: 'What is the youth routine?',
              answer: 'You can check the complete youth schedule, teams, and captains under the Youth section from the top menu.'
            },
            {
              keywords: ['choir', 'practice', 'songs', 'music'],
              question: 'What is the choir routine?',
              answer: 'Choir practice is held every Saturday morning. You can check the choir routine and listen to worship songs in the Choir section.'
            },
            {
              keywords: ['contact', 'pastor', 'phone', 'email'],
              question: 'How can I contact the church?',
              answer: 'You can reach us by email at sugamprathanabhawan@gmail.com or visit our church in Kathmandu.'
            }
          ]);
        }
      })
      .catch(err => {
        console.warn('FAQ load warning:', err);
      });
  }, []);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isTyping, isOpen]);

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
      return 'जयमसीह! (Jayamasih!) How can I assist you with church routines, services, or ministries today?';
    }

    return 'Thank you for asking! For specific inquiries, feel free to visit us during Saturday service or reach out to our team at sugamprathanabhawan@gmail.com.';
  };

  const handleSend = (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;

    const userMessage = {
      id: Date.now().toString(),
      sender: 'user',
      text: query
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);

    setTimeout(() => {
      const answer = findBestAnswer(query);
      const botMessage = {
        id: (Date.now() + 1).toString(),
        sender: 'bot',
        text: answer
      };
      setMessages(prev => [...prev, botMessage]);
      setIsTyping(false);
    }, 600);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSend();
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 no-print">
      {/* Floating Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-sky-600 to-sky-400 text-white flex items-center justify-center shadow-xl shadow-sky-600/30 hover:scale-110 active:scale-95 transition-all duration-300 relative group glow-primary"
          aria-label="Open Chatbot Assistant"
        >
          <MessageCircle className="w-6 h-6" />
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="w-[90vw] max-w-[360px] h-[500px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-sky-100 flex flex-col overflow-hidden animate-scale-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-sky-700 to-sky-600 p-4 text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-white/20 flex items-center justify-center border border-white/20">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-none flex items-center gap-1.5">
                  <span>Church Assistant</span>
                  <Sparkles className="w-3 h-3 text-amber-300" />
                </h3>
                <span className="text-[11px] text-sky-200 flex items-center gap-1 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Online • Sugam Prathana
                </span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1.5 rounded-xl hover:bg-white/20 text-white transition-colors"
              aria-label="Close chat"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Container */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-slate-50/50">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-2xs ${
                    msg.sender === 'user'
                      ? 'bg-sky-600 text-white rounded-br-none'
                      : 'bg-white text-slate-800 border border-sky-100 rounded-bl-none'
                  }`}
                >
                  {msg.text}
                </div>

                {/* Quick Question Buttons if present */}
                {msg.options && (
                  <div className="mt-2 space-y-1.5 w-full">
                    {msg.options.map((opt, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSend(opt)}
                        className="w-full text-left text-xs p-2 rounded-xl bg-white hover:bg-sky-50 border border-sky-100 text-sky-700 font-medium transition flex items-center justify-between group"
                      >
                        <span>{opt}</span>
                        <ChevronDown className="w-3 h-3 -rotate-90 text-sky-400 group-hover:translate-x-0.5 transition-transform" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-1.5 p-3 rounded-2xl bg-white border border-sky-100 w-fit text-xs text-slate-400 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-bounce"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:0.2s]"></span>
                <span className="w-1.5 h-1.5 rounded-full bg-sky-600 animate-bounce [animation-delay:0.4s]"></span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white border-t border-sky-100 flex items-center gap-2">
            <input
              type="text"
              aria-label="Ask a question"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question..."
              className="flex-1 px-3.5 py-2.5 bg-slate-50 border border-sky-100 rounded-2xl text-xs sm:text-sm focus:outline-none focus:bg-white focus:border-sky-400 text-slate-800 transition"
            />
            <button
              onClick={() => handleSend()}
              disabled={!inputText.trim()}
              className="p-2.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white rounded-2xl transition shadow-xs"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
