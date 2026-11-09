// ==============================================================================
// api/gemini-config.js
// Serverless / Backend Handler for Gemini API Key Status & Configuration
// Shared by Sugam Church Bot and Sugam Lyrics Book
// ==============================================================================

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://aiufpdabglxhojmmkedp.supabase.co';
  const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_qDJqr6BpPMTWLaL_C9n8Cw_TgKfgCBB';

  const getActiveKey = async () => {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return process.env.GEMINI_API_KEY.trim();
    }
    try {
      const resp = await fetch(`${supabaseUrl}/rest/v1/church_settings?key=in.(gemini_ai_config,gemini_api_key)&select=key,value`, {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`
        }
      });
      if (resp.ok) {
        const rows = await resp.json();
        for (const row of rows) {
          if (row.key === 'gemini_api_key' && typeof row.value === 'string' && row.value.trim()) {
            return row.value.trim();
          }
          if (row.key === 'gemini_ai_config' && row.value?.apiKey && typeof row.value.apiKey === 'string') {
            return row.value.apiKey.trim();
          }
        }
      }
    } catch {}
    return '';
  };

  if (req.method === 'GET') {
    const currentKey = await getActiveKey();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      configured: Boolean(currentKey),
      maskedKey: currentKey ? `${currentKey.slice(0, 5)}...${currentKey.slice(-4)}` : null
    }));
    return;
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (!body) {
      // In Node streaming environments
      const buffers = [];
      for await (const chunk of req) {
        buffers.push(chunk);
      }
      try {
        body = JSON.parse(Buffer.concat(buffers).toString('utf8'));
      } catch {
        body = {};
      }
    }

    const newKey = (body?.apiKey || '').trim();
    if (!newKey) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Please provide a valid Gemini API key.' }));
      return;
    }

    process.env.GEMINI_API_KEY = newKey;

    // Persist to Supabase church_settings table
    try {
      await fetch(`${supabaseUrl}/rest/v1/church_settings`, {
        method: 'POST',
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          key: 'gemini_api_key',
          value: newKey,
          updated_at: new Date().toISOString()
        })
      });
    } catch (sbErr) {
      console.warn('[gemini-config] Supabase write notice:', sbErr.message);
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: true,
      configured: true,
      maskedKey: `${newKey.slice(0, 5)}...${newKey.slice(-4)}`,
      message: 'Gemini API key saved successfully and active for both Chatbot and Lyrics Book.'
    }));
    return;
  }

  res.statusCode = 405;
  res.end('Method Not Allowed');
}
