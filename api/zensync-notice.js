// api/zensync-notice.js
// Serverless handler for generating live church presentation notices using Gemini 3.1 Flash Lite

export default async function handler(req, res, apiKeyOverride) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  const { currentNotes, previousNotes } = req.body || {};

  if (!currentNotes || (!currentNotes.heading && !currentNotes.body)) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Note content is required' }));
    return;
  }

  const apiKey = apiKeyOverride || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';

  const prompt = `The main presenter at church updated the notes.
Note Title: ${currentNotes?.heading || '(Untitled)'}
Note Content: ${currentNotes?.body || ''}

CRITICAL REQUIREMENT:
Generate a church announcement notice that is EXACTLY THREE WORDS.
STRICTLY 3 WORDS ONLY. No more, no less.
Examples of valid 3-word notices:
- "Hymn 42 Selected"
- "Choir Rehearsal 6PM"
- "Offering Prayer Now"
- "Stand For Worship"
- "Read John 3"
- "Pastor Sermon Begins"
- "Choir Special Next"

Output ONLY the exact 3 words. Do NOT include quotes, punctuation, or any extra text.`;

  // Candidate models with Gemini 3.1 Flash Lite as primary
  const candidateModels = [
    'gemini-3.1-flash-lite',
    'gemini-flash-lite-latest',
    'gemini-3.5-flash-lite',
  ];

  if (apiKey) {
    for (const model of candidateModels) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 22000);

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              systemInstruction: {
                parts: [{
                  text: 'You are a real-time church notice generator. You MUST respond with EXACTLY THREE WORDS ONLY (e.g. "Choir Rehearsal 6PM"). Never write sentences, punctuation, or more than 3 words.'
                }]
              },
              generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 20
              }
            })
          }
        );

        clearTimeout(timeout);

        if (response.ok) {
          const data = await response.json();
          let rawNotice = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
          if (rawNotice) {
            // Clean quotes, punctuation, and enforce strictly 3 words
            const cleanNotice = rawNotice
              .replace(/["'*`_~]/g, '')
              .replace(/[.,!?;:]/g, ' ')
              .trim();
            const words = cleanNotice.split(/\s+/).filter(Boolean);
            let finalNotice = '';
            if (words.length >= 3) {
              finalNotice = words.slice(0, 3).join(' ');
            } else if (words.length === 2) {
              finalNotice = `${words.join(' ')} Now`;
            } else if (words.length === 1) {
              finalNotice = `${words[0]} Updated Now`;
            } else {
              finalNotice = 'Notice Updated Now';
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({
              notice: finalNotice,
              modelUsed: 'gemini-3.1-flash-lite'
            }));
            return;
          }
        } else {
          const errText = await response.text().catch(() => '');
          console.warn(`[Notice API] Model ${model} returned HTTP ${response.status}:`, errText.slice(0, 150));
        }
      } catch (e) {
        clearTimeout(timeout);
        console.warn(`[Notice API] Model ${model} exception:`, e.message);
      }
    }
  }

  // Graceful rule-based 3-word fallback if AI key is offline or unavailable
  const headingText = (currentNotes.heading || currentNotes.body || 'Notice Update Now')
    .replace(/[.,!?;:"]/g, ' ')
    .trim();
  const headingWords = headingText.split(/\s+/).filter(Boolean);
  let fallbackNotice = 'Church Notice Updated';
  if (headingWords.length >= 3) {
    fallbackNotice = headingWords.slice(0, 3).join(' ');
  } else if (headingWords.length === 2) {
    fallbackNotice = `${headingWords.join(' ')} Now`;
  } else if (headingWords.length === 1) {
    fallbackNotice = `${headingWords[0]} Update Live`;
  }

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    notice: fallbackNotice,
    modelUsed: 'local-fallback'
  }));
}
