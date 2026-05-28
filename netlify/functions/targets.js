// Yahoo Finance analyst-target proxy - free, uses crumb+cookie auth
// GET ?tickers=NVDA,AMD,CRDO (batched, up to 80)
// Returns: { data: { TICKER: { targetMean, targetHigh, targetLow, targetMedian,
//            recKey, recMean, numAnalysts, currentPrice } }, count, fetchedAt }
//
// quoteSummary financialData is per-symbol, so we fan out with limited
// concurrency. ~62 tickers resolves in ~2s. Crumb is cached per warm container.

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const CONCURRENCY = 10;

// Module-scope crumb cache (survives warm invocations)
let _crumb = null;
let _cookie = null;
let _crumbAt = 0;
const CRUMB_TTL = 25 * 60 * 1000; // 25 min

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return reply(405, { error: 'GET only' });
  }

  const qs = event.queryStringParameters || {};
  const batch = String(qs.tickers || '').toUpperCase().trim();
  const tickers = batch
    ? batch.split(',').map(t => t.trim()).filter(t => /^[A-Z0-9.\-]{1,10}$/.test(t)).slice(0, 80)
    : [];

  if (tickers.length === 0) {
    return reply(400, { error: 'tickers param required (comma-separated, 1-10 chars each)' });
  }

  try {
    const { crumb, cookie } = await getCrumb();
    if (!crumb) return reply(502, { error: 'Could not obtain Yahoo crumb' });

    const out = {};
    let okCount = 0;

    // Fan out with bounded concurrency
    for (let i = 0; i < tickers.length; i += CONCURRENCY) {
      const slice = tickers.slice(i, i + CONCURRENCY);
      const settled = await Promise.allSettled(slice.map(t => fetchTarget(t, crumb, cookie)));
      slice.forEach((t, idx) => {
        const r = settled[idx];
        if (r.status === 'fulfilled' && r.value) {
          out[t] = r.value;
          okCount++;
        } else {
          out[t] = { ticker: t, error: r.status === 'rejected' ? String(r.reason && r.reason.message || r.reason) : 'no data' };
        }
      });
    }

    return cachedReply(200, { data: out, count: okCount, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return reply(500, { error: String(err && err.message || err) });
  }
};

async function getCrumb() {
  if (_crumb && (Date.now() - _crumbAt) < CRUMB_TTL) {
    return { crumb: _crumb, cookie: _cookie };
  }
  // 1. Obtain a session cookie (fc.yahoo.com 404s but still sets A3 cookie)
  let cookie = '';
  try {
    const r1 = await fetch('https://fc.yahoo.com', { headers: { 'User-Agent': UA } });
    const sc = (typeof r1.headers.getSetCookie === 'function')
      ? r1.headers.getSetCookie()
      : [r1.headers.get('set-cookie')];
    cookie = (sc && sc[0]) ? sc[0].split(';')[0] : '';
  } catch (e) { /* continue, some regions still issue crumb without cookie */ }

  // 2. Fetch crumb tied to that cookie
  const r2 = await fetch('https://query1.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': UA, 'Cookie': cookie, 'Accept': 'text/plain' }
  });
  const crumb = (await r2.text()).trim();

  if (crumb && crumb.length < 40 && !crumb.includes('<')) {
    _crumb = crumb;
    _cookie = cookie;
    _crumbAt = Date.now();
    return { crumb, cookie };
  }
  return { crumb: null, cookie };
}

async function fetchTarget(ticker, crumb, cookie) {
  const url = 'https://query1.finance.yahoo.com/v10/finance/quoteSummary/' + encodeURIComponent(ticker) +
    '?modules=financialData&crumb=' + encodeURIComponent(crumb);

  const resp = await fetch(url, {
    headers: { 'User-Agent': UA, 'Cookie': cookie, 'Accept': 'application/json' }
  });

  if (!resp.ok) {
    throw new Error('Yahoo ' + resp.status + ' for ' + ticker);
  }

  const data = await resp.json();
  const fd = data && data.quoteSummary && data.quoteSummary.result && data.quoteSummary.result[0] && data.quoteSummary.result[0].financialData;
  if (!fd) return null;

  const num = (o) => (o && typeof o.raw === 'number') ? +Number(o.raw).toFixed(2) : null;

  const targetMean = num(fd.targetMeanPrice);
  const currentPrice = num(fd.currentPrice);
  if (targetMean == null && currentPrice == null) return null;

  return {
    ticker: ticker,
    currentPrice: currentPrice,
    targetMean: targetMean,
    targetHigh: num(fd.targetHighPrice),
    targetLow: num(fd.targetLowPrice),
    targetMedian: num(fd.targetMedianPrice),
    recMean: num(fd.recommendationMean),
    recKey: fd.recommendationKey && fd.recommendationKey !== 'none' ? fd.recommendationKey : null,
    numAnalysts: (fd.numberOfAnalystOpinions && typeof fd.numberOfAnalystOpinions.raw === 'number') ? fd.numberOfAnalystOpinions.raw : null
  };
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
    statusCode: statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders()),
    body: JSON.stringify(payload)
  };
}

function cachedReply(statusCode, payload) {
  return {
    statusCode: statusCode,
    headers: Object.assign(
      // Analyst targets move slowly — cache hard (6h browser, 12h CDN)
      { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=21600, s-maxage=43200, stale-while-revalidate=86400' },
      corsHeaders()
    ),
    body: JSON.stringify(payload)
  };
}
