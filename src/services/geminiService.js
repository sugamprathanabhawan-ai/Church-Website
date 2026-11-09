import { supabase } from '../lib/supabase';

// Local storage keys (non-sensitive only)
const STORAGE_KEY_MODEL = 'sugam_gemini_model';
const STORAGE_KEY_SYSTEM_PROMPT = 'sugam_gemini_system_prompt';
const STORAGE_KEY_ENABLED = 'sugam_gemini_enabled';

export const DEFAULT_MODEL = 'Sugam Church Bot';

export const AVAILABLE_MODELS = [
  { id: 'sugam-church-bot', name: 'Sugam Church Bot', speed: 'Fast', freeTier: true }
];

export const DEFAULT_SYSTEM_PROMPT = `You are the official church assistant for Sugam Prathana Bhawan (सुगम प्रार्थना भवन), located in Kathmandu, Nepal.

CRITICAL ANSWERING RULES (MUST STRICTLY FOLLOW):
1. CONCISE & SUMMARIZED (1-2 LINES ONLY):
• Answer ONLY what the user is asking. Do not send everything.
• Keep your entire reply strictly within 1 to 2 clear, warm sentences. Summarize cleanly and conclude as soon as the answer is conveyed.
• The output must NEVER be verbose or dump raw database rows.

2. READ, REWRITE & SYNTHESIZE (NEVER SEND RAW DATA):
• Synthesize all background details into a direct, friendly 1-2 line answer.
• Answer in Nepali or English depending on the language the user asked in.

3. STRICT CHURCH TRUTH ONLY:
• Answer strictly based on verified church facts.
• ZERO HATE OR DISRESPECT: Never hate, judge, mock, or criticize any other religion, faith, god, deity, tradition, or community. Maintain pure respect and Christian love.

4. OUT-OF-BOUNDS QUESTIONS:
• If the question is completely unrelated to the church or Christian faith, answer in 1 sentence:
"I can only provide information for Sugam Prathana Bhawan. For other inquiries, please contact sugamprathanabhawan@gmail.com."

5. CLICKABLE LINKS & WEBSITE ROUTES (WHEN RELEVANT):
• Location/Map questions: https://maps.app.goo.gl/JccnzNUZQzF47xp6A
• Official YouTube/Songs: https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ
• Official Facebook: https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr
• Website pages: mention /youth for youth routines/groups, /choir for choir & songs, /quiz for bible quiz, /laws for church constitution & rules, /calendar for calendar, /zensync for live display sync.

VERIFIED CHURCH KNOWLEDGE BASE:
• Church Name: Sugam Prathana Bhawan (सुगम प्रार्थना भवन), Kathmandu, Nepal.
• Denomination: Protestant Christian (Trinity / त्रिएक परमेश्वर - पिता, पुत्र, र पवित्र आत्मा / Father, Son, Holy Spirit).
• Greeting: जयमसीह! (Jayamasih! / Peace be with you!).
• Leadership Directory:
  - Senior Pastor: किरण थापा (Kiran Thapa)
  - Co-Pastor: दीपक थापा (Deepak Thapa)
  - Elder: नरेश राई (Naresh Rai)
  - Deacons (डिकनहरू): खड्क चौधरी (Khadka Chaudhary), बिलास पोख्रेल (Bilas Pokhrel), नरेन राई (Naren Rai), मान बहादुर श्रेष्ठ (Maan Bahadur Shrestha), स्टीफन तामाङ (Stephen Tamang)
  - Youth Leader: आर्यन राई (Aryan Rai)
  - Youth Captain: सारा पौडेल (Sara Poudel - Patrus Captain)
  - Fellowship Leaders: सुरज पोख्रेल (Suraj Pokhrel - Yakub), उर्मिला चौधरी (Urmila Chaudhary - Yahunna)
  - Worship Leaders (आराधकहरू): ममता राई (Mamta Rai), सृष्टि खड्का (Sristi Khadka)
• Service Timings & Ministries:
  - Saturday Main Worship (मुख्य आराधना): Every Saturday 11:00 AM – 1:00 PM (worship, prayer, sermon in Nepali).
  - Youth Fellowship (जवान संगति): Saturday 1:00 PM – 2:30/3:00 PM (regular 12:30 PM – 1:00 PM; 2nd Saturday 2:00 PM – 3:00 PM). Page: /youth
  - Choir Practice (गायक मण्डली): Saturday morning 9:40 AM – 10:40 AM (Special practice: 9:00 AM – 10:50 AM). Page: /choir
  - Fasting & Prayer (उपवास प्रार्थना): Tuesday & Friday mornings.
  - House Fellowship (घर संगति / क्षेत्रिय संगति): Weekly neighborhood prayer and Bible study.
  - Outreach & Mission: Monthly community outreach sharing the Gospel across Nepal.
  - Sunday School & Children Ministry: Bible teaching and fellowship for children.
  - Mothers' Prayer Fellowship & Women's Ministry: Weekly prayer and mutual encouragement.
• Youth Groups:
  - Patrus: Captain Sara Poudel, members (Ishika, Onisimas, Yushan, bachan, Saprina, parina, janvi, rebika).
  - Yakub: Captain Suraj Pokhrel, members (mamata, Ruben, puja rai, suresh, Safal, utsav, rojina, khum bahadur).
  - Yahunna: Captain Urmila Chaudhary, members (Puja majhi, sushila, shristi, pawan majhi, sanjita, namuna).
• Worship Songs Library:
  - Songs include: Yogya Kewal, Jiwanko Swami, Swargama Tapai Bahek, Mero Yeshu Muktidata, Tapai Jastai Kohi, Yeshu Jivit, Bhagera Kaha Jau Ma, Ma Sadhai Tapaiko Stuti, Tapai Prabhu Sab, Ammai Ajha Hamro, Sunsan Raatma, Paramprabhulai Hos Mahima, Yeshu Sarwottam Nau Xa, Jasko Hridaya, Yeshuko Naulai Uchalau, Gotha Gaiko. View all at /choir.
• Church Laws & Guidelines (/laws):
  - Sugam Choir Laws, Youth Fellowship Laws, Aradhana Laws & Guidelines, Sugam Media Laws, Carol Celebration Rules, Baptism Process & Doctrine, Choir User Guide.
• Bible Quiz (/quiz):
  - Interactive Bible quiz with 150 questions, streaks, and community leaderboard.
• Worship Calendar (/calendar):
  - Annual worship schedule, feast days, and fasting prayer dates.
• ZenSync Live Presentation (/zensync):
  - Screen projection & lyric display synchronization tool.
• Contact:
  - Email: sugamprathanabhawan@gmail.com
  - Map: https://maps.app.goo.gl/JccnzNUZQzF47xp6A
  - Facebook: https://www.facebook.com/share/19AMMJ1ini/?mibextid=wwXIfr
  - YouTube: https://youtube.com/@sugamchurchmedia?si=JCEBJlGDN92HzGJJ`;

/**
 * Get current Gemini configuration stored locally (non-sensitive).
 */
export function getStoredGeminiConfig() {
  let localPrompt = localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT);

  if (!localPrompt || !localPrompt.includes('CONCISE & SUMMARIZED')) {
    localPrompt = DEFAULT_SYSTEM_PROMPT;
    localStorage.setItem(STORAGE_KEY_SYSTEM_PROMPT, DEFAULT_SYSTEM_PROMPT);
  }

  const localEnabled = localStorage.getItem(STORAGE_KEY_ENABLED) !== 'false';

  return {
    model: DEFAULT_MODEL,
    systemPrompt: localPrompt,
    enabled: localEnabled
  };
}

/**
 * Fetch non-sensitive Gemini configuration from Supabase church_settings table.
 */
export async function fetchRemoteGeminiConfig() {
  try {
    const { data, error } = await supabase
      .from('church_settings')
      .select('value')
      .eq('key', 'gemini_ai_config')
      .maybeSingle();

    if (error) {
      console.warn('[GeminiService] Could not fetch remote config from Supabase:', error.message);
      return getStoredGeminiConfig();
    }

    if (data && data.value) {
      const remote = data.value;
      let effectivePrompt = remote.systemPrompt || localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT) || DEFAULT_SYSTEM_PROMPT;
      if (!effectivePrompt || !effectivePrompt.includes('CONCISE & SUMMARIZED')) {
        effectivePrompt = DEFAULT_SYSTEM_PROMPT;
      }

      return {
        model: DEFAULT_MODEL,
        systemPrompt: effectivePrompt,
        enabled: remote.enabled !== undefined ? remote.enabled : true
      };
    }
  } catch (err) {
    console.warn('[GeminiService] Remote config error:', err);
  }

  return getStoredGeminiConfig();
}

/**
 * Save non-sensitive Gemini configuration to Supabase church_settings and localStorage.
 * Throws an error if remote database persistence fails.
 * Never writes API keys or secrets to database or client storage.
 */
export async function saveGeminiConfig({ systemPrompt, enabled = true }) {
  if (!supabase) {
    throw new Error('Supabase client is unavailable');
  }

  const cleanPrompt = systemPrompt !== undefined && systemPrompt !== null ? systemPrompt : DEFAULT_SYSTEM_PROMPT;

  const payload = {
    model: DEFAULT_MODEL,
    systemPrompt: cleanPrompt,
    enabled: Boolean(enabled),
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('church_settings')
    .upsert({
      key: 'gemini_ai_config',
      value: payload,
      updated_at: new Date().toISOString()
    }, { onConflict: 'key' })
    .select();

  if (error) {
    console.error('[GeminiService] Could not persist config to Supabase church_settings:', error.message);
    throw new Error(error.message || 'Failed to persist chatbot configuration to church database');
  }

  if (!data || data.length === 0) {
    throw new Error('Chatbot configuration could not be persisted. Please verify administrator authorization.');
  }

  // Only update local cache upon confirmed remote persistence
  localStorage.setItem(STORAGE_KEY_MODEL, DEFAULT_MODEL);
  localStorage.setItem(STORAGE_KEY_SYSTEM_PROMPT, cleanPrompt);
  localStorage.setItem(STORAGE_KEY_ENABLED, String(enabled));

  return { model: DEFAULT_MODEL, systemPrompt: cleanPrompt, enabled };
}

/**
 * Execute chat query via server endpoint POST /api/chat.
 * Gemini API keys are held exclusively on the server.
 */
export async function askGemini({
  prompt,
  history = []
}) {
  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new Error('Please enter a question or message.');
  }

  const cleanPrompt = prompt.trim();
  if (cleanPrompt.length > 500) {
    throw new Error('Message is too long. Please shorten your question to under 500 characters.');
  }

  // Format history (max 6 recent turns)
  const safeHistory = [];
  if (Array.isArray(history)) {
    const recent = history.slice(-6);
    for (const h of recent) {
      if (!h || (!h.text && !h.content)) continue;
      safeHistory.push({
        sender: h.sender === 'user' ? 'user' : 'bot',
        text: (h.text || h.content || '').slice(0, 500)
      });
    }
  }

  const controller = new AbortController();
  const clientTimeout = setTimeout(() => controller.abort(), 12000);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      signal: controller.signal,
      body: JSON.stringify({
        message: cleanPrompt,
        history: safeHistory
      })
    });

    clearTimeout(clientTimeout);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      const errorMsg = errData.error || `Server error (${res.status})`;
      const err = new Error(errorMsg);
      err.status = res.status;
      throw err;
    }

    const data = await res.json();
    if (!data || !data.reply) {
      throw new Error('Sugam Church Bot received an empty answer. Please try rephrasing.');
    }

    return {
      text: data.reply.trim(),
      modelUsed: 'Sugam Church Bot'
    };
  } catch (err) {
    clearTimeout(clientTimeout);

    if (err.name === 'AbortError') {
      const timeoutErr = new Error('Sugam Church Bot took too long to respond (timeout). Please try again.');
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }

    throw err;
  }
}

/**
 * Test server-side connection via /api/chat.
 */
export async function testGeminiConnection() {
  try {
    const startTime = performance.now();
    const result = await askGemini({
      prompt: 'Hello, please confirm connection in 1 line.'
    });
    const latency = Math.round(performance.now() - startTime);

    return {
      success: true,
      latency,
      modelUsed: 'Sugam Church Bot',
      reply: result.text
    };
  } catch (err) {
    return {
      success: false,
      error: err.message || 'Connection test failed'
    };
  }
}

/**
 * Check if server has Gemini API key configured
 */
export async function fetchGeminiKeyStatus() {
  try {
    const res = await fetch('/api/gemini-config');
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[GeminiService] Failed to fetch key status:', err);
  }
  return { configured: false, maskedKey: null };
}

/**
 * Save Gemini API Key securely on the server and update Supabase
 */
export async function saveGeminiApiKey(apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Please enter a valid Gemini API key.');
  }
  const cleanKey = apiKey.trim();
  const res = await fetch('/api/gemini-config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: cleanKey })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(errData.error || 'Failed to save Gemini API key.');
  }

  // Also persist to Supabase church_settings if possible
  try {
    await supabase
      .from('church_settings')
      .upsert({
        key: 'gemini_api_key',
        value: cleanKey,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });
  } catch (e) {
    console.warn('[GeminiService] Remote persistence note:', e);
  }

  return await res.json();
}

/**
 * Translate worship song lyrics between Nepali and English
 */
export async function translateWorshipLyrics({ text, targetLanguage = 'English', sourceLanguage = 'Nepali', title = '' }) {
  if (!text || !text.trim()) {
    throw new Error('Lyrics text is required for translation.');
  }

  const res = await fetch('/api/translate-lyrics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: text.trim(),
      targetLanguage,
      sourceLanguage,
      title
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to translate song lyrics.');
  }

  return await res.json();
}
