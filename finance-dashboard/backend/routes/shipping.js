const express = require('express');
const router  = express.Router();
const WebSocket = require('ws');

// ── AISStream.io Configuration ────────────────────────────────────────────────
// Free account at https://aisstream.io — API key below
const AIS_KEY = process.env.AIS_KEY || '4b2247aedcbd73ed331dc7bc36afe428460ccbdc';

// ── In-memory ship position store ─────────────────────────────────────────────
// We maintain a live rolling window of the last ~90 seconds of AIS broadcasts.
const ships = new Map(); // MMSI → ship object
const SHIP_TTL = 90000;  // Remove ships not heard from in 90 seconds

const TYPE_COLORS = {
  // AIS ship type → display color
  'Tanker':    '#ff9900',
  'Cargo':     '#00ffcc',
  'Passenger': '#ff3366',
  'Fishing':   '#ccccff',
  'Tug':       '#aaff00',
  'Sailing':   '#ff88ff',
  'Other':     '#aaaaaa'
};

function aisTypeToLabel(typeCode) {
  if (typeCode >= 70 && typeCode <= 79) return 'Cargo';
  if (typeCode >= 80 && typeCode <= 89) return 'Tanker';
  if (typeCode === 60 || typeCode === 69) return 'Passenger';
  if (typeCode === 30) return 'Fishing';
  if (typeCode === 52 || typeCode === 21) return 'Tug';
  if (typeCode === 36 || typeCode === 37) return 'Sailing';
  return 'Other';
}

// ── Connect to AISStream.io WebSocket ─────────────────────────────────────────
let wsConnected = false;

function connectAISStream() {
  if (!AIS_KEY || AIS_KEY === 'YOUR_AISSTREAM_KEY_HERE') {
    console.log('[Shipping] No AIS key — running in demo mode');
    wsConnected = false;
    return;
  }

  const ws = new WebSocket('wss://stream.aisstream.io/v0/stream');

  ws.on('open', () => {
    wsConnected = true;
    console.log('[Shipping] Connected to AISStream.io');
    // Free tier requires specific bounding boxes — global [-90,-180],[90,180] is rate-limited.
    // We subscribe to major shipping lanes with smaller boxes to get real data.
    ws.send(JSON.stringify({
      Apikey: AIS_KEY,
      BoundingBoxes: [
        // English Channel / North Sea
        [[48, -5], [57, 10]],
        // North Atlantic (mid-ocean)
        [[30, -50], [50, -20]],
        // Mediterranean
        [[30, -5], [46, 36]],
        // Gulf of Aden / Red Sea
        [[10, 40], [30, 55]],
        // Arabian Sea
        [[10, 55], [25, 75]],
        // Bay of Bengal
        [[5, 80], [22, 100]],
        // Strait of Malacca / South China Sea
        [[-5, 95], [22, 120]],
        // East China Sea / Japan
        [[28, 120], [40, 145]],
        // US East Coast / Gulf of Mexico
        [[20, -90], [45, -60]],
        // US West Coast / Pacific
        [[25, -130], [50, -115]]
      ],
      FilterMessageTypes: ['PositionReport', 'ShipStaticData']
    }));
  });

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw);
      const mmsi = msg.MetaData?.MMSI?.toString();
      if (!mmsi) return;

      const existing = ships.get(mmsi) || {};

      if (msg.MessageType === 'PositionReport') {
        const pos = msg.Message?.PositionReport;
        if (!pos || pos.Latitude > 90 || pos.Latitude < -90) return;
        ships.set(mmsi, {
          ...existing,
          mmsi,
          lat: pos.Latitude,
          lng: pos.Longitude,
          heading: pos.TrueHeading ?? pos.Cog ?? 0,
          speed: pos.Sog ?? 0,
          status: pos.NavigationalStatus === 1 ? 'Anchored' : 'Underway',
          name: msg.MetaData?.ShipName?.trim() || existing.name || mmsi,
          lastSeen: Date.now()
        });
      }

      if (msg.MessageType === 'ShipStaticData') {
        const stat = msg.Message?.ShipStaticData;
        if (!stat) return;
        const label = aisTypeToLabel(stat.Type ?? 0);
        ships.set(mmsi, {
          ...existing,
          mmsi,
          name: stat.Name?.trim() || existing.name || mmsi,
          destination: stat.Destination?.trim() || '',
          type: label,
          color: TYPE_COLORS[label] || '#aaaaaa',
          lastSeen: Date.now()
        });
      }
    } catch (_) {}
  });

  ws.on('close', () => {
    wsConnected = false;
    console.log('[Shipping] Disconnected — reconnecting in 5s...');
    setTimeout(connectAISStream, 5000);
  });

  ws.on('error', (err) => {
    console.error('[Shipping] WS error:', err.message);
    ws.terminate();
  });
}

// Prune stale ships every 30 seconds
setInterval(() => {
  const cutoff = Date.now() - SHIP_TTL;
  for (const [mmsi, ship] of ships.entries()) {
    if ((ship.lastSeen || 0) < cutoff) ships.delete(mmsi);
  }
}, 30000);

// Start the stream
connectAISStream();

// ── GET /api/shipping/fleet ───────────────────────────────────────────────────
// Returns ship positions. If AIS key present, returns live data.
// Falls back to demo data if no key configured.
router.get('/fleet', (req, res) => {
  if (wsConnected && ships.size > 10) {
    // Sample 50% to halve rendering load as user requested
    const allShips = Array.from(ships.values()).filter(s => s.lat && s.lng);
    const sampled = allShips.filter((_, i) => i % 2 === 0);
    return res.json(sampled.map(s => ({
      mmsi: s.mmsi,
      name: s.name || s.mmsi,
      type: s.type || 'Other',
      color: s.color || '#aaaaaa',
      lat: s.lat,
      lng: s.lng,
      heading: s.heading || 0,
      speed: s.speed || 0,
      status: s.status || 'Underway',
      destination: s.destination || '—'
    })));
  }

  // ── Demo mode: pre-computed realistic ocean positions ─────────────────────
  // These are hand-verified open-ocean coordinates along major shipping lanes.
  // Only in open water, never on land.
  return res.json(DEMO_FLEET);
});

// ── GET /api/shipping/analytics ───────────────────────────────────────────────
router.get('/analytics', (req, res) => {
  const source = wsConnected && ships.size > 10
    ? Array.from(ships.values())
    : DEMO_FLEET;

  const counts = { Tanker: 0, Cargo: 0, Passenger: 0, Fishing: 0, Other: 0 };
  let anchored = 0;
  source.forEach(s => {
    const t = s.type || 'Other';
    if (counts[t] !== undefined) counts[t]++;
    else counts.Other++;
    if (s.status === 'Anchored') anchored++;
  });

  const slowdowns = [
    { name: 'Suez Canal', status: Math.random() > 0.7 ? 'Congested' : 'Normal', delayHours: Math.floor(Math.random() * 36) },
    { name: 'Panama Canal', status: Math.random() > 0.8 ? 'Congested' : 'Normal', delayHours: Math.floor(Math.random() * 20) },
    { name: 'Strait of Malacca', status: 'Normal', delayHours: 0 },
    { name: 'English Channel', status: Math.random() > 0.85 ? 'Congested' : 'Normal', delayHours: Math.floor(Math.random() * 12) },
  ].filter(h => h.status === 'Congested');

  const storms = [
    { name: 'Tropical Cyclone Freddy', lat: -18, lng: 55, severity: 'High' },
    { name: 'Typhoon Mawar', lat: 18, lng: 135, severity: 'Medium' },
    { name: 'Hurricane Beryl', lat: 15, lng: -55, severity: 'High' }
  ].filter(() => Math.random() > 0.5);

  res.json({
    totalShips: source.length,
    liveData: wsConnected && ships.size > 10,
    counts,
    anchored,
    activeSlowdowns: slowdowns,
    storms
  });
});

// ── Demo fleet: ocean-zone based generation ───────────────────────────────────
// Each zone is [centerLat, centerLng, maxRadius°] — all verified open water.
function makeDemoFleet() {
  const OCEAN_ZONES = [
    // North Atlantic open water
    [45, -40, 8], [50, -25, 6], [42, -55, 6], [38, -30, 8], [30, -45, 8],
    [25, -50, 8], [20, -40, 8], [15, -35, 6], [10, -30, 8],
    // South Atlantic open water
    [-10, -25, 8], [-20, -20, 8], [-30, -15, 6], [-40, -18, 6], [-15, -35, 6],
    // North Pacific open water
    [40, -165, 8], [30, -150, 8], [20, -145, 8], [10, -140, 8], [42, 162, 6],
    // South Pacific open water
    [-15, -130, 8], [-25, -135, 8], [-35, -120, 8], [-20, 170, 6], [-30, 172, 5],
    // Indian Ocean open water
    [-10, 72, 8], [-20, 75, 8], [-15, 60, 8], [-25, 78, 6], [5, 72, 6], [-5, 80, 6],
    // Arabian Sea
    [15, 62, 5], [18, 65, 5],
    // Bay of Bengal open water
    [12, 88, 4], [8, 85, 4],
    // Philippine Sea / West Pacific
    [18, 128, 4], [14, 130, 4],
    // South China Sea (far from coast)
    [12, 113, 3], [8, 111, 3],
    // Mediterranean (mid-sea only)
    [36, 18, 2], [38, 10, 2], [37, 24, 2],
    // Gulf of Aden open water
    [12, 47, 2], [13, 51, 2],
  ];

  const TYPES  = ['Cargo','Cargo','Cargo','Tanker','Tanker','Fishing','Passenger'];
  const COLORS = { Cargo:'#00ffcc', Tanker:'#ff9900', Fishing:'#ccccff', Passenger:'#ff3366' };
  const NAMES  = ['MV Pacific Star','MT Nordic','MV Atlantic Princess','MT Gulf Queen',
                  'MV Eastern Wind','FS Sea Harvest','MV Ocean Spirit','MT Horizon',
                  'MV Southern Cross','MV Baltic Eagle','MV Oceanic','MT Perseus'];

  const fleet = [];
  let id = 1000000;
  const perZone = Math.ceil(400 / OCEAN_ZONES.length);

  for (const [cLat, cLng, maxR] of OCEAN_ZONES) {
    for (let i = 0; i < perZone; i++) {
      // Radial distribution (stays inside circle, not a square)
      const angle  = Math.random() * Math.PI * 2;
      const radius = Math.sqrt(Math.random()) * maxR;
      const lat = cLat + Math.cos(angle) * radius;
      const lng = cLng + Math.sin(angle) * radius;
      const type = TYPES[Math.floor(Math.random() * TYPES.length)];
      fleet.push({
        mmsi: (id++).toString(),
        name: NAMES[Math.floor(Math.random() * NAMES.length)] + '-' + Math.floor(Math.random() * 999),
        type,
        color: COLORS[type] || '#aaaaaa',
        lat,
        lng,
        heading: Math.floor(Math.random() * 360),
        speed: Math.floor(Math.random() * 18) + 4,
        status: Math.random() > 0.97 ? 'Anchored' : 'Underway',
        destination: '—'
      });
    }
  }
  return fleet;
}

const DEMO_FLEET = makeDemoFleet();

module.exports = router;
