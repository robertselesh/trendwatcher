// Google News RSS fetcher per ticker — no API key needed
// GET ?ticker=NVDA  -> { ticker, items: [{title, link, pubDate, source}] }

export const handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return reply(405, { error: 'GET only' });
  }

  const ticker = (event.queryStringParameters?.ticker || '').toUpperCase().trim();
  if (!ticker || !/^[A-Z0-9.\-]{1,10}$/.test(ticker)) {
    return reply(400, { error: 'Valid ticker required (1-10 chars, A-Z 0-9 . -)' });
  }

  const q = encodeURIComponent(ticker + ' stock');
  const url = 'https://news.google.com/rss/search?q=' + q + '&hl=en-US&gl=US&ceid=US:en';

  try {
    const upstream = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; TrendWatcher/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml'
      }
    });

    if (!upstream.ok) {
      return reply(upstream.status, { error: 'Google News RSS ' + upstream.status });
    }

    const xml = await upstream.text();
    const items = parseRss(xml).slice(0, 12);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=900, s-maxage=900',
        ...corsHeaders()
      },
      body: JSON.stringify({ ticker, items, fetchedAt: new Date().toISOString() })
    };
  } catch (err) {
    return reply(500, { error: String(err?.message || err) });
  }
};

function parseRss(xml) {
  const out = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const it = m[1];
    out.push({
      title: cdata(it, 'title'),
      link: tag(it, 'link'),
      pubDate: tag(it, 'pubDate'),
      source: cdata(it, 'source')
    });
  }
  return out.filter(x => x.title);
}

function tag(xml, name) {
  const r = new RegExp('<' + name + '[^>]*>([\\s\\S]*?)<\\/' + name + '>');
  const m = xml.match(r);
  return m ? m[1].trim() : '';
}

function cdata(xml, name) {
  const v = tag(xml, name);
  return v.replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim();
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
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
