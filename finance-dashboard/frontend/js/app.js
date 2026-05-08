// ── Config ────────────────────────────────────────────────────────────────────
export const API = 'http://localhost:3002/api';

// ── Imports ───────────────────────────────────────────────────────────────────
import { initStockLookup }  from './stockLookup.js';
import { initMonteCarlo }   from './monteCarlo.js';
import { initCompound }     from './compound.js';
import { initCorrelation }  from './correlation.js';
import { initNews }         from './news.js';
import { initFed }          from './fed.js';
import { initShipping }     from './shipping.js';
import { initSupplyChain }  from './supplyChain.js';
import { initCrypto }       from './crypto.js';

// ── Panel routing ─────────────────────────────────────────────────────────────
const panels = ['stocks', 'monte', 'compound', 'correlation', 'news', 'fed', 'shipping', 'supplychain', 'crypto'];

function showPanel(name) {
  panels.forEach(p => {
    document.getElementById(`panel-${p}`)?.classList.remove('active');
    document.getElementById(`nav-${p}`)?.classList.remove('active');
  });
  document.getElementById(`panel-${name}`)?.classList.add('active');
  document.getElementById(`nav-${name}`)?.classList.add('active');
  setStatus(`${name.toUpperCase()} PANEL`);
}

document.querySelectorAll('.sidebar__btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const panel = btn.dataset.panel;
    showPanel(panel);
    // Lazy-init shipping map only on first click so it has real dimensions
    if (panel === 'shipping' && !window._shippingInit) {
      window._shippingInit = true;
      await initShipping();
    }
  });
});

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const now = new Date();
  const est = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const pad = n => String(n).padStart(2,'0');
  document.getElementById('clock').textContent =
    `${pad(est.getHours())}:${pad(est.getMinutes())}:${pad(est.getSeconds())} ET`;
}
setInterval(updateClock, 1000);
updateClock();

// ── Market Indices Ticker ─────────────────────────────────────────────────────
async function loadIndices() {
  try {
    const data = await fetch(`${API}/stock/indices`).then(r => r.json());
    const ticker = document.getElementById('indices-ticker');

    const items = data.map(idx => {
      const up   = idx.changePercent >= 0;
      const sign = up ? '+' : '';
      const cls  = up ? 'up' : 'down';
      return `<span class="index-chip">
        <span class="index-chip__label">${idx.label}</span>
        <span class="index-chip__price">${fmtPrice(idx.price, idx.symbol)}</span>
        <span class="index-chip__chg ${cls}">${sign}${idx.changePercent?.toFixed(2)}%</span>
      </span>`;
    }).join('');

    // Duplicate the items for seamless infinite scroll
    ticker.innerHTML = `<div class="ticker-track">${items}${items}</div>`;

    // Market status from first equity
    const eq = data.find(d => d.symbol === '^GSPC');
    if (eq) {
      const statusEl = document.getElementById('market-status');
      const s = eq.marketState?.toUpperCase() || 'UNKNOWN';
      statusEl.textContent = s;
      statusEl.className = 'topbar__market-status ' +
        (s === 'REGULAR' ? 'open' : s.includes('PRE') ? 'pre' : s.includes('POST') ? 'post' : 'closed');
    }
  } catch { /* silent fail */ }
}

function fmtPrice(price, symbol) {
  if (!price) return '—';
  if (symbol === 'BTC-USD') return '$' + Number(price).toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (symbol === '^VIX' || symbol === '^TNX') return price.toFixed(2);
  return '$' + price.toFixed(2);
}

loadIndices();
setInterval(loadIndices, 60_000);

// ── Status bar ────────────────────────────────────────────────────────────────
export function setStatus(msg) {
  document.getElementById('status-msg').textContent = msg;
  const t = new Date();
  document.getElementById('status-updated').textContent =
    `LAST UPDATED: ${t.toLocaleTimeString('en-US', { hour12: false })}`;
}

// ── Number formatters (shared across modules) ─────────────────────────────────
export function fmt$(n) {
  if (n == null) return '—';
  if (Math.abs(n) >= 1e12) return '$' + (n/1e12).toFixed(2) + 'T';
  if (Math.abs(n) >= 1e9)  return '$' + (n/1e9).toFixed(2)  + 'B';
  if (Math.abs(n) >= 1e6)  return '$' + (n/1e6).toFixed(2)  + 'M';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export function fmtNum(n, dec = 2) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}
export function fmtPct(n) {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}
export function fmtVol(n) {
  if (n == null) return '—';
  if (n >= 1e9) return (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n/1e3).toFixed(1) + 'K';
  return String(n);
}

// ── Init all panels ───────────────────────────────────────────────────────────
initStockLookup();
initMonteCarlo();
initCompound();
initCorrelation();
initNews();
initFed();
initSupplyChain();
initCrypto();
// Shipping is lazily initialized on first click (see sidebar click handler)
