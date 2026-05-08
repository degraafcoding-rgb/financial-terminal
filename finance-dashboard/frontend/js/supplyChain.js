import { API, setStatus, fmt$ } from './app.js';

// ── State ─────────────────────────────────────────────────────────────────────
let currentTicker = null;
let currentData = null;
let currentView = 'table';

// ── Init ─────────────────────────────────────────────────────────────────────
export function initSupplyChain() {
  const btn   = document.getElementById('sc-search-btn');
  const input = document.getElementById('sc-search-input');

  btn.addEventListener('click', () => doLookup(input.value.trim()));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doLookup(input.value.trim()); });

  // Quick-pick buttons
  document.querySelectorAll('.sc-quickpick').forEach(b => {
    b.addEventListener('click', () => {
      input.value = b.dataset.ticker;
      doLookup(b.dataset.ticker);
    });
  });

  // Toggle buttons
  document.querySelectorAll('#sc-view-toggles .range-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('#sc-view-toggles .range-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentView = btn.dataset.view;
      updateView();
    });
  });

  // Handle resize for canvas
  window.addEventListener('resize', () => {
    if (currentView === 'graph' && currentData) {
      drawGraph(currentData);
    }
  });
}

// ── Lookup ────────────────────────────────────────────────────────────────────
async function doLookup(ticker) {
  if (!ticker) return;
  ticker = ticker.toUpperCase();
  if (ticker === currentTicker) return;
  currentTicker = ticker;

  setStatus(`FETCHING SUPPLY CHAIN FOR ${ticker}…`);
  showState('loading');

  try {
    const data = await fetch(`${API}/supplychain/${ticker}`).then(r => r.json());
    if (data.error) throw new Error(data.error);
    currentData = data;
    renderChain(data);
    showState('result');
    setStatus(`SUPPLY CHAIN: ${data.company || ticker}`);
    updateView();
  } catch (err) {
    document.getElementById('sc-error-msg').textContent = err.message;
    showState('error');
    setStatus('ERROR');
  }
}

function showState(state) {
  document.getElementById('sc-empty').hidden   = state !== 'empty';
  document.getElementById('sc-loading').hidden = state !== 'loading';
  document.getElementById('sc-result').hidden  = state !== 'result';
  document.getElementById('sc-error').hidden   = state !== 'error';
}

function updateView() {
  const tableView = document.getElementById('sc-table-view');
  const graphView = document.getElementById('sc-graph-view');
  if (!tableView || !graphView) return;
  
  if (currentView === 'table') {
    tableView.hidden = false;
    graphView.hidden = true;
  } else {
    tableView.hidden = true;
    graphView.hidden = false;
    if (currentData) {
      // Small delay to ensure display:block has applied before reading dimensions
      setTimeout(() => drawGraph(currentData), 10);
    }
  }
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderChain(data) {
  const ticker   = data.ticker;
  const company  = data.company || ticker;
  const suppliers = data.suppliers || [];
  const customers = data.customers || [];

  // Header summary
  const supTotal = suppliers.reduce((s, x) => s + (x.estAnnualB || 0), 0);
  const cusTotal = customers.reduce((s, x) => s + (x.estAnnualB || 0), 0);

  document.getElementById('sc-company-name').textContent = company;
  document.getElementById('sc-ticker-badge').textContent = ticker;
  document.getElementById('sc-sup-total').textContent = `$${supTotal.toFixed(1)}B est./yr`;
  document.getElementById('sc-cus-total').textContent = `$${cusTotal.toFixed(1)}B est./yr`;

  // Supplier table
  renderTable('sc-suppliers-tbody', suppliers, 'supplier', ticker);
  // Customer table
  renderTable('sc-customers-tbody', customers, 'customer', ticker);

  // Donut charts
  drawDonut('sc-sup-donut', suppliers, 'supplier');
  drawDonut('sc-cus-donut', customers, 'customer');
}

function renderTable(tbodyId, rows, side, focusTicker) {
  const tbody = document.getElementById(tbodyId);
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="sc-empty-row">No data available</td></tr>`;
    return;
  }

  const maxVal = Math.max(...rows.map(r => r.estAnnualB || 0));

  tbody.innerHTML = rows.map((row, i) => {
    const pct   = maxVal > 0 ? ((row.estAnnualB / maxVal) * 100).toFixed(0) : 0;
    const color = side === 'supplier' ? 'var(--blue)' : 'var(--green)';
    const rank  = i + 1;
    return `
      <tr class="sc-row" data-ticker="${row.ticker}">
        <td class="sc-rank">${rank}</td>
        <td class="sc-cell-ticker">
          <span class="sc-ticker">${row.ticker}</span>
          <span class="sc-name">${row.name}</span>
        </td>
        <td class="sc-cell-cat">
          <span class="sc-badge">${row.category}</span>
        </td>
        <td class="sc-cell-val">
          <div class="sc-bar-wrap">
            <div class="sc-bar" style="width:${pct}%; background:${color};"></div>
          </div>
          <span class="sc-val-label">$${(row.estAnnualB).toFixed(1)}B / yr</span>
        </td>
        <td class="sc-cell-note">${row.note || ''}</td>
      </tr>
    `;
  }).join('');
}

// ── Donut Chart ───────────────────────────────────────────────────────────────
const donutInstances = {};

function drawDonut(canvasId, rows, side) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (donutInstances[canvasId]) {
    donutInstances[canvasId].destroy();
  }

  const palette = side === 'supplier'
    ? ['#4dabf7','#74c0fc','#a5d8ff','#339af0','#228be6','#1c7ed6','#1971c2','#1864ab']
    : ['#00c853','#20d068','#40d87d','#60e092','#80e8a7','#00a846','#008c3b','#007030'];

  const labels = rows.map(r => r.ticker);
  const vals   = rows.map(r => r.estAnnualB || 0);

  donutInstances[canvasId] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: vals,
        backgroundColor: rows.map((_, i) => palette[i % palette.length]),
        borderWidth: 0,
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1e1e26',
          borderColor: '#2a2a35',
          borderWidth: 1,
          titleColor: '#e2e2e8',
          bodyColor: '#7a7a90',
          callbacks: {
            label: ctx => ` $${ctx.raw.toFixed(1)}B / yr`
          }
        }
      }
    }
  });
}

// ── Canvas Graph View ────────────────────────────────────────────────────────
function drawGraph(data) {
  const canvas = document.getElementById('sc-graph-canvas');
  if (!canvas) return;

  const container = canvas.parentElement;
  canvas.width = container.clientWidth;
  canvas.height = container.clientHeight;
  const ctx = canvas.getContext('2d');
  
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  
  const suppliers = data.suppliers || [];
  const customers = data.customers || [];

  // Draw lines
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';

  const drawConnections = (nodes, xOffset) => {
    const startY = cy - ((nodes.length - 1) * 35) / 2;
    nodes.forEach((node, i) => {
      const nx = cx + xOffset;
      const ny = startY + i * 35;
      
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      // Cubic bezier for smooth curve
      const cp1x = cx + (xOffset / 2);
      const cp2x = cx + (xOffset / 2);
      ctx.bezierCurveTo(cp1x, cy, cp2x, ny, nx, ny);
      ctx.stroke();
      
      node.x = nx;
      node.y = ny;
    });
  };

  drawConnections(suppliers, -300);
  drawConnections(customers, 300);

  // Draw Center Node
  const drawNode = (x, y, text, color, width, subtext) => {
    ctx.fillStyle = '#1e1e26';
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    
    // Node background
    ctx.beginPath();
    ctx.roundRect(x - width/2, y - 15, width, 30, 4);
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = '#e2e2e8';
    ctx.font = 'bold 11px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x, y - (subtext ? 4 : 0));
    
    if (subtext) {
      ctx.fillStyle = color;
      ctx.font = '9px "Inter", sans-serif';
      ctx.fillText(subtext, x, y + 8);
    }
  };

  drawNode(cx, cy, data.ticker, '#ff8c00', 120, data.company);

  // Draw Supplier Nodes
  suppliers.forEach(s => {
    drawNode(s.x, s.y, s.ticker, '#4dabf7', 100, `$${s.estAnnualB.toFixed(1)}B`);
  });

  // Draw Customer Nodes
  customers.forEach(c => {
    drawNode(c.x, c.y, c.ticker, '#00c853', 100, `$${c.estAnnualB.toFixed(1)}B`);
  });
}
