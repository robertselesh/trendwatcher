// Pollinations.ai proxy - 100% free, no API key, no registration
// https://pollinations.ai - OpenAI-compatible text generation
// POST { messages: [{role,content}], system?, model?, maxTokens?, temperature? }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'POST') {
    return reply(405, { error: 'POST only' });
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return reply(400, { error: 'Invalid JSON body' }); }

  const {
    messages,
    system,
    model = 'openai',          // openai | mistral | llama | qwen-coder | searchgpt
    maxTokens = 700,
    temperature = 0.6
  } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return reply(400, { error: 'messages array required' });
  }

  const cleanMessages = messages
    .filter(m => m && typeof m.content === 'string' && m.content.length > 0)
    .slice(-12)
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : (m.role === 'system' ? 'system' : 'user'),
      content: m.content.slice(0, 4000)
    }));

  const finalMessages = [];
  if (system && typeof system === 'string') {
    finalMessages.push({ role: 'system', content: system.slice(0, 6000) });
  }
  finalMessages.push(...cleanMessages);

  try {
    const upstream = await fetch('https://text.pollinations.ai/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: finalMessages,
        max_tokens: Math.min(Math.max(parseInt(maxTokens) || 700, 50), 2000),
        temperature: Math.min(Math.max(parseFloat(temperature) || 0.6, 0), 1.5),
        stream: false,
        private: true
      })
    });

    const txt = await upstream.text();
    let data;
    try { data = JSON.parse(txt); } catch { data = { raw: txt }; }

    if (!upstream.ok) {
      return reply(upstream.status, {
        error: data.error?.message || data.error || data.message || ('Pollinations ' + upstream.status),
        upstream: data
      });
    }

    const text =
      data.choices?.[0]?.message?.content ||
      data.choices?.[0]?.text ||
      data.text ||
      data.raw ||
      '';

    return reply(200, {
      text: String(text).trim(),
      model: data.model || model,
      usage: data.usage || null
    });
  } catch (err) {
    return reply(500, { error: String(err?.message || err) });
  }
};

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  };
}

function reply(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
    body: JSON.stringify(payload)
  };
}
