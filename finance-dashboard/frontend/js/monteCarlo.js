import { setStatus, fmt$, fmtNum } from './app.js';

let mcChart    = null;
let mcHistChart = null;

export function initMonteCarlo() {
  document.getElementById('mc-run-btn').addEventListener('click', runSimulation);
}

// ── Box-Muller transform — normally distributed random number ─────────────────
function randn() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function runSimulation() {
  const initial  = parseFloat(document.getElementById('mc-initial').value)       || 10000;
  const contrib  = parseFloat(document.getElementById('mc-annual-contrib').value) || 0;
  const mu       = parseFloat(document.getElementById('mc-return').value) / 100;
  const sigma    = parseFloat(document.getElementById('mc-vol').value)    / 100;
  const years    = parseInt(document.getElementById('mc-years').value)    || 20;
  const numSims  = Math.min(parseInt(document.getElementById('mc-sims').value) || 500, 5000);

  setStatus('RUNNING MONTE CARLO…');
  const btn = document.getElementById('mc-run-btn');
  btn.disabled = true;
  btn.textContent = '⏳ SIMULATING…';

  // Small timeout lets the UI repaint before the heavy computation
  setTimeout(() => {
    const dt = 1;    // 1 year per step
    const paths = [];
    const finalValues = [];

    for (let s = 0; s < numSims; s++) {
      const path = [initial];
      let val = initial;
      for (let t = 0; t < years; t++) {
        const z   = randn();
        const ret = Math.exp((mu - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z);
        val = val * ret + contrib;
        path.push(val);
      }
      paths.push(path);
      finalValues.push(val);
    }

    finalValues.sort((a, b) => a - b);
    const p10  = finalValues[Math.floor(numSims * 0.10)];
    const p25  = finalValues[Math.floor(numSims * 0.25)];
    const p50  = finalValues[Math.floor(numSims * 0.50)];
    const p75  = finalValues[Math.floor(numSims * 0.75)];
    const p90  = finalValues[Math.floor(numSims * 0.90)];
    const mean = finalValues.reduce((a, b) => a + b, 0) / numSims;
    const probProfit = finalValues.filter(v => v > initial).length / numSims * 100;
    const totalContrib = initial + contrib * years;

    renderStats({ p10, p25, p50, p75, p90, mean, probProfit, initial, totalContrib, years, numSims });
    renderPaths(paths, years, numSims);
    renderHistogram(finalValues, p10, p50, p90, initial);

    btn.disabled = false;
    btn.textContent = '▶ RUN SIMULATION';
    setStatus(`MONTE CARLO COMPLETE — ${numSims.toLocaleString()} PATHS`);
  }, 30);
}

function renderStats({ p10, p25, p50, p75, p90, mean, probProfit, initial, totalContrib, years, numSims }) {
  const statsEl = document.getElementById('mc-stats');
  const row = (label, val, cls = '') =>
    `<div class="result-row">
       <span class="result-row__label">${label}</span>
       <span class="result-row__val ${cls}">${val}</span>
     </div>`;

  statsEl.innerHTML =
    row('SIMULATIONS RUN',      numSims.toLocaleString(),     'orange') +
    row('TIME HORIZON',         `${years} YEARS`,             'orange') +
    row('TOTAL CONTRIBUTED',    fmt$(totalContrib)) +
    row('─────────────────────────', '──────────────', '') +
    row('WORST CASE  (10th %)',  fmt$(p10),  p10 > totalContrib ? 'green' : 'red') +
    row('PESSIMISTIC (25th %)',  fmt$(p25),  p25 > totalContrib ? 'green' : 'red') +
    row('MEDIAN OUTCOME (50th%)',fmt$(p50),  p50 > totalContrib ? 'green' : 'red') +
    row('OPTIMISTIC (75th %)',   fmt$(p75),  'green') +
    row('BEST CASE  (90th %)',   fmt$(p90),  'green') +
    row('MEAN FINAL VALUE',      fmt$(mean), mean > totalContrib ? 'green' : 'red') +
    row('PROB. OF PROFIT',       `${probProfit.toFixed(1)}%`, probProfit >= 50 ? 'green' : 'red');

  document.getElementById('mc-results').hidden = false;
}

function renderPaths(paths, years, numSims) {
  const labels = Array.from({ length: years + 1 }, (_, i) => `Y${i}`);

  // Show up to 200 paths for perf, thin styling
  const displayed = paths.slice(0, Math.min(numSims, 200));

  const ctx = document.getElementById('mc-chart').getContext('2d');
  if (mcChart) mcChart.destroy();

  mcChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: displayed.map((path, i) => ({
        data: path,
        borderColor: `rgba(255,140,0,0.08)`,
        borderWidth: 1,
        pointRadius: 0,
        fill: false,
        tension: 0.2,
      }))
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
      scales: {
        x: { ticks: { color: '#44445a', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: '#1e1e26' } },
        y: {
          position: 'right',
          ticks: {
            color: '#7a7a90',
            font: { family: 'JetBrains Mono', size: 10 },
            callback: v => {
              if (v >= 1e6) return '$' + (v/1e6).toFixed(1) + 'M';
              if (v >= 1e3) return '$' + (v/1e3).toFixed(0) + 'K';
              return '$' + v;
            }
          },
          grid: { color: '#1e1e26' }
        }
      }
    }
  });

  document.getElementById('mc-chart-box').hidden = false;
}

function renderHistogram(finalValues, p10, p50, p90, initial) {
  const min  = finalValues[0];
  const max  = finalValues[finalValues.length - 1];
  const bins = 40;
  const step = (max - min) / bins;
  const counts = new Array(bins).fill(0);

  finalValues.forEach(v => {
    const bin = Math.min(Math.floor((v - min) / step), bins - 1);
    counts[bin]++;
  });

  const labels = counts.map((_, i) => {
    const v = min + i * step;
    return v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : `$${(v/1e3).toFixed(0)}K`;
  });

  const colors = counts.map((_, i) => {
    const v = min + i * step;
    if (v < initial) return 'rgba(255,59,48,0.6)';
    if (v < p50)     return 'rgba(255,140,0,0.5)';
    return 'rgba(0,200,83,0.6)';
  });

  const ctx = document.getElementById('mc-hist-chart').getContext('2d');
  if (mcHistChart) mcHistChart.destroy();

  mcHistChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data: counts, backgroundColor: colors, borderWidth: 0 }]
    },
    options: {
      responsive: true,
      animation: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#17171d',
          borderColor: '#2a2a35',
          borderWidth: 1,
          titleColor: '#7a7a90',
          bodyColor: '#e2e2e8',
          callbacks: {
            title: ctx => ctx[0].label,
            label: ctx => ` ${ctx.raw} simulations`,
          }
        }
      },
      scales: {
        x: { ticks: { color: '#44445a', font: { size: 9 }, maxRotation: 45, maxTicksLimit: 15 }, grid: { color: '#1e1e26' } },
        y: { ticks: { color: '#7a7a90', font: { size: 10 } }, grid: { color: '#1e1e26' } }
      }
    }
  });

  document.getElementById('mc-hist-box').hidden = false;
}
