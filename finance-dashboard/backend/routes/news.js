const express = require('express');
const https   = require('https');
const router  = express.Router();

const FINNHUB_KEY = 'd7trvdpr01qlbd3laqr0d7trvdpr01qlbd3laqrg';
const BASE        = 'https://finnhub.io/api/v1';

// ── Simple cache ─────────────────────────────────────────────────────────────
const cache = new Map();
const TTL   = 0; // Disabled cache so every page load fetches latest stories

function getCached(key) {
  const e = cache.get(key);
  if (e && Date.now() - e.ts < TTL) return e.data;
  return null;
}
function setCache(key, data) { cache.set(key, { data, ts: Date.now() }); }

// ── Helper: fetch JSON from Finnhub ──────────────────────────────────────────
function finnhubGet(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE}${path}&token=${FINNHUB_KEY}`;
    https.get(url, (res) => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve(JSON.parse(raw)); }
        catch { reject(new Error('Bad JSON from Finnhub')); }
      });
    }).on('error', reject);
  });
}

// ── GET /api/news  — general market news ─────────────────────────────────────
router.get('/', async (req, res) => {
  const category = req.query.category || 'general';
  const key = `news:${category}`;
  const hit = getCached(key);
  if (hit) return res.json(hit);

  try {
    const items = await finnhubGet(`/news?category=${category}`);
    const data = items.slice(0, 40).map(n => ({
      id:        n.id,
      headline:  n.headline,
      summary:   n.summary,
      source:    n.source,
      url:       n.url,
      image:     n.image,
      category:  n.category,
      published: new Date(n.datetime * 1000).toISOString(),
    }));
    setCache(key, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/news/:ticker — company-specific news ────────────────────────────
router.get('/:ticker', async (req, res) => {
  const { ticker } = req.params;
  const to   = new Date().toISOString().split('T')[0];
  const from = new Date(Date.now() - 30 * 86400 * 1000).toISOString().split('T')[0];
  const key  = `news:${ticker.toUpperCase()}:${to}`;
  const hit  = getCached(key);
  if (hit) return res.json(hit);

  try {
    const items = await finnhubGet(
      `/company-news?symbol=${ticker.toUpperCase()}&from=${from}&to=${to}`
    );
    const data = items.slice(0, 30).map(n => ({
      id:        n.id,
      headline:  n.headline,
      summary:   n.summary,
      source:    n.source,
      url:       n.url,
      image:     n.image,
      published: new Date(n.datetime * 1000).toISOString(),
    }));
    setCache(key, data);
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
