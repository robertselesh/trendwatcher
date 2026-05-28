// AI proxy — NVIDIA NIM (primary) + Pollinations.ai (fallback)
// POST { messages: [{role,content}], system?, model?, maxTokens?, temperature? }
//
// Setup: set NVIDIA_API_KEY in Netlify env vars (get free key at build.nvidia.com).
// If the key is missing or NVIDIA errors out, falls back to Pollinations automatically.

const NVIDIA_DEFAULT_MODEL = 'meta/llama-3.3-70b-instruct';
const POLLINATIONS_DEFAULT_MODEL = 'openai';

// Map provider-agnostic model aliases to provider-specific names
const MODEL_ALIASES = {
  openai: NVIDIA_DEFAULT_MODEL,
  default: NVIDIA_DEFAULT_MODEL,
  llama: 'meta/llama-3.3-70b-instruct',
  'llama-3.3': 'meta/llama-3.3-70b-instruct',
  nemotron: 'nvidia/llama-3.1-nemotron-70b-instruct',
  mistral: 'mistralai/mistral-large-2-instruct',
  r1: 'deepseek-ai/deepseek-r1',
  'deepseek-r1': 'deepseek-ai/deepseek-r1'
};

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
  const userModel = body.model;
  const maxTokens = Math.min(Math.max(parseInt(body.maxTokens) || 1200, 50), 4000);
  const temperature = Math.min(Math.max(parseFloat(body.temperature) || 0.6, 0), 1.5);

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply(400, { error: 'messages array required' });
  }

  // Build OpenAI-format message array (NVIDIA + Pollinations both OpenAI-compatible)
  const cleanMessages = messages
    .filter(m => m && typeof m.content === 'string' && m.content.length > 0)
    .slice(-12)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
      content: String(m.content).slice(0, 8000)
    }));

  const finalMessages = [];
  if (system && typeof system === 'string') {
    finalMessages.push({ role: 'system', content: system.slice(0, 8000) });
  }
  for (const m of cleanMessages) finalMessages.push(m);

  // === Provider 1: NVIDIA NIM ===
  const nvKey = process.env.NVIDIA_API_KEY;
  if (nvKey) {
    const nvModel = resolveModel(userModel, 'nvidia');
    const nvResult = await tryNvidia(nvKey, nvModel, finalMessages, maxTokens, temperature);
    if (nvResult.ok) {
      return reply(200, {
        text: nvResult.text,
        model: nvResult.model,
        provider: 'nvidia',
        attempts: nvResult.attempts
      });
    }
    // Log and fall through to Pollinations
    console.warn('[ai] NVIDIA failed, falling back to Pollinations:', nvResult.error);
  }

  // === Provider 2: Pollinations fallback ===
  const polModel = resolveModel(userModel, 'pollinations');
  const polResult = await tryPollinations(polModel, finalMessages, maxTokens, temperature);
  if (polResult.ok) {
    return reply(200, {
      text: polResult.text,
      model: polResult.model,
      provider: 'pollinations',
      attempts: polResult.attempts,
      note: nvKey ? 'nvidia_failed_pollinations_fallback' : 'no_nvidia_key_pollinations_only'
    });
  }

  // Both providers failed
  return reply(polResult.status || 502, {
    error: polResult.error || 'All AI providers failed',
    provider_errors: {
      nvidia: nvKey ? 'failed' : 'no_key',
      pollinations: polResult.error
    }
  });
};

function resolveModel(userModel, provider) {
  if (!userModel) return provider === 'nvidia' ? NVIDIA_DEFAULT_MODEL : POLLINATIONS_DEFAULT_MODEL;
  // If user passed a provider-specific name (contains '/'), use it as-is
  if (typeof userModel === 'string' && userModel.includes('/')) return userModel;
  // Otherwise look up alias
  if (provider === 'nvidia') return MODEL_ALIASES[userModel] || NVIDIA_DEFAULT_MODEL;
  return userModel; // Pollinations: pass through (e.g. 'openai', 'mistral')
}

async function tryNvidia(apiKey, model, messages, maxTokens, temperature) {
  const payload = {
    model: model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature,
    top_p: 0.95,
    stream: false
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const upstream = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + apiKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const txt = await upstream.text();
      let data;
      try { data = JSON.parse(txt); } catch (e) { data = { raw: txt }; }

      if (!upstream.ok) {
        lastError = (data && (data.error && (data.error.message || data.error)) || data.detail || data.message) || ('NVIDIA ' + upstream.status);
        const isTransient = upstream.status >= 500 || upstream.status === 429 || upstream.status === 408;
        if (isTransient && attempt < 3) {
          await sleep(800 * attempt + Math.floor(Math.random() * 300));
          continue;
        }
        return { ok: false, error: lastError, status: upstream.status };
      }

      const text = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if (!text) {
        return { ok: false, error: 'NVIDIA returned empty text', status: 502 };
      }
      return { ok: true, text: text.trim(), model: data.model || model, attempts: attempt };
    } catch (err) {
      lastError = String((err && err.message) || err);
      if (attempt < 3) {
        await sleep(800 * attempt);
        continue;
      }
      return { ok: false, error: lastError, status: 502 };
    }
  }
  return { ok: false, error: lastError, status: 502 };
}

async function tryPollinations(model, messages, maxTokens, temperature) {
  const payload = {
    model: model,
    messages: messages,
    max_tokens: maxTokens,
    temperature: temperature,
    stream: false,
    private: true,
    referrer: 'trendwatcher'
  };

  let lastError = null;
  for (let attempt = 1; attempt <= 4; attempt++) {
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
        lastError = (data && (data.error && (data.error.message || data.error)) || data.message) || ('Pollinations ' + upstream.status);
        const errText = String(lastError || '').toLowerCase();
        const isQueueFull = errText.includes('queue full') || errText.includes('already queued') || errText.includes('rate limit') || errText.includes('too many');
        const isTransient = upstream.status >= 500 || upstream.status === 429 || isQueueFull;
        if (isTransient && attempt < 4) {
          const baseDelay = isQueueFull ? 1500 : 800;
          await sleep(baseDelay * attempt + Math.floor(Math.random() * 300));
          continue;
        }
        return { ok: false, error: lastError, status: upstream.status };
      }

      let text = '';
      if (data && data.choices && data.choices[0]) {
        text = (data.choices[0].message && data.choices[0].message.content) || data.choices[0].text || '';
      }
      if (!text && data) {
        text = data.text || data.raw || '';
      }
      if (!text) {
        return { ok: false, error: 'Pollinations returned empty text', status: 502 };
      }
      return { ok: true, text: stripAds(String(text)).trim(), model: (data && data.model) || model, attempts: attempt };
    } catch (err) {
      lastError = String((err && err.message) || err);
      if (attempt < 4) {
        await sleep(800 * attempt);
        continue;
      }
      return { ok: false, error: lastError, status: 502 };
    }
  }
  return { ok: false, error: lastError, status: 502 };
}

// Pollinations occasionally injects sponsored content. Strip well-known markers.
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
  for (const re of adMarkers) out = out.replace(re, '');
  return out.replace(/[\s\-—–]+$/g, '').trim();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

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
