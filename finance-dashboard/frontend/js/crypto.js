import { API, setStatus, fmt$, fmtPct } from './app.js';

let cryptoChart = null;
let currentCryptoTicker = 'BTC-USD';
let currentCryptoRange = '1y';
let cryptoSeries = null;

export async function initCrypto() {
  try {
    setStatus('LOADING CRYPTO DATA...');
    initializeRangeSelectors();
    await Promise.all([
      loadCryptoQuotes(),
      loadCryptoNews(),
      loadCryptoHistory(currentCryptoTicker, currentCryptoRange)
    ]);
    setStatus('CRYPTO DATA LOADED');

    // Auto refresh quotes and news every minute
    setInterval(loadCryptoQuotes, 60_000);
    setInterval(loadCryptoNews, 120_000);
  } catch (err) {
    console.error('Failed to load Crypto data:', err);
    setStatus('CRYPTO DATA ERROR');
  }
}

function initializeRangeSelectors() {
  const btns = document.querySelectorAll('#crypto-range-btns .range-btn');
  if (!btns.length) return;
  
  btns.forEach(btn => {
    if (btn.dataset.initialized) return;
    btn.dataset.initialized = "true";
    
    btn.addEventListener('click', async (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentCryptoRange = e.target.dataset.range;
      
      setStatus('UPDATING CRYPTO CHART...');
      await loadCryptoHistory(currentCryptoTicker, currentCryptoRange);
      setStatus('CRYPTO CHART UPDATED');
    });
  });
}

async function loadCryptoQuotes() {
  try {
    const data = await fetch(`${API}/crypto/quotes`).then(r => r.json());
    if (!data || data.length === 0) return;
    
    const tbody = document.getElementById('crypto-tbody');
    tbody.innerHTML = data.map(c => {
      const isUp = c.changePercent >= 0;
      const colorCls = isUp ? 'up' : 'down';
      const sign = isUp ? '+' : '';
      
      return `
        <tr class="crypto-row" data-ticker="${c.symbol}" style="cursor: pointer;">
          <td style="font-weight: bold; color: var(--text-main);">${c.symbol.replace('-USD', '')}</td>
          <td style="text-align:right">${fmt$(c.price)}</td>
          <td style="text-align:right" class="${colorCls}">${sign}${c.changePercent.toFixed(2)}%</td>
          <td style="text-align:right">${fmt$(c.marketCap)}</td>
        </tr>
      `;
    }).join('');

    // Attach click listeners to rows to load chart
    tbody.querySelectorAll('.crypto-row').forEach(row => {
      row.addEventListener('click', async () => {
        const ticker = row.dataset.ticker;
        currentCryptoTicker = ticker;
        document.getElementById('crypto-chart-title').textContent = `${ticker} PRICE HISTORY`;
        setStatus(`LOADING CHART FOR ${ticker}...`);
        await loadCryptoHistory(currentCryptoTicker, currentCryptoRange);
        setStatus(`LOADED CHART FOR ${ticker}`);
      });
    });
  } catch (err) {
    console.error('Error loading crypto quotes:', err);
  }
}

async function loadCryptoNews() {
  try {
    const data = await fetch(`${API}/crypto/news`).then(r => r.json());
    const container = document.getElementById('crypto-news-container');
    if (!data || !data.length) {
      container.innerHTML = '<div class="fed-loading">No recent crypto news found.</div>';
      return;
    }
    
    container.innerHTML = data.map(n => {
      const escapedSummary = (n.summary || '').replace(/"/g, '&quot;');
      const imgHtml = n.image ? `<img src="${n.image}" style="width:100%; height:120px; object-fit:cover; margin-bottom:8px; border-radius:4px;" />` : '';
      return `
        <div class="news-item" style="padding: 15px 0; border-bottom: 1px solid var(--border-2);">
          ${imgHtml}
          <a href="${n.url}" target="_blank" class="news-item__headline" style="font-size: 0.85rem; display: block; margin-bottom: 6px;" title="${escapedSummary}">${n.headline}</a>
          <div class="news-item__meta" style="font-size: 0.75rem; color: var(--text-faint);">
            <span>${n.source}</span>
            <span>${new Date(n.time).toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('crypto-news-container').innerHTML = '<div class="fed-loading">Failed to load news.</div>';
  }
}

async function loadCryptoHistory(ticker, range) {
  try {
    const data = await fetch(`${API}/crypto/history/${ticker}?range=${range}`).then(r => r.json());
    if (!data || !data.length || data.error) return;

    const container = document.getElementById('crypto-chart-container');
    
    if (!cryptoChart) {
      cryptoChart = LightweightCharts.createChart(container, {
        layout: {
          background: { type: 'solid', color: 'transparent' },
          textColor: '#888',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.05)' },
          horzLines: { color: 'rgba(255,255,255,0.05)' },
        },
        rightPriceScale: {
          borderVisible: false,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: true,
        },
        crosshair: {
          mode: LightweightCharts.CrosshairMode.Normal,
        },
        autoSize: true,
      });
    }

    setTimeout(() => {
      if (cryptoSeries) {
        cryptoChart.removeSeries(cryptoSeries);
      }
      
      const isUp = data.length > 0 && data[data.length - 1].close >= data[0].close;
      const lineColor = isUp ? '#00c853' : '#ff3b30';

      cryptoSeries = cryptoChart.addAreaSeries({
        lineColor: lineColor,
        topColor: isUp ? 'rgba(0, 200, 83, 0.4)' : 'rgba(255, 59, 48, 0.4)',
        bottomColor: isUp ? 'rgba(0, 200, 83, 0.0)' : 'rgba(255, 59, 48, 0.0)',
        lineWidth: 2,
      });

      const isIntraday = range === '1d' || range === '5d';
      const seen = new Set();
      const chartData = data.map(r => {
        const d = new Date(r.date);
        let timeVal;
        if (isIntraday) {
          timeVal = Math.floor(d.getTime() / 1000);
        } else {
          timeVal = d.toISOString().split('T')[0];
        }
        return {
          time: timeVal,
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

      cryptoSeries.setData(chartData);
      cryptoChart.timeScale().fitContent();
    }, 50);
  } catch (err) {
    console.error("Error rendering crypto chart:", err);
  }
}
