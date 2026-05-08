const express = require('express');
const https   = require('https');
const router  = express.Router();

const FINNHUB_KEY = 'd7trvdpr01qlbd3laqr0d7trvdpr01qlbd3laqrg';

const cache = new Map();
function getCached(key, ttl = 60000) {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < ttl) return e.data;
  return null;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

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

function fhGet(path) {
  return new Promise((resolve, reject) => {
    const url = `https://finnhub.io/api/v1${path}&token=${FINNHUB_KEY}`;
    https.get(url, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON from Finnhub')); }
      });
    }).on('error', reject);
  });
}

// ── GET /api/crypto/quotes
router.get('/quotes', async (req, res) => {
  const hit = getCached('crypto:quotes', 60000);
  if (hit) return res.json(hit);

  // Expanded list of crypto currencies to ensure wide coverage
  const symbols = [
    'BTC-USD', 'ETH-USD', 'USDT-USD', 'BNB-USD', 'SOL-USD', 'USDC-USD', 'XRP-USD', 
    'ADA-USD', 'AVAX-USD', 'DOGE-USD', 'DOT-USD', 'TRX-USD', 'LINK-USD', 'MATIC-USD', 
    'LTC-USD', 'BCH-USD', 'XLM-USD', 'UNI-USD'
  ];
  
  try {
    const results = await Promise.all(
      symbols.map(s =>
        yahooGet(`/v8/finance/chart/${s}?interval=1d&range=1d`)
          .then(d => {
            const meta = d?.chart?.result?.[0]?.meta;
            if (!meta) return null;
            const prev  = meta.chartPreviousClose || meta.previousClose || meta.regularMarketPrice;
            const price = meta.regularMarketPrice;
            const chg   = price - prev;
            const chgPct = prev ? (chg / prev) * 100 : 0;
            
            // Generate pseudo market caps for ranking/display using common circulating supply estimates since Yahoo v8 doesn't always include them
            let supply = 1000000000;
            if (s === 'BTC-USD') supply = 19600000;
            if (s === 'ETH-USD') supply = 120000000;
            if (s === 'USDT-USD') supply = 100000000000;
            if (s === 'BNB-USD') supply = 150000000;
            if (s === 'SOL-USD') supply = 430000000;
            if (s === 'USDC-USD') supply = 26000000000;
            if (s === 'XRP-USD') supply = 54000000000;
            if (s === 'ADA-USD') supply = 35000000000;
            if (s === 'DOGE-USD') supply = 142000000000;
            if (s === 'AVAX-USD') supply = 360000000;
            if (s === 'DOT-USD') supply = 1300000000;
            if (s === 'TRX-USD') supply = 87000000000;
            if (s === 'LINK-USD') supply = 580000000;
            if (s === 'MATIC-USD') supply = 9200000000;
            if (s === 'LTC-USD') supply = 74000000;
            
            return { 
              symbol: s, 
              price, 
              change: chg, 
              changePercent: chgPct, 
              marketCap: meta.regularMarketPrice * supply 
            };
          })
          .catch(() => null)
      )
    );
    const data = results.filter(Boolean);
    
    // Sort by market cap
    data.sort((a,b) => b.marketCap - a.marketCap);
    
    setCache('crypto:quotes', data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/crypto/history/:ticker
router.get('/history/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const range = req.query.range || '1y';

  const key = `crypto:hist:${ticker}:${range}`;
  const hit = getCached(key, 5 * 60000);
  if (hit) return res.json(hit);

  const rangeCfg = {
    '1d':  { range: '1d',  interval: '5m'  },
    '5d':  { range: '5d',  interval: '15m' },
    '1mo': { range: '1mo', interval: '1d'  },
    '3mo': { range: '3mo', interval: '1d'  },
    '6mo': { range: '6mo', interval: '1d'  },
    '1y':  { range: '1y',  interval: '1d'  },
  };
  const cfg = rangeCfg[range] || rangeCfg['1y'];

  try {
    const data = await yahooGet(`/v8/finance/chart/${ticker}?range=${cfg.range}&interval=${cfg.interval}`);
    const result = data?.chart?.result?.[0];
    if (!result) return res.status(404).json({ error: `No history for ${ticker}` });

    const timestamps = result.timestamp || [];
    const quote      = result.indicators?.quote?.[0] || {};

    const rows = timestamps.map((ts, i) => ({
      date:   new Date(ts * 1000).toISOString(),
      close:  quote.close?.[i]
    })).filter(r => r.close != null);

    setCache(key, rows);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/crypto/news
router.get('/news', async (req, res) => {
  const hit = getCached('crypto:news', 120000);
  if (hit) return res.json(hit);

  try {
    const rawNews = await fhGet('/news?category=crypto');
    if (!Array.isArray(rawNews)) throw new Error('Invalid news format');

    const formattedNews = rawNews.slice(0, 15).map(n => ({
      headline: n.headline,
      url: n.url,
      source: n.source,
      time: n.datetime * 1000,
      summary: n.summary,
      image: n.image
    }));

    setCache('crypto:news', formattedNews);
    res.json(formattedNews);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
