import { API, setStatus } from './app.js';

let fedChart = null;
let currentFedRange = '5y';
let fedSeries = null;

export async function initFed() {
  try {
    setStatus('LOADING FED DATA...');
    initializeRangeSelectors();
    await Promise.all([loadFedRates(), loadFedHistory(currentFedRange), loadFedNews()]);
    setStatus('FED DATA LOADED');
  } catch (err) {
    console.error('Failed to load Fed data:', err);
    setStatus('FED DATA ERROR');
  }
}

function initializeRangeSelectors() {
  const btns = document.querySelectorAll('#fed-range-btns .range-btn');
  if (!btns.length) return;
  
  btns.forEach(btn => {
    // Only attach listener once
    if (btn.dataset.initialized) return;
    btn.dataset.initialized = "true";
    
    btn.addEventListener('click', async (e) => {
      btns.forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFedRange = e.target.dataset.range;
      
      setStatus('UPDATING FED CHART...');
      await loadFedHistory(currentFedRange);
      setStatus('FED CHART UPDATED');
    });
  });
}

async function loadFedRates() {
  const data = await fetch(`${API}/fed/rates`).then(r => r.json());
  
  if (data.rates) {
    // Populate snapshot
    document.getElementById('fed-latest-date').textContent = data.latestDecision;
    document.getElementById('fed-next-date').textContent = data.nextDecision;
    
    if (data.official && data.official.rate) {
      document.getElementById('fed-target-rate').textContent = `${data.official.targetFrom.toFixed(2)} - ${data.official.targetTo.toFixed(2)}%`;
      document.getElementById('fed-effr-rate').textContent = data.official.rate.toFixed(2) + '%';
      document.getElementById('fed-discount-rate').textContent = (data.official.rate + 0.1).toFixed(2) + '%';
    } else {
      // Fallback
      document.getElementById('fed-target-rate').textContent = 'UNAVAILABLE';
      document.getElementById('fed-effr-rate').textContent = 'UNAVAILABLE';
    }

    // Populate yield curve table
    const table = document.getElementById('fed-rates-table');
    table.innerHTML = data.rates.map(r => {
      const isUp = r.change >= 0;
      const colorCls = isUp ? 'up' : 'down';
      return `
        <div class="fed-row">
          <span class="fed-label">${r.label}</span>
          <span class="fed-val">${r.rate.toFixed(2)}% <span class="index-chip__chg ${colorCls}" style="margin-left: 8px;">${isUp ? '+' : ''}${r.change.toFixed(2)}</span></span>
        </div>
      `;
    }).join('');
  }
}

async function loadFedNews() {
  try {
    const data = await fetch(`${API}/fed/news`).then(r => r.json());
    const container = document.getElementById('fed-news-container');
    if (!data || !data.length) {
      container.innerHTML = '<div class="fed-loading">No recent FOMC news found.</div>';
      return;
    }
    
    container.innerHTML = data.map(n => {
      const escapedSummary = (n.summary || 'No summary available.').replace(/"/g, '&quot;');
      return `
        <div class="news-item" style="padding: 10px 0; border-bottom: 1px solid var(--border-2);">
          <a href="${n.url}" target="_blank" class="news-item__headline" style="font-size: 0.8rem; display: block; margin-bottom: 4px;" title="${escapedSummary}">${n.headline}</a>
          <div class="news-item__meta" style="font-size: 0.7rem; color: var(--text-faint);">
            <span>${n.source}</span>
            <span>${new Date(n.time).toLocaleString()}</span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    document.getElementById('fed-news-container').innerHTML = '<div class="fed-loading">Failed to load news.</div>';
  }
}

async function loadFedHistory(range = '5y') {
  const data = await fetch(`${API}/fed/history?range=${range}`).then(r => r.json());
  if (!data || !data.length) return;

  const container = document.getElementById('fed-chart-container');
  
  if (!fedChart) {
    fedChart = LightweightCharts.createChart(container, {
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

  // Ensure chart renders inside active/visible container
  setTimeout(() => {
    if (fedSeries) {
      fedChart.removeSeries(fedSeries);
    }
    
    fedSeries = fedChart.addAreaSeries({
      lineColor: 'rgba(255, 153, 0, 1)',
      topColor: 'rgba(255, 153, 0, 0.4)',
      bottomColor: 'rgba(255, 153, 0, 0.0)',
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

    fedSeries.setData(chartData);
    fedChart.timeScale().fitContent();
  }, 100);
}
