import { setStatus, fmt$, fmtNum, fmtPct } from './app.js';

let ciChart = null;

export function initCompound() {
  document.getElementById('ci-calc-btn').addEventListener('click', calculate);
}

function calculate() {
  const P     = parseFloat(document.getElementById('ci-principal').value)  || 0;
  const r     = parseFloat(document.getElementById('ci-rate').value)       / 100;
  const n     = parseInt(document.getElementById('ci-freq').value)         || 12;
  const pmt   = parseFloat(document.getElementById('ci-contrib').value)    || 0;
  const years = parseInt(document.getElementById('ci-years').value)        || 20;

  if (r <= 0) { alert('Interest rate must be > 0'); return; }

  const yearLabels = [];
  const balances   = [];
  const contributed = [];
  const interest   = [];
  const rows       = [];

  let balance = P;
  let totalContrib = P;

  for (let y = 1; y <= years; y++) {
    const prev     = y === 1 ? P : balances[y - 2];
    // Compound formula with monthly contributions
    const newBal   = prev * Math.pow(1 + r / n, n) + pmt * 12 * ((Math.pow(1 + r / n, n) - 1) / (r / n));
    totalContrib  += pmt * 12;
    const totalInt = newBal - totalContrib;

    yearLabels.push(`Y${y}`);
    balances.push(newBal);
    contributed.push(totalContrib);
    interest.push(Math.max(0, totalInt));
    rows.push({ year: y, balance: newBal, contrib: totalContrib, intEarned: Math.max(0, totalInt) });

    balance = newBal;
  }

  const finalBalance   = balances[years - 1];
  const finalContrib   = contributed[years - 1];
  const finalInterest  = interest[years - 1];
  const totalReturn    = ((finalBalance - P) / P * 100);

  renderStats({ P, finalBalance, finalContrib, finalInterest, totalReturn, r, n, pmt, years });
  renderChart(yearLabels, balances, contributed, interest);
  renderTable(rows);

  setStatus(`COMPOUND INTEREST CALCULATED — ${years} YEARS`);
}

function renderStats({ P, finalBalance, finalContrib, finalInterest, totalReturn, r, n, pmt, years }) {
  const row = (label, val, cls = '') =>
    `<div class="result-row">
       <span class="result-row__label">${label}</span>
       <span class="result-row__val ${cls}">${val}</span>
     </div>`;

  const freqLabel = { 365:'DAILY', 52:'WEEKLY', 12:'MONTHLY', 4:'QUARTERLY', 2:'SEMI-ANNUAL', 1:'ANNUAL' }[n] || n;

  document.getElementById('ci-stats').innerHTML =
    row('INITIAL PRINCIPAL',      fmt$(Number(document.getElementById('ci-principal').value))) +
    row('MONTHLY CONTRIBUTION',   fmt$(Number(document.getElementById('ci-contrib').value))) +
    row('ANNUAL RATE',            `${(r*100).toFixed(2)}%  (${freqLabel} COMPOUNDING)`) +
    row('TIME PERIOD',            `${years} YEARS`) +
    row('─────────────────────────', '──────────────', '') +
    row('TOTAL CONTRIBUTED',      fmt$(finalContrib)) +
    row('TOTAL INTEREST EARNED',  fmt$(finalInterest), 'green') +
    row('FINAL BALANCE',          fmt$(finalBalance),  'orange') +
    row('TOTAL RETURN',           `+${fmtNum(totalReturn)}%`, 'green') +
    row('EFFECTIVE ANNUAL RATE',  `${(((1 + r/n)**n - 1)*100).toFixed(4)}%`);

  document.getElementById('ci-results').hidden = false;
}

function renderChart(labels, balances, contributed, interest) {
  const ctx = document.getElementById('ci-chart').getContext('2d');
  if (ciChart) ciChart.destroy();

  ciChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'CONTRIBUTED',
          data: contributed,
          backgroundColor: 'rgba(77,171,247,0.5)',
          borderColor: 'rgba(77,171,247,0.8)',
          borderWidth: 1,
          stack: 'a',
        },
        {
          label: 'INTEREST',
          data: interest,
          backgroundColor: 'rgba(0,200,83,0.55)',
          borderColor: 'rgba(0,200,83,0.8)',
          borderWidth: 1,
          stack: 'a',
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#7a7a90', font: { family: 'JetBrains Mono', size: 10 }, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: '#17171d', borderColor: '#2a2a35', borderWidth: 1,
          titleColor: '#7a7a90', bodyColor: '#e2e2e8',
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${fmt$(ctx.raw)}`
          }
        }
      },
      scales: {
        x: { stacked: true, ticks: { color: '#44445a', font: { family: 'JetBrains Mono', size: 10 }, maxTicksLimit: 15 }, grid: { color: '#1e1e26' } },
        y: {
          stacked: true,
          position: 'right',
          ticks: {
            color: '#7a7a90', font: { family: 'JetBrains Mono', size: 10 },
            callback: v => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(0)}K` : `$${v}`
          },
          grid: { color: '#1e1e26' }
        }
      }
    }
  });

  document.getElementById('ci-chart-box').hidden = false;
}

function renderTable(rows) {
  const tbody = document.getElementById('ci-tbody');
  tbody.innerHTML = rows.map(r => {
    const ret = ((r.balance - r.contrib) / (r.contrib || 1) * 100);
    return `<tr>
      <td>YEAR ${r.year}</td>
      <td>${fmt$(r.balance)}</td>
      <td>${fmt$(r.contrib)}</td>
      <td style="color:var(--green)">${fmt$(r.intEarned)}</td>
      <td style="color:var(--green)">+${fmtNum(ret)}%</td>
    </tr>`;
  }).join('');
  document.getElementById('ci-table-box').hidden = false;
}
