// Yahoo Finance proxy - free, no API key
// GET ?ticker=NVDA           -> single ticker
// GET ?tickers=NVDA,AMD,CRDO -> batch (up to 50)
// Returns: { ticker, price, prevClose, change, changePct, currency, history: [{d,c}], earningsDate, earningsDaysAway }

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders(), body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return reply(405, { error: 'GET only' });
  }

  const qs = event.queryStringParameters || {};
  const single = String(qs.ticker || '').toUpperCase().trim();
  const batch = String(qs.tickers || '').toUpperCase().trim();
  const range = String(qs.range || '3mo'); // 1mo, 3mo, 6mo, 1y

  const tickers = batch
    ? batch.split(',').map(t => t.trim()).filter(t => /^[A-Z0-9.\-]{1,10}$/.test(t)).slice(0, 50)
    : (single && /^[A-Z0-9.\-]{1,10}$/.test(single) ? [single] : []);

  if (tickers.length === 0) {
    return reply(400, { error: 'ticker or tickers param required (1-10 chars)' });
  }

  try {
    const settled = await Promise.allSettled(tickers.map(t => fetchTickerData(t, range)));

    if (single) {
      const r = settled[0];
      if (r.status === 'rejected') {
        return reply(502, { error: 'Yahoo upstream failed', detail: String(r.reason && r.reason.message || r.reason) });
      }
      return cachedReply(200, r.value);
    }

    const out = {};
    let okCount = 0;
    tickers.forEach((t, i) => {
      const r = settled[i];
      if (r.status === 'fulfilled') {
        out[t] = r.value;
        okCount++;
      } else {
        out[t] = { ticker: t, error: String(r.reason && r.reason.message || r.reason) };
      }
    });
    return cachedReply(200, { data: out, count: okCount, fetchedAt: new Date().toISOString() });
  } catch (err) {
    return reply(500, { error: String(err && err.message || err) });
  }
};

async function fetchTickerData(ticker, range) {
  const url = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(ticker) +
    '?interval=1d&range=' + encodeURIComponent(range) +
    '&includePrePost=false&events=earnings,split,div&useYfid=true&corsDomain=finance.yahoo.com';

  const resp = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Cache-Control': 'no-cache'
    }
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error('Yahoo ' + resp.status + ' for ' + ticker + (txt ? ' :: ' + txt.slice(0, 120) : ''));
  }

  const data = await resp.json();
  const result = data && data.chart && data.chart.result && data.chart.result[0];
  if (!result) {
    const err = data && data.chart && data.chart.error;
    throw new Error('No chart data: ' + (err ? JSON.stringify(err) : 'empty'));
  }

  const meta = result.meta || {};
  const timestamps = result.timestamp || [];
  const closes = (result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || [];

  // Build history array (date timestamp + close), strip null gaps
  const history = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = closes[i];
    if (c != null && !isNaN(c)) {
      history.push({ d: timestamps[i], c: +Number(c).toFixed(2) });
    }
  }

  if (history.length === 0) throw new Error('No price points for ' + ticker);

  const lastClose = history[history.length - 1].c;
  const price = meta.regularMarketPrice != null ? +Number(meta.regularMarketPrice).toFixed(2) : lastClose;

  // Use previous trading day's close as prevClose (better than meta.previousClose which can be off-by-one)
  const prevClose = history.length >= 2
    ? history[history.length - 2].c
    : (meta.chartPreviousClose || meta.previousClose || price);

  const change = +(price - prevClose).toFixed(2);
  const changePct = prevClose ? +((change / prevClose) * 100).toFixed(2) : 0;

  // Earnings date extraction
  let earningsDate = null;
  let earningsDaysAway = null;
  const earningsEvents = result.events && result.events.earnings;
  if (earningsEvents) {
    const datesUnix = [];
    for (const k of Object.keys(earningsEvents)) {
      const ev = earningsEvents[k];
      const arr = ev && (ev.earningsDate || (ev.date != null ? [ev.date] : null));
      if (Array.isArray(arr) && arr.length) datesUnix.push(arr[0]);
      else if (typeof ev === 'object' && ev !== null && typeof ev.date === 'number') datesUnix.push(ev.date);
    }
    datesUnix.sort((a, b) => a - b);
    const nowUnix = Math.floor(Date.now() / 1000);
    const future = datesUnix.find(t => t > nowUnix);
    if (future) {
      earningsDate = future;
    } else if (datesUnix.length > 0) {
      // Estimate next earnings = last + 90 days (quarterly)
      earningsDate = datesUnix[datesUnix.length - 1] + 90 * 86400;
    }
    if (earningsDate) {
      earningsDaysAway = Math.round((earningsDate - nowUnix) / 86400);
    }
  }

  return {
    ticker: ticker,
    price: price,
    prevClose: +Number(prevClose).toFixed(2),
    change: change,
    changePct: changePct,
    currency: meta.currency || 'USD',
    history: history.slice(-60),
    earningsDate: earningsDate,
    earningsDaysAway: earningsDaysAway,
    fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh != null ? +Number(meta.fiftyTwoWeekHigh).toFixed(2) : null,
    fiftyTwoWeekLow: meta.fiftyTwoWeekLow != null ? +Number(meta.fiftyTwoWeekLow).toFixed(2) : null
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
      { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=300, s-maxage=600, stale-while-revalidate=1800' },
      corsHeaders()
    ),
    body: JSON.stringify(payload)
  };
}
