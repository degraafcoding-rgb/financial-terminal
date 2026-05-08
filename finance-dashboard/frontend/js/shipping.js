import { API, setStatus } from './app.js';

let map = null;
let canvas = null;        // Leaflet canvas renderer
let shipLayerGroup = null;
let weatherLayer   = null;
let currentFilter  = 'All';
let isWeatherOn    = false;
let fleetData      = [];
let initialized    = false;

// Precomputed canvas-based dot markers — much faster than SVG divIcons
function getCircleMarker(color) {
  return { color: color, fillColor: color, fillOpacity: 0.9, radius: 4, weight: 0.5 };
}

// ── Init ──────────────────────────────────────────────────────────────────────
export async function initShipping() {
  // Small delay so the panel is fully visible and has real pixel dimensions
  await new Promise(r => setTimeout(r, 100));

  initMap();
  initToggles();

  setStatus('FETCHING FLEET DATA...');
  await Promise.all([loadFleet(), loadAnalytics()]);
  setStatus('FLEET DATA LOADED');

  // Refresh every 30s
  setInterval(() => {
    if (document.getElementById('panel-shipping').classList.contains('active')) {
      loadFleet();
      loadAnalytics();
    }
  }, 30000);
}

// ── Map initialization ────────────────────────────────────────────────────────
function initMap() {
  // Use Leaflet's Canvas renderer for fast hardware-accelerated drawing
  canvas = L.canvas({ padding: 0.5 });

  map = L.map('shipping-map', {
    center: [20, 0],
    zoom: 2,
    zoomControl: false,
    preferCanvas: true,   // Use Canvas, not SVG
    renderer: canvas
  });

  L.control.zoom({ position: 'bottomright' }).addTo(map);

  // CartoDB Dark Matter — best looking dark tiles
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OSM © CARTO',
    subdomains: 'abcd',
    maxZoom: 18,
    updateWhenIdle: true,  // Don't re-fetch tiles while panning (performance)
    keepBuffer: 2
  }).addTo(map);

  shipLayerGroup = L.layerGroup().addTo(map);

  // Weather overlay (OpenWeatherMap precipitation)
  weatherLayer = L.tileLayer(
    'https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=9de243494c0b295cca9337e1e96b00e2',
    { opacity: 0.5, zIndex: 500 }
  );

  // Invalidate size when container becomes visible
  const observer = new ResizeObserver(() => map && map.invalidateSize());
  observer.observe(document.getElementById('shipping-map'));

  // Refresh viewport on pan/zoom (only render visible ships)
  map.on('moveend', () => renderMarkers());
}

// ── Load fleet from backend ───────────────────────────────────────────────────
async function loadFleet() {
  try {
    const data = await fetch(`${API}/shipping/fleet`).then(r => r.json());
    fleetData = data;
    renderMarkers();
  } catch (err) {
    console.error('[Shipping] Fleet error:', err);
  }
}

// ── Render markers using Canvas CircleMarkers (fastest approach) ───────────────
function renderMarkers() {
  if (!map || !shipLayerGroup) return;
  shipLayerGroup.clearLayers();

  const bounds = map.getBounds().pad(0.1); // small padding for smooth scroll

  let count = 0;
  for (const ship of fleetData) {
    // Skip ships not in viewport (huge perf win)
    if (!bounds.contains([ship.lat, ship.lng])) continue;
    // Skip filtered types
    if (currentFilter !== 'All' && ship.type !== currentFilter) continue;

    const opts = getCircleMarker(ship.color || '#aaaaaa');
    const marker = L.circleMarker([ship.lat, ship.lng], {
      ...opts,
      renderer: canvas  // Force canvas renderer per marker
    });

    // Build hover popup
    marker.bindTooltip(
      `<strong style="color:${ship.color}">${ship.name}</strong><br/>
       Type: ${ship.type}<br/>
       Speed: ${ship.speed} kn | Heading: ${ship.heading}°<br/>
       Status: ${ship.status}<br/>
       Destination: ${ship.destination}`,
      { sticky: true, className: 'ship-tooltip' }
    );

    shipLayerGroup.addLayer(marker);
    count++;
  }
}

// ── Analytics ─────────────────────────────────────────────────────────────────
async function loadAnalytics() {
  try {
    const data = await fetch(`${API}/shipping/analytics`).then(r => r.json());

    // Update live indicator
    const badge = data.liveData
      ? '<span style="color:var(--green);font-size:0.7rem;">● LIVE AIS</span>'
      : '<span style="color:var(--text-muted);font-size:0.7rem;">○ DEMO MODE — add AIS key for live data</span>';

    document.getElementById('shipping-counts').innerHTML = `
      <div style="margin-bottom:6px;">${badge}</div>
      <div class="fed-row"><span class="fed-label">Total Tracked</span><span class="fed-val">${data.totalShips.toLocaleString()}</span></div>
      <div class="fed-row"><span class="fed-label">Anchored / In Port</span><span class="fed-val">${data.anchored}</span></div>
      <div class="fed-divider"></div>
      <div class="fed-row"><span class="fed-label" style="color:#00ffcc">Cargo</span><span class="fed-val">${data.counts.Cargo}</span></div>
      <div class="fed-row"><span class="fed-label" style="color:#ff9900">Tankers</span><span class="fed-val">${data.counts.Tanker}</span></div>
      <div class="fed-row"><span class="fed-label" style="color:#ccccff">Fishing</span><span class="fed-val">${data.counts.Fishing}</span></div>
      <div class="fed-row"><span class="fed-label" style="color:#ff3366">Passenger</span><span class="fed-val">${data.counts.Passenger}</span></div>
    `;

    // Chokepoints
    if (data.activeSlowdowns.length > 0) {
      document.getElementById('shipping-chokepoints').innerHTML = data.activeSlowdowns.map(c => `
        <div class="fed-row">
          <span class="fed-label">${c.name}</span>
          <span class="fed-val" style="color:var(--orange)">+${c.delayHours}h Delay</span>
        </div>
      `).join('');
    } else {
      document.getElementById('shipping-chokepoints').innerHTML = '<div class="fed-loading">All major routes flowing normally.</div>';
    }

    // Storms
    if (data.storms.length > 0) {
      document.getElementById('shipping-storms').innerHTML = data.storms.map(s => `
        <div class="fed-row">
          <span class="fed-label">${s.name}</span>
          <span class="fed-val" style="color:var(--red)">${s.severity} Risk</span>
        </div>
      `).join('');
    } else {
      document.getElementById('shipping-storms').innerHTML = '<div class="fed-loading">No active marine weather alerts.</div>';
    }
  } catch (err) {
    console.error('[Shipping] Analytics error:', err);
  }
}

// ── Toggles ───────────────────────────────────────────────────────────────────
function initToggles() {
  document.querySelectorAll('.shipping-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = e.currentTarget.dataset.type;

      if (e.currentTarget.id === 'toggle-weather') {
        isWeatherOn = !isWeatherOn;
        e.currentTarget.classList.toggle('active', isWeatherOn);
        if (isWeatherOn) map.addLayer(weatherLayer);
        else map.removeLayer(weatherLayer);
        return;
      }

      document.querySelectorAll('.shipping-toggle[data-type]').forEach(b => b.classList.remove('active'));
      e.currentTarget.classList.add('active');
      currentFilter = type;
      renderMarkers();
    });
  });
}
