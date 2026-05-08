import { API, setStatus, fmt$, fmtNum, fmtPct, fmtVol } from './app.js';

let priceChart   = null;
let currentTicker = null;
let currentRange  = '1y';

let currentSeries = null;
let currentChartData = [];
let chartType = 'line';

export function initStockLookup() {
  const input    = document.getElementById('stock-search-input');
  const btn      = document.getElementById('stock-search-btn');
  const dropdown = document.getElementById('search-dropdown');
  const rangeBtns = document.getElementById('range-btns');
  const typeBtns  = document.getElementById('chart-type-btns');

  // ── Search / autocomplete ──────────────────────────────────────────────────
  let debounce;
  input.addEventListener('input', () => {
    clearTimeout(debounce);
    const q = input.value.trim();
    if (q.length < 1) { dropdown.hidden = true; return; }
    debounce = setTimeout(() => fetchSuggestions(q), 280);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { dropdown.hidden = true; lookupTicker(input.value.trim()); }
    if (e.key === 'Escape') { dropdown.hidden = true; }
  });

  btn.addEventListener('click', () => {
    dropdown.hidden = true;
    lookupTicker(input.value.trim());
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('#stock-search-bar')) dropdown.hidden = true;
  });

  // ── Range buttons ──────────────────────────────────────────────────────────
  rangeBtns?.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      rangeBtns.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentRange = btn.dataset.range;
      if (currentTicker) loadHistory(currentTicker, currentRange);
    });
  });

  // ── Type buttons ───────────────────────────────────────────────────────────
  typeBtns?.querySelectorAll('.range-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      typeBtns.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartType = btn.dataset.type;
      if (currentChartData.length > 0) renderPriceChart(currentChartData, currentTicker, currentRange);
    });
  });
}

async function fetchSuggestions(q) {
  const dropdown = document.getElementById('search-dropdown');
  try {
    const res  = await fetch(`${API}/stock/search?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (!data.length) { dropdown.hidden = true; return; }

    dropdown.innerHTML = data.map(r =>
      `<div class="dropdown-item" data-symbol="${r.symbol}">
         <span class="dropdown-item__symbol">${r.symbol}</span>
         <span class="dropdown-item__name">${r.name || ''}</span>
         <span class="dropdown-item__type">${r.type}</span>
       </div>`
    ).join('');

    dropdown.hidden = false;

    dropdown.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const sym = item.dataset.symbol;
        document.getElementById('stock-search-input').value = sym;
        dropdown.hidden = true;
        lookupTicker(sym);
      });
    });
  } catch { dropdown.hidden = true; }
}

async function lookupTicker(ticker) {
  if (!ticker) return;
  ticker = ticker.toUpperCase();
  currentTicker = ticker;
  setStatus(`FETCHING ${ticker}…`);

  document.getElementById('stock-empty').hidden  = true;
  document.getElementById('stock-error').hidden  = true;
  document.getElementById('stock-result').hidden = true;

  try {
    const data = await fetch(`${API}/stock/${ticker}`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    renderQuote(data);
    document.getElementById('stock-result').hidden = false;
    await loadHistory(ticker, currentRange);
    setStatus(`${ticker} LOADED`);
  } catch (err) {
    document.getElementById('stock-error').hidden = false;
    document.getElementById('stock-error-msg').textContent = err.message;
    document.getElementById('stock-empty').hidden = true;
    setStatus('ERROR');
  }
}

function renderQuote(d) {
  const up = d.changePercent >= 0;

  document.getElementById('qc-symbol').textContent  = d.symbol;
  document.getElementById('qc-name').textContent    = d.name || '—';
  document.getElementById('qc-meta').textContent    = `${d.exchange || ''}  ·  ${d.currency || 'USD'}  ·  ${d.marketState || ''}`;
  document.getElementById('qc-price').textContent   = fmt$(d.price);
  const changeEl = document.getElementById('qc-change');
  changeEl.textContent = `${up?'+':''}${fmt$(d.change)}  (${fmtPct(d.changePercent)})`;
  changeEl.className   = `quote-card__change ${up ? 'up' : 'down'}`;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; };
  set('sq-open',      fmt$(d.open));
  set('sq-high',      fmt$(d.high));
  set('sq-low',       fmt$(d.low));
  set('sq-prev',      fmt$(d.prevClose));
  set('sq-vol',       fmtVol(d.volume));
  set('sq-avgvol',    fmtVol(d.avgVolume));
  set('sq-cap',       fmt$(d.marketCap || d.aum));
  set('sq-pe',        d.peRatio ? fmtNum(d.peRatio) : 'N/A');
  set('sq-eps',       d.eps     ? fmt$(d.eps)        : 'N/A');
  set('sq-beta',      d.beta    ? fmtNum(d.beta)      : 'N/A');
  set('sq-52h',       fmt$(d.week52High));
  set('sq-52l',       fmt$(d.week52Low));
  set('sq-div',       d.dividendYield ? fmtPct(d.dividendYield * 100) : 'N/A');
  set('sq-sector',    d.sector   || 'N/A');
  set('sq-exchange',  d.exchange || 'N/A');
  set('sq-employees', d.employees ? Number(d.employees).toLocaleString() : 'N/A');

  const descBox = document.getElementById('description-box');
  if (d.description) {
    document.getElementById('stock-description').textContent = d.description;
    descBox.hidden = false;
  } else {
    descBox.hidden = true;
  }
}

async function loadHistory(ticker, range) {
  try {
    const rows = await fetch(`${API}/stock/${ticker}/history?range=${range}`).then(r => r.json());
    if (!Array.isArray(rows) || !rows.length) return;
    currentChartData = rows;
    renderPriceChart(rows, ticker, range);
  } catch (err) {
    console.error("Error loading or rendering chart:", err);
  }
}

function renderPriceChart(rows, ticker, range) {
  const container = document.getElementById('price-chart-container');
  if (!priceChart) {
    priceChart = LightweightCharts.createChart(container, {
      layout: {
        background: { type: 'solid', color: 'transparent' },
        textColor: '#7a7a90',
        fontFamily: 'JetBrains Mono',
      },
      grid: {
        vertLines: { color: '#1e1e26' },
        horzLines: { color: '#1e1e26' },
      },
      crosshair: {
        mode: LightweightCharts.CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: '#2a2a35',
      },
      timeScale: {
        borderColor: '#2a2a35',
        timeVisible: true,
      },
      autoSize: true,
    });
  }

  if (currentSeries) {
    priceChart.removeSeries(currentSeries);
  }

  // Format data for LightweightCharts
  // LightweightCharts requires time in UNIX timestamp (seconds) if including time, or 'YYYY-MM-DD' string for daily data
  const isIntraday = range === '1d' || range === '5d';
  
  const seen = new Set();
  const chartData = rows.map(r => {
    const d = new Date(r.date);
    let timeVal;
    if (isIntraday) {
      timeVal = Math.floor(d.getTime() / 1000);
    } else {
      // YYYY-MM-DD string for daily data
      timeVal = d.toISOString().split('T')[0];
    }
    return {
      time: timeVal,
      open: r.open,
      high: r.high,
      low: r.low,
      close: r.close,
      value: r.close
    };
  })
  .filter(d => {
    if (seen.has(d.time)) return false;
    seen.add(d.time);
    return true;
  })
  .sort((a, b) => {
    if (typeof a.time === 'string') return a.time.localeCompare(b.time);
    return a.time - b.time;
  });

  const isUp = chartData.length > 0 && chartData[chartData.length - 1].close >= chartData[0].close;
  const lineColor = isUp ? '#00c853' : '#ff3b30';

  if (chartType === 'candle') {
    currentSeries = priceChart.addCandlestickSeries({
      upColor: '#00c853',
      downColor: '#ff3b30',
      borderVisible: false,
      wickUpColor: '#00c853',
      wickDownColor: '#ff3b30',
    });
    currentSeries.setData(chartData);
  } else {
    currentSeries = priceChart.addAreaSeries({
      lineColor: lineColor,
      topColor: isUp ? 'rgba(0, 200, 83, 0.4)' : 'rgba(255, 59, 48, 0.4)',
      bottomColor: isUp ? 'rgba(0, 200, 83, 0.0)' : 'rgba(255, 59, 48, 0.0)',
      lineWidth: 2,
    });
    currentSeries.setData(chartData);
  }
  
  priceChart.timeScale().fitContent();
}
