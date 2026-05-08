const express = require('express');
const cors    = require('cors');
const stockRoutes    = require('./routes/stocks');
const newsRoutes     = require('./routes/news');
const fedRoutes      = require('./routes/fed');
const shippingRoutes     = require('./routes/shipping');
const supplychainRoutes  = require('./routes/supplychain');
const cryptoRoutes       = require('./routes/crypto');

const app  = express();
const PORT = process.env.PORT || 3002;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));
app.use('/api/stock',    stockRoutes);
app.use('/api/news',     newsRoutes);
app.use('/api/fed',      fedRoutes);
app.use('/api/shipping',    shippingRoutes);
app.use('/api/supplychain', supplychainRoutes);
app.use('/api/crypto',      cryptoRoutes);

// ── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Error]', err.message);
  res.status(500).json({ error: err.message });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n💹 Finance Dashboard API  →  http://localhost:${PORT}`);
  console.log(`   /api/stock/:ticker        Quote data`);
  console.log(`   /api/stock/:ticker/history  OHLCV history`);
  console.log(`   /api/stock/indices          Market indices`);
  console.log(`   /api/news                   Financial headlines\n`);
});
