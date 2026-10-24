// ==============================================================================
// api/translate-lyrics.js
// Serverless / Backend Handler for Sugam Church Worship Song Translation
// Translates lyrics between Nepali (Devanagari/Romanized) and English while
// strictly preserving line breaks, song sections (Verse, Chorus, Bridge), and meaning.
// ==============================================================================

export default async function handler(req, res, passedApiKey = null) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-gemini-key');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed. Only POST is accepted.' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
  }

  const { text, targetLanguage = 'English', sourceLanguage = 'Nepali', title = '' } = body || {};

  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Song lyrics text is required for translation.' });
  }

  // Resolve API Key
  let apiKey = (passedApiKey || req.headers['x-gemini-key'] || body.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

  // If key not found in env, attempt to read from Supabase church_settings
  if (!apiKey) {
    try {
      const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aiufpdabglxhojmmkedp.supabase.co';
      const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB';
      const sbRes = await fetch(`${supabaseUrl}/rest/v1/church_settings?key=in.(gemini_ai_config,gemini_api_key)&select=key,value`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      if (sbRes.ok) {
        const rows = await sbRes.json();
        for (const row of rows) {
          if (row.key === 'gemini_api_key' && typeof row.value === 'string' && row.value.trim()) {
            apiKey = row.value.trim();
            break;
          }
          if (row.key === 'gemini_ai_config' && row.value?.apiKey && typeof row.value.apiKey === 'string') {
            apiKey = row.value.apiKey.trim();
            break;
          }
        }
      }
    } catch {}
  }

  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API key is required for AI translation. Please configure your key in Admin Settings.',
      requiresApiKey: true
    });
  }

  const targetLangClean = targetLanguage.toLowerCase().includes('nepal') ? 'Nepali' : 'English';
  const sourceLangClean = targetLangClean === 'Nepali' ? 'English' : 'Nepali';

  const translationPrompt = `You are an expert translator specializing in Christian worship songs for Sugam Church (सुगम प्रार्थना भवन).
Translate the following song lyrics from ${sourceLangClean} to ${targetLangClean}.

CRITICAL REQUIREMENTS:
1. Preserve exact line structure: Each translated line must correspond to its original line.
2. Preserve section headers: Keep bracketed headers like [Verse 1], [Chorus], [Bridge], [Outro] untouched.
3. For ${targetLangClean === 'Nepali' ? 'Nepali translation' : 'English translation'}:
   - Translate faithfully, with poetic reverence and Christian worship context.
   - Use natural and reverent vocabulary suitable for church singing.
4. If a song title was provided ("${title}"), translate the title into ${targetLangClean} as well.
5. Return ONLY a valid JSON object matching this schema with NO markdown fences:
{
  "translatedTitle": "Translated Song Title in ${targetLangClean}",
  "targetLanguage": "${targetLangClean}",
  "translatedLyrics": "Full line-by-line translated lyrics preserving section headers and blank lines",
  "notes": "Brief notes on poetic translation if any"
}

ORIGINAL SONG LYRICS TO TRANSLATE:
${text.trim()}`;

  const candidateModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-flash-latest'
  ];

  let lastError = null;

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: translationPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 2500,
            responseMimeType: 'application/json'
          }
        })
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const candidate = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (candidate) {
          const cleanJson = candidate.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
          try {
            const parsed = JSON.parse(cleanJson);
            return res.status(200).json(parsed);
          } catch (parseErr) {
            return res.status(200).json({
              translatedTitle: title,
              targetLanguage: targetLangClean,
              translatedLyrics: candidate
            });
          }
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastError = errJson?.error?.message || `HTTP ${response.status}`;
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err.message;
    }
  }

  return res.status(500).json({
    error: `Translation service failed: ${lastError || 'All AI model candidates failed'}`
  });
}
