const express = require('express');
const https   = require('https');
const router  = express.Router();

const FINNHUB_KEY = 'd7trvdpr01qlbd3laqr0d7trvdpr01qlbd3laqrg';
const FH_BASE     = 'https://finnhub.io/api/v1';

// ── Cache ────────────────────────────────────────────────────────────────────
const cache = new Map();
function getCached(key, ttl = 60000) {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < ttl) return e.data;
  return null;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ── Static ETF/Stock Fallbacks ───────────────────────────────────────────────
const FALLBACK_ETF_DATA = {
  'SPY': { aum: 500e9 },
  'IVV': { aum: 450e9 },
  'VOO': { aum: 400e9 },
  'QQQ': { aum: 250e9 },
  'DIA': { aum: 30e9 },
  'VTI': { aum: 350e9 },
  'BTC-USD': { marketCap: 1.4e12 },
  'GLD': { aum: 60e9 },
  'IWM': { aum: 65e9 },
  'ARKK': { aum: 8e9 },
  'SMH': { aum: 15e9 },
};


// ── HTTP helpers ─────────────────────────────────────────────────────────────
function fhGet(path) {
  return new Promise((resolve, reject) => {
    const url = `${FH_BASE}${path}&token=${FINNHUB_KEY}`;
    https.get(url, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON')); }
      });
    }).on('error', reject);
  });
}

function yahooGet(path) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'query1.finance.yahoo.com',
      path,
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json',
      }
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

// ── GET /api/stock/indices ────────────────────────────────────────────────────
router.get('/indices', async (req, res) => {
  const hit = getCached('indices', 60000);
  if (hit) return res.json(hit);

  const symbols = ['^GSPC', '^DJI', '^IXIC', '^VIX', 'BTC-USD', '^TNX', 'AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN', 'META', 'TSLA'];
  const labels  = { '^GSPC':'S&P 500', '^DJI':'DOW', '^IXIC':'NASDAQ',
                    '^VIX':'VIX', 'BTC-USD':'BTC/USD', '^TNX':'10Y YIELD',
                    'AAPL':'AAPL', 'MSFT':'MSFT', 'NVDA':'NVDA', 'GOOGL':'GOOGL', 'AMZN':'AMZN', 'META':'META', 'TSLA':'TSLA' };

  try {
    const results = await Promise.all(
      symbols.map(s =>
        yahooGet(`/v8/finance/chart/${encodeURIComponent(s)}?interval=1d&range=1d`)
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            if (!meta) return null;
            const prev  = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
            const price = meta.regularMarketPrice;
            const chg   = price - prev;
            const chgPct = prev ? (chg / prev) * 100 : 0;
            let state = 'CLOSED';
            const now = Math.floor(Date.now() / 1000);
            const periods = meta.currentTradingPeriod;
            if (periods) {
              if (now >= periods.regular?.start && now < periods.regular?.end) state = 'REGULAR';
              else if (now >= periods.pre?.start && now < periods.pre?.end) state = 'PRE';
              else if (now >= periods.post?.start && now < periods.post?.end) state = 'POST';
            }
            return { symbol: s, label: labels[s], price, change: chg, changePercent: chgPct, marketState: state };
          })
          .catch(() => null)
      )
    );
    const data = results.filter(Boolean);
    setCache('indices', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stock/search?q=apple ────────────────────────────────────────────
router.get('/search', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.json([]);
  try {
    const data = await fhGet(`/search?q=${encodeURIComponent(q)}`);
    const items = (data.result || []).slice(0, 10).map(r => ({
      symbol:   r.symbol,
      name:     r.description,
      exchange: r.primaryExchange,
      type:     r.type,
    }));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/stock/:ticker ────────────────────────────────────────────────────
router.get('/:ticker', async (req, res) => {
  const { ticker } = req.params;
  if (ticker === 'indices' || ticker === 'search') return res.status(404).json({ error: 'Not a ticker' });

  const key = `quote:${ticker.toUpperCase()}`;
  const hit = getCached(key, 60000);
  if (hit) return res.json(hit);

  try {
    const [quote, profile, metric] = await Promise.all([
      fhGet(`/quote?symbol=${ticker}`),
      fhGet(`/stock/profile2?symbol=${ticker}`),
      fhGet(`/stock/metric?symbol=${ticker}&metric=all`),
    ]);

    const m = metric?.metric || {};
    const data = {
      symbol:        ticker.toUpperCase(),
      name:          profile?.name || ticker,
      price:         quote.c,
      change:        quote.d,
      changePercent: quote.dp,
      open:          quote.o,
      high:          quote.h,
      low:           quote.l,
      prevClose:     quote.pc,
      volume:        m['10DayAverageTradingVolume'] ? m['10DayAverageTradingVolume'] * 1e6 : null,
      avgVolume:     m['10DayAverageTradingVolume'] ? m['10DayAverageTradingVolume'] * 1e6 : null,
      marketCap:     profile?.marketCapitalization ? profile.marketCapitalization * 1e6 : (FALLBACK_ETF_DATA[ticker.toUpperCase()]?.marketCap || null),
      aum:           FALLBACK_ETF_DATA[ticker.toUpperCase()]?.aum || null,
      peRatio:       m['peNormalizedAnnual'],
      eps:           m['epsNormalizedAnnual'],
      dividendYield: m['dividendYieldIndicatedAnnual'],
      week52High:    m['52WeekHigh'],
      week52Low:     m['52WeekLow'],
      beta:          m['beta'],
      currency:      profile?.currency || 'USD',
      exchange:      profile?.exchange,
      marketState:   quote.c > 0 ? 'REGULAR' : 'CLOSED',
      sector:        profile?.finnhubIndustry,
      industry:      profile?.finnhubIndustry,
      employees:     profile?.employeeTotal,
      description:   profile?.description || null,
      website:       profile?.weburl,
    };
    setCache(key, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: `Cannot fetch ${ticker}: ${err.message}` });
  }
});

// ── GET /api/stock/:ticker/history?range=1y ───────────────────────────────────
router.get('/:ticker/history', async (req, res) => {
  const { ticker } = req.params;
  const range = req.query.range || '1y';

  const key = `hist:${ticker.toUpperCase()}:${range}`;
  const hit = getCached(key, 5 * 60000);
  if (hit) return res.json(hit);

  // Map range → Yahoo Finance v8 chart API params
  const rangeCfg = {
    '1d':  { range: '1d',  interval: '5m'  },
    '5d':  { range: '5d',  interval: '15m' },
    '1mo': { range: '1mo', interval: '1d'  },
    '3mo': { range: '3mo', interval: '1d'  },
    '6mo': { range: '6mo', interval: '1d'  },
    '1y':  { range: '1y',  interval: '1d'  },
    '2y':  { range: '2y',  interval: '1wk' },
    '5y':  { range: '5y',  interval: '1wk' },
  };
  const cfg = rangeCfg[range] || rangeCfg['1y'];

  try {
    const path = `/v8/finance/chart/${encodeURIComponent(ticker)}?range=${cfg.range}&interval=${cfg.interval}&includePrePost=false`;
    const data = await yahooGet(path);

    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: `No history for ${ticker}` });

    const timestamps = result.timestamp || [];
    const quote      = result.indicators?.quote?.[0] || {};

    const rows = timestamps.map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString(),
      open:   quote.open?.[i],
      high:   quote.high?.[i],
      low:    quote.low?.[i],
      close:  quote.close?.[i],
      volume: quote.volume?.[i],
    })).filter(r => r.close != null);

    setCache(key, rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
