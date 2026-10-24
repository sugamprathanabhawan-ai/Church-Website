// ==============================================================================
// api/extract-lyrics.js
// Serverless / Backend Handler for Sugam Church AI Lyrics & Song Title Extraction
// Uses Gemini Multimodal Vision API to accurately extract lyrics from uploaded photos/PDFs.
// Automatically detects language (Nepali or English) and generates bidirectional translations.
// Shares the exact same Gemini API key used across the church platform.
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

  const { imageBase64, mimeType = 'image/jpeg', filename = 'song_sheet' } = body || {};

  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'Base64 image or document data is required.' });
  }

  // Sanitize base64 string
  const cleanBase64 = imageBase64.replace(/^data:[^;]+;base64,/, '').trim();
  if (cleanBase64.length === 0) {
    return res.status(400).json({ error: 'Empty base64 data provided.' });
  }

  // 1. Resolve API Key from multiple sources (Passed, Header, Body, Env, Supabase church_settings)
  let apiKey = (passedApiKey || req.headers['x-gemini-key'] || body.apiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

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
    } catch (e) {
      console.warn('[extract-lyrics] church_settings key resolution notice:', e);
    }
  }

  if (!apiKey) {
    return res.status(400).json({
      error: 'Gemini API key is required for AI song extraction. Please enter your Gemini API key in Admin Settings or .env file.',
      requiresApiKey: true,
      title: filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'New Worship Song',
      author: 'Sugam Church Choir',
      key: 'G',
      detectedLanguage: 'Nepali'
    });
  }

  const extractionPrompt = `You are the expert bilingual lyrics transcriber for Sugam Church (सुगम प्रार्थना भवन), a Christian church in Kathmandu, Nepal.
Accurately transcribe the worship song from this uploaded document/photo, detect its language (Nepali or English), and provide a translation into the other language.

CRITICAL RULES:
1. DETECT LANGUAGE:
   - Identify whether the primary lyrics on the page are in "Nepali" (Devanagari or Romanized) or "English".
   - Set "detectedLanguage": "Nepali" or "English".

2. SONG TITLE:
   - Transcribe the exact song title in its original language.
   - Also provide "translatedTitle" in the other language (English if Nepali original, Nepali Devanagari if English original).

3. ZERO HALLUCINATION ACCURACY:
   - Transcribe every lyric line exactly as written on the paper/sheet.
   - Do NOT invent missing lines.
   - Separate chords from lyrics if chords are written above words. Transcribe clean lyric lines.
   - Group lines into logical song sections (e.g. Verse 1, Chorus, Verse 2, Bridge).

4. BIDIRECTIONAL TRANSLATION (Nepali <-> English):
   - If detectedLanguage is "Nepali":
     * Provide an accurate and reverent English translation of the song in "translatedSections" and "translatedRawLyrics".
     * Also provide "romanizedLyrics" (Devanagari written in English letters so youth can read and sing).
   - If detectedLanguage is "English":
     * Provide an accurate and reverent Nepali (Devanagari) translation of the song in "translatedSections" and "translatedRawLyrics".

5. Return ONLY a valid JSON object with NO markdown code fences or backticks:
{
  "title": "Extracted Song Title",
  "translatedTitle": "Translated Title in the other language",
  "author": "Song author or Sugam Church Choir",
  "key": "G",
  "detectedLanguage": "Nepali" or "English",
  "sections": [
    {
      "type": "verse" or "chorus" or "bridge",
      "title": "Verse 1",
      "lines": [
        "Line 1 lyrics",
        "Line 2 lyrics"
      ]
    }
  ],
  "rawLyrics": "Full original lyrics line by line with section headers",
  "translatedSections": [
    {
      "type": "verse" or "chorus" or "bridge",
      "title": "Verse 1",
      "lines": [
        "Translated line 1",
        "Translated line 2"
      ]
    }
  ],
  "translatedRawLyrics": "Full translated lyrics in the other language",
  "romanizedLyrics": "Full Romanized Nepali if original was Nepali",
  "confidence": "high"
}`;

  // Call Gemini multimodal vision API
  const candidateModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-pro',
    'gemini-flash-latest'
  ];

  let lastApiError = null;

  for (const model of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { text: extractionPrompt },
                {
                  inlineData: {
                    mimeType: mimeType.includes('pdf') ? 'application/pdf' : mimeType,
                    data: cleanBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 3000,
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
            // Ensure detectedLanguage defaults sensibly if missing
            if (!parsed.detectedLanguage) {
              const sampleText = parsed.rawLyrics || '';
              const hasDevanagari = /[\u0900-\u097F]/.test(sampleText);
              parsed.detectedLanguage = hasDevanagari ? 'Nepali' : 'English';
            }
            return res.status(200).json(parsed);
          } catch (parseErr) {
            console.warn('[extract-lyrics] JSON parse failed, returning raw text fallback:', parseErr);
            const hasDevanagari = /[\u0900-\u097F]/.test(candidate);
            return res.status(200).json({
              title: filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Extracted Song',
              author: 'Sugam Church Choir',
              key: 'G',
              detectedLanguage: hasDevanagari ? 'Nepali' : 'English',
              rawLyrics: candidate,
              confidence: 'medium'
            });
          }
        }
      } else {
        const errJson = await response.json().catch(() => ({}));
        lastApiError = errJson?.error?.message || `HTTP ${response.status}`;
        console.warn(`[extract-lyrics] Model ${model} returned error status:`, response.status, lastApiError);
      }
    } catch (err) {
      clearTimeout(timeoutId);
      lastApiError = err.message;
      console.warn(`[extract-lyrics] Model ${model} fetch exception:`, err.message);
    }
  }

  // If all models failed, return error with clear diagnostic
  return res.status(502).json({
    error: `AI Vision model error: ${lastApiError || 'Failed to extract lyrics from image'}. Please verify your Gemini API key and image clarity.`,
    title: filename.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'New Worship Song'
  });
}
