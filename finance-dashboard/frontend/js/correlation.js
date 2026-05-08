import { API, setStatus } from './app.js';

export function initCorrelation() {
  document.getElementById('corr-run-btn').addEventListener('click', computeMatrix);
}

async function computeMatrix() {
  const raw     = document.getElementById('corr-tickers').value;
  const tickers = raw.split(/[,\s]+/).map(t => t.trim().toUpperCase()).filter(Boolean).slice(0, 8);

  if (tickers.length < 2) {
    alert('Enter at least 2 ticker symbols.');
    return;
  }

  document.getElementById('corr-result').hidden = true;
  document.getElementById('corr-error').hidden  = true;
  document.getElementById('corr-loading').hidden = false;
  setStatus(`FETCHING HISTORY FOR ${tickers.join(', ')}…`);

  try {
    // Fetch 1-year history for all tickers in parallel
    const histories = await Promise.all(
      tickers.map(t =>
        fetch(`${API}/stock/${t}/history?range=1y`)
          .then(r => r.json())
          .catch(() => [])
      )
    );

    // Compute daily returns for each ticker
    const returns = histories.map(rows => {
      if (!Array.isArray(rows) || rows.length < 2) return [];
      const closes = rows.map(r => r.close).filter(v => v != null);
      const ret = [];
      for (let i = 1; i < closes.length; i++) {
        ret.push((closes[i] - closes[i - 1]) / closes[i - 1]);
      }
      return ret;
    });

    // Pearson correlation between two return series
    function pearson(a, b) {
      const len = Math.min(a.length, b.length);
      if (len < 5) return null;
      const ax = a.slice(-len), bx = b.slice(-len);
      const meanA = ax.reduce((s, v) => s + v, 0) / len;
      const meanB = bx.reduce((s, v) => s + v, 0) / len;
      let num = 0, da = 0, db = 0;
      for (let i = 0; i < len; i++) {
        const dA = ax[i] - meanA, dB = bx[i] - meanB;
        num += dA * dB; da += dA * dA; db += dB * dB;
      }
      if (da === 0 || db === 0) return null;
      return num / Math.sqrt(da * db);
    }

    // Build NxN matrix
    const matrix = tickers.map((_, i) =>
      tickers.map((_, j) => pearson(returns[i], returns[j]))
    );

    renderMatrix(tickers, matrix);
    document.getElementById('corr-loading').hidden = true;
    document.getElementById('corr-result').hidden  = false;
    setStatus(`CORRELATION MATRIX — ${tickers.join(', ')}`);
  } catch (err) {
    document.getElementById('corr-loading').hidden = true;
    document.getElementById('corr-error').hidden   = false;
    document.getElementById('corr-error-msg').textContent = err.message;
    setStatus('CORRELATION ERROR');
  }
}

function corrColor(v) {
  if (v === null) return 'rgba(30,30,38,1)';
  // Map -1…+1 → red…green
  if (v >= 0.9) return 'rgba(0,200,83,0.85)';
  if (v >= 0.7) return 'rgba(0,200,83,0.55)';
  if (v >= 0.5) return 'rgba(0,200,83,0.30)';
  if (v >= 0.2) return 'rgba(0,200,83,0.12)';
  if (v >= -0.2) return 'rgba(60,60,80,0.4)';
  if (v >= -0.5) return 'rgba(255,59,48,0.15)';
  if (v >= -0.7) return 'rgba(255,59,48,0.35)';
  return 'rgba(255,59,48,0.65)';
}

function textColor(v) {
  if (v === null) return '#44445a';
  if (Math.abs(v) > 0.6) return '#fff';
  return '#e2e2e8';
}

function renderMatrix(tickers, matrix) {
  const n = tickers.length;

  let html = '<div class="corr-matrix-wrap"><table class="corr-matrix-table"><thead><tr><th></th>';
  tickers.forEach(t => { html += `<th>${t}</th>`; });
  html += '</tr></thead><tbody>';

  for (let i = 0; i < n; i++) {
    html += `<tr><th>${tickers[i]}</th>`;
    for (let j = 0; j < n; j++) {
      const v   = matrix[i][j];
      const bg  = corrColor(v);
      const fg  = textColor(v);
      const isDiag = i === j;

      html += `<td style="background:${bg}">
        <div class="corr-cell" style="color:${fg}">
          ${isDiag
            ? `<span class="corr-cell__diag">SELF</span>`
            : `<span class="corr-cell__val">${v !== null ? v.toFixed(3) : 'N/A'}</span>`
          }
        </div>
      </td>`;
    }
    html += '</tr>';
  }

  html += '</tbody></table></div>';
  document.getElementById('corr-matrix').innerHTML = html;
}
