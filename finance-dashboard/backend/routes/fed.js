const express = require('express');
const https   = require('https');
const router  = express.Router();

// ── Simple cache ─────────────────────────────────────────────────────────────
const cache = new Map();
const TTL   = 2 * 60 * 1000; // 2 minutes

function getCached(key) {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < TTL) return e.data;
  return null;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

function yahooGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'query1.finance.yahoo.com',
      path,
      headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
    };
    https.get(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON from Yahoo')); }
      });
    }).on('error', reject);
  });
}

function nyFedGet() {
  return new Promise((resolve, reject) => {
    https.get('https://markets.newyorkfed.org/api/rates/all/latest.json', res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON from NY Fed')); }
      });
    }).on('error', reject);
  });
}

const FINNHUB_KEY = 'd7trvdpr01qlbd3laqr0d7trvdpr01qlbd3laqrg';
function finnhubNews() {
  return new Promise((resolve, reject) => {
    https.get(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON from Finnhub')); }
      });
    }).on('error', reject);
  });
}

// ── GET /api/fed/rates ────────────────────────────────────────────────────────
// Fetches the Yield Curve to represent market rates alongside Fed policy
router.get('/rates', async (req, res) => {
  const hit = getCached('fed:rates');
  if (hit) return res.json(hit);

  const symbols = ['^IRX', '^FVX', '^TNX', '^TYX']; // 13W, 5Y, 10Y, 30Y
  const labels  = { '^IRX': '3 Month', '^FVX': '5 Year', '^TNX': '10 Year', '^TYX': '30 Year' };

  try {
    const [yieldsResults, nyFedResult] = await Promise.all([
      Promise.all(
        symbols.map(s =>
          yahooGet(`/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`)
            .then(d => {
              const meta = d?.chart?.result?.[0]?.meta;
              if (!meta) return null;
              return {
                symbol: s,
                label: labels[s],
                rate: meta.regularMarketPrice,
                prev: meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice,
                change: meta.regularMarketPrice - (meta.chartPreviousClose || meta.regularMarketPrice)
              };
            })
            .catch(() => null)
        )
      ),
      nyFedGet().catch(() => null)
    ]);

    const validYields = yieldsResults.filter(Boolean);
    
    // Parse official Fed data
    let officialRate = null;
    let targetFrom = null;
    let targetTo = null;
    if (nyFedResult && nyFedResult.refRates) {
      const effr = nyFedResult.refRates.find(r => r.type === 'EFFR');
      if (effr) {
        officialRate = effr.percentRate;
        targetFrom = effr.targetRateFrom;
        targetTo = effr.targetRateTo;
      }
    }
    
    // Calculate meeting dates statically for 2026/2027 context
    const now = new Date();
    // Typical FOMC schedule (approximated for demo)
    const meetings = [
      new Date('2026-01-28'), new Date('2026-03-18'), new Date('2026-05-06'),
      new Date('2026-06-17'), new Date('2026-07-29'), new Date('2026-09-16'),
      new Date('2026-11-04'), new Date('2026-12-16')
    ];
    let latest = meetings[0], next = meetings[meetings.length - 1];
    for (let i = 0; i < meetings.length; i++) {
      if (meetings[i] > now) {
        next = meetings[i];
        latest = i > 0 ? meetings[i - 1] : new Date('2025-12-10');
        break;
      }
    }

    const data = {
      rates: validYields,
      official: {
        rate: officialRate,
        targetFrom: targetFrom,
        targetTo: targetTo
      },
      latestDecision: latest.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      nextDecision: next.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    };

    setCache('fed:rates', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/fed/history ──────────────────────────────────────────────────────
// Fetches historical 13-week bill yields as a proxy for the Fed Funds Rate
router.get('/history', async (req, res) => {
  const range = req.query.range || '5y';
  const hit = getCached(`fed:history:${range}`);
  if (hit) return res.json(hit);

  try {
    // interval mapping
    let interval = '1d';
    if (range === '1d' || range === '5d') interval = '5m';

    const data = await yahooGet(`/v8/finance/chart/%5EIRX?interval=${interval}&range=${range}`);
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error('No historical data available');

    const timestamps = result.timestamp || [];
    const quote      = result.indicators?.quote?.[0] || {};
    
    const rows = timestamps.map((ts, i) => ({
      date:  new Date(ts * 1000).toISOString(),
      close: quote.close?.[i]
    })).filter(r => r.close != null);

    setCache(`fed:history:${range}`, rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/fed/news ────────────────────────────────────────────────────────
router.get('/news', async (req, res) => {
  const hit = getCached('fed:news');
  if (hit) return res.json(hit);

  try {
    const rawNews = await finnhubNews();
    if (!Array.isArray(rawNews)) throw new Error('Invalid news format');

    // Filter for Federal Reserve / Economy related keywords
    const keywords = ['fed ', 'federal reserve', 'fomc', 'powell', 'interest rate', 'inflation', 'cpi', 'economy', 'rates', 'yield'];
    let fedNews = rawNews.filter(n => {
      const text = (n.headline + ' ' + n.summary).toLowerCase();
      return keywords.some(k => text.includes(k));
    }).slice(0, 5); // Take top 5

    // If not enough specific news, fallback to top general news
    if (fedNews.length < 3) {
      fedNews = rawNews.slice(0, 5);
    }

    const formattedNews = fedNews.map(n => ({
      headline: n.headline,
      url: n.url,
      source: n.source,
      time: n.datetime * 1000,
      summary: n.summary
    }));

    setCache('fed:news', formattedNews);
    res.json(formattedNews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
