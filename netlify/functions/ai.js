// Pollinations.ai proxy - 100% free, no API key, no registration
// https://pollinations.ai - OpenAI-compatible text generation
// POST { messages: [{role,content}], system?, model?, maxTokens?, temperature? }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'POST only' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return reply(400, { error: 'Invalid JSON body' }); }

  const messages = body.messages;
  const system = body.system;
  const model = body.model || 'openai';
  const maxTokens = body.maxTokens || 700;
  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.6;

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply(400, { error: 'messages array required' });
  }

  const cleanMessages = messages
    .filter(m => m && typeof m.content === 'string' && m.content.length > 0)
    .slice(-12)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
      content: String(m.content).slice(0, 4000)
    }));

  const finalMessages = [];
  if (system && typeof system === 'string') {
    finalMessages.push({ role: 'system', content: system.slice(0, 6000) });
  }
  for (const m of cleanMessages) finalMessages.push(m);

  const payload = {
    model: model,
    messages: finalMessages,
    max_tokens: Math.min(Math.max(parseInt(maxTokens) || 700, 50), 2000),
    temperature: Math.min(Math.max(parseFloat(temperature) || 0.6, 0), 1.5),
    stream: false,
    private: true,
    referrer: 'trendwatcher'
  };

  // Try up to 3 attempts on 5xx / network errors
  let lastError = null;
  let lastStatus = 0;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const upstream = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Referer': 'https://trendwatcher.netlify.app/'
        },
        body: JSON.stringify(payload)
      });

      const txt = await upstream.text();
      let data;
      try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }

      if (!upstream.ok) {
        lastStatus = upstream.status;
        lastError = (data && (data.error && (data.error.message || data.error)) || data.message) || ('Pollinations ' + upstream.status);
        // 5xx -> retry; 4xx -> fail immediately
        if (upstream.status >= 500 && attempt < 3) {
          await sleep(700 * attempt);
          continue;
        }
        return reply(upstream.status, { error: lastError, attempts: attempt });
      }

      let text = '';
      if (data && data.choices && data.choices[0]) {
        text = (data.choices[0].message && data.choices[0].message.content) || data.choices[0].text || '';
      }
      if (!text && data) {
        text = data.text || data.raw || '';
      }

      return reply(200, {
        text: stripAds(String(text || '')).trim(),
        model: (data && data.model) || model,
        usage: (data && data.usage) || null,
        attempts: attempt
      });
    } catch (err) {
      lastError = String((err && err.message) || err);
      if (attempt < 3) {
        await sleep(700 * attempt);
        continue;
      }
      return reply(502, { error: lastError, attempts: attempt });
    }
  }

  return reply(lastStatus || 500, { error: lastError || 'Unknown failure' });
};

// Pollinations occasionally injects sponsored content into responses.
// Strip well-known ad markers + everything after them.
function stripAds(text) {
  if (!text) return '';

  const adMarkers = [
    /---\s*\*\*Support\s+Pollinations[\s\S]*$/i,
    /---\s*Support\s+Pollinations[\s\S]*$/i,
    /\*\*Support\s+Pollinations\.?\s*AI:?\*\*[\s\S]*$/i,
    /🌸\s*\*?\*?Ad\*?\*?\s*🌸[\s\S]*$/i,
    /\*\*Ad\*\*[\s\S]*$/i,
    /\[Support our mission\][\s\S]*$/i,
    /\bpollinations\.ai\/redirect\/[\s\S]*$/i,
    /\bSponsor:?[\s\S]*?(?:\n\n|$)/gi,
    /\*?\*?Powered by Pollinations[\s\S]*$/i
  ];

  let out = text;
  for (const re of adMarkers) {
    out = out.replace(re, '');
  }

  // Clean trailing dashes / whitespace
  out = out.replace(/[\s\-—–]+$/g, '').trim();

  return out;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function reply(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()),
    body: JSON.stringify(payload)
  };
}
