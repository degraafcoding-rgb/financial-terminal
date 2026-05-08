const express = require('express');
const router  = express.Router();

// ── Curated supply chain database ─────────────────────────────────────────────
// Each entry: { ticker, name, rel: 'supplier'|'customer', category, estAnnualB (billions USD), note }
const CHAINS = {
  GM: {
    company: 'General Motors',
    suppliers: [
      { ticker:'STLA',  name:'Stellantis / Aptiv',        category:'Electrical Components',  estAnnualB:3.2,  note:'Wiring harnesses & ECUs' },
      { ticker:'LEA',   name:'Lear Corporation',           category:'Seating & Electrical',   estAnnualB:2.8,  note:'Seat assemblies & E-Systems' },
      { ticker:'ALV',   name:'Autoliv',                    category:'Safety Systems',         estAnnualB:1.9,  note:'Airbags, seatbelts, ADAS' },
      { ticker:'BWA',   name:'BorgWarner',                 category:'Powertrain',             estAnnualB:2.4,  note:'Turbos, transmissions, EV drives' },
      { ticker:'MGA',   name:'Magna International',        category:'Body & Chassis',         estAnnualB:4.1,  note:'Stampings, mirrors, closures' },
      { ticker:'APTV',  name:'Aptiv PLC',                  category:'Vehicle Architecture',   estAnnualB:3.0,  note:'High-voltage wiring for EVs' },
      { ticker:'NUE',   name:'Nucor Corporation',          category:'Steel',                  estAnnualB:1.6,  note:'Flat-rolled steel for stamping' },
      { ticker:'X',     name:'U.S. Steel',                 category:'Steel',                  estAnnualB:1.2,  note:'Cold-rolled & galvanized sheet' },
      { ticker:'AA',    name:'Alcoa',                      category:'Aluminum',               estAnnualB:0.9,  note:'Aluminum sheet for lightweight bodies' },
      { ticker:'QCOM',  name:'Qualcomm',                   category:'Semiconductors',         estAnnualB:0.7,  note:'Snapdragon Ride ADAS chips' },
      { ticker:'ON',    name:'onsemi',                     category:'Semiconductors',         estAnnualB:0.6,  note:'Silicon carbide for EV inverters' },
      { ticker:'LKQ',   name:'LKQ Corporation',            category:'Aftermarket Parts',      estAnnualB:0.5,  note:'Replacement parts distribution' },
    ],
    customers: [
      { ticker:'UBER',  name:'Uber Technologies',          category:'Ride-Hailing Fleet',     estAnnualB:0.8,  note:'Autonomous taxi partnerships' },
      { ticker:'HERTZ', name:'Hertz Global',               category:'Fleet / Rental',         estAnnualB:1.4,  note:'Large fleet vehicle orders' },
      { ticker:'USPS',  name:'U.S. Postal Service',        category:'Government Fleet',       estAnnualB:2.9,  note:'Next-gen USPS delivery vehicles' },
      { ticker:'LMT',   name:'Lockheed Martin',            category:'Defense / Military',     estAnnualB:0.6,  note:'Military tactical vehicles' },
      { ticker:'CACC',  name:'Credit Acceptance Corp',     category:'Auto Finance',           estAnnualB:1.1,  note:'GM Financial dealer network' },
      { ticker:'CAR',   name:'Avis Budget Group',          category:'Fleet / Rental',         estAnnualB:0.9,  note:'Fleet replacement cycles' },
      { ticker:'PAG',   name:'Penske Automotive',          category:'Dealership Network',     estAnnualB:5.2,  note:'Largest GM dealer group by volume' },
      { ticker:'AN',    name:'AutoNation',                 category:'Dealership Network',     estAnnualB:4.8,  note:'Major GM franchise dealer' },
      { ticker:'KMX',   name:'CarMax',                     category:'Used Vehicle Resale',    estAnnualB:1.3,  note:'Certified pre-owned pipeline' },
    ]
  },
  AAPL: {
    company: 'Apple Inc.',
    suppliers: [
      { ticker:'TSM',   name:'Taiwan Semiconductor',       category:'Chips (Foundry)',        estAnnualB:14.0, note:'A-series, M-series chip fabrication' },
      { ticker:'QCOM',  name:'Qualcomm',                   category:'Modem / RF',             estAnnualB:7.0,  note:'5G modems for iPhone' },
      { ticker:'SONY',  name:'Sony Group',                 category:'Image Sensors',          estAnnualB:2.8,  note:'CMOS sensors for iPhone cameras' },
      { ticker:'AVGO',  name:'Broadcom',                   category:'Wireless Chips',         estAnnualB:5.5,  note:'WiFi, Bluetooth, RF components' },
      { ticker:'HON',   name:'Honeywell',                  category:'Industrial Glass',       estAnnualB:0.6,  note:'Specialty display glass coatings' },
      { ticker:'SEDG',  name:'SolarEdge',                  category:'Power Management',       estAnnualB:0.4,  note:'Power IC components' },
      { ticker:'FLEX',  name:'Flex Ltd.',                  category:'Contract Manufacturing', estAnnualB:3.2,  note:'AirPod & accessory assembly' },
      { ticker:'AAP',   name:'Advance Auto (Jabil)',       category:'PCB Assembly',           estAnnualB:4.5,  note:'Jabil circuit board manufacturing' },
      { ticker:'SKX',   name:'Skyworks Solutions',         category:'RF Semiconductors',      estAnnualB:2.1,  note:'RF amplifiers for iPhone' },
      { ticker:'SWKS',  name:'Skyworks Solutions',         category:'RF Front-End',           estAnnualB:2.0,  note:'Antenna tuners & filters' },
    ],
    customers: [
      { ticker:'GOOGL', name:'Alphabet / Google',          category:'Search Distribution',   estAnnualB:20.0, note:'Default search engine deal on Safari' },
      { ticker:'MSFT',  name:'Microsoft',                  category:'Enterprise Software',   estAnnualB:3.5,  note:'M365 & Azure on Apple devices' },
      { ticker:'AMZN',  name:'Amazon',                     category:'App Store / Prime',     estAnnualB:1.8,  note:'Prime Video & in-app commerce' },
      { ticker:'NFLX',  name:'Netflix',                    category:'App Store Revenue',     estAnnualB:0.9,  note:'30% cut on in-app subscriptions' },
      { ticker:'SPOT',  name:'Spotify',                    category:'App Store Revenue',     estAnnualB:0.5,  note:'Distribution on iOS App Store' },
      { ticker:'META',  name:'Meta Platforms',             category:'App Store Revenue',     estAnnualB:0.7,  note:'Facebook/Instagram iOS installs' },
      { ticker:'DIS',   name:'Walt Disney Co.',            category:'App Store / Streaming', estAnnualB:0.4,  note:'Disney+ subscriptions on iOS' },
    ]
  },
  TSLA: {
    company: 'Tesla Inc.',
    suppliers: [
      { ticker:'PNTM',  name:'Panasonic Holdings',         category:'Battery Cells',          estAnnualB:5.0,  note:'2170 cells for Model 3/Y (Nevada)' },
      { ticker:'ALB',   name:'Albemarle Corporation',      category:'Lithium',                estAnnualB:1.2,  note:'Lithium hydroxide for cathodes' },
      { ticker:'SQM',   name:'Sociedad Química',           category:'Lithium',                estAnnualB:0.9,  note:'Lithium carbonate supply' },
      { ticker:'ON',    name:'onsemi',                     category:'Semiconductors (SiC)',   estAnnualB:1.8,  note:'SiC MOSFET inverter modules' },
      { ticker:'NVDA',  name:'NVIDIA',                     category:'AI / Compute',           estAnnualB:0.5,  note:'DGX systems for Dojo training' },
      { ticker:'SAM',   name:'Samsung SDI',                category:'Battery Cells',          estAnnualB:1.5,  note:'4680-format cell development' },
      { ticker:'APTV',  name:'Aptiv PLC',                  category:'Wiring / Connectors',   estAnnualB:0.8,  note:'High-voltage wiring harnesses' },
      { ticker:'AA',    name:'Alcoa',                      category:'Aluminum',               estAnnualB:0.7,  note:'Structural aluminum castings' },
    ],
    customers: [
      { ticker:'HRTG',  name:'Heritage Crystal Clean',     category:'Fleet / Commercial',     estAnnualB:0.3,  note:'Commercial Tesla fleet leasing' },
      { ticker:'UBER',  name:'Uber Technologies',           category:'Robotaxi / FSD',        estAnnualB:1.2,  note:'Robotaxi licensing partnership' },
      { ticker:'AMZN',  name:'Amazon',                     category:'Delivery Vans (future)', estAnnualB:0.5,  note:'Semi truck pre-orders' },
      { ticker:'PEP',   name:'PepsiCo',                    category:'Commercial Fleet',       estAnnualB:0.2,  note:'Tesla Semi initial deployment' },
    ]
  },
  MSFT: {
    company: 'Microsoft Corporation',
    suppliers: [
      { ticker:'NVDA',  name:'NVIDIA',                     category:'AI / GPU Compute',       estAnnualB:10.0, note:'H100/H200 GPUs for Azure AI' },
      { ticker:'AMD',   name:'Advanced Micro Devices',     category:'CPUs / GPUs',            estAnnualB:4.0,  note:'EPYC CPUs & Instinct GPUs' },
      { ticker:'INTC',  name:'Intel',                      category:'Server CPUs',            estAnnualB:3.5,  note:'Xeon processors for Azure DCs' },
      { ticker:'QCOM',  name:'Qualcomm',                   category:'ARM Chips',              estAnnualB:1.2,  note:'Surface Pro X & Copilot+ PCs' },
      { ticker:'TSM',   name:'Taiwan Semiconductor',       category:'Custom Silicon',         estAnnualB:2.0,  note:'Maia AI chip fabrication' },
      { ticker:'CSCO',  name:'Cisco Systems',              category:'Networking',             estAnnualB:1.8,  note:'Data center network infrastructure' },
    ],
    customers: [
      { ticker:'GS',    name:'Goldman Sachs',              category:'Enterprise / Azure',     estAnnualB:2.2,  note:'Azure cloud & M365 enterprise' },
      { ticker:'JPM',   name:'JPMorgan Chase',             category:'Enterprise / Azure',     estAnnualB:3.1,  note:'Azure financial services cloud' },
      { ticker:'AMZN',  name:'Amazon',                     category:'Enterprise Software',    estAnnualB:1.4,  note:'M365 licensing for Amazon employees' },
      { ticker:'GM',    name:'General Motors',             category:'Enterprise / Teams',     estAnnualB:0.8,  note:'Digital transformation & cloud' },
      { ticker:'WMT',   name:'Walmart',                    category:'Retail Cloud (Azure)',   estAnnualB:1.0,  note:'Azure cloud over Google (anti-AMZN)' },
    ]
  },
  AMZN: {
    company: 'Amazon.com Inc.',
    suppliers: [
      { ticker:'NVDA',  name:'NVIDIA',                     category:'AI Chips (AWS)',         estAnnualB:8.0,  note:'GPUs for AWS Bedrock / SageMaker' },
      { ticker:'UPS',   name:'UPS',                        category:'Logistics',              estAnnualB:9.5,  note:'Last-mile delivery partner' },
      { ticker:'FDX',   name:'FedEx',                      category:'Logistics',              estAnnualB:5.2,  note:'Air freight for Prime' },
      { ticker:'RIVN',  name:'Rivian Automotive',          category:'Electric Vans',          estAnnualB:1.8,  note:'100k EDV delivery vans order' },
      { ticker:'INTC',  name:'Intel',                      category:'Server CPUs',            estAnnualB:2.1,  note:'AWS EC2 server processors' },
      { ticker:'AMD',   name:'Advanced Micro Devices',     category:'Data Center CPUs',       estAnnualB:3.0,  note:'EPYC for AWS Graviton support' },
    ],
    customers: [
      { ticker:'NFLX',  name:'Netflix',                    category:'AWS Cloud',              estAnnualB:1.0,  note:'Netflix runs 100% on AWS' },
      { ticker:'SPOT',  name:'Spotify',                    category:'AWS Cloud',              estAnnualB:0.5,  note:'Spotify primary cloud provider' },
      { ticker:'LYFT',  name:'Lyft',                       category:'AWS Cloud',              estAnnualB:0.3,  note:'Ride-hailing backend on AWS' },
      { ticker:'AIR',   name:'Airbnb',                     category:'AWS Cloud',              estAnnualB:0.4,  note:'Airbnb infrastructure on AWS' },
      { ticker:'META',  name:'Meta Platforms',             category:'AWS + Marketplace',      estAnnualB:0.8,  note:'AWS services & ad spend' },
    ]
  },
  NVDA: {
    company: 'NVIDIA Corporation',
    suppliers: [
      { ticker:'TSM',   name:'Taiwan Semiconductor',       category:'Chip Foundry',           estAnnualB:9.0,  note:'H100/H200 on TSMC N4 node' },
      { ticker:'AMAT',  name:'Applied Materials',          category:'Semiconductor Equipment', estAnnualB:0.8, note:'Wafer fab equipment' },
      { ticker:'KLAC',  name:'KLA Corporation',            category:'Inspection Equipment',   estAnnualB:0.5,  note:'Defect inspection systems' },
      { ticker:'ASML',  name:'ASML Holding',               category:'EUV Lithography',        estAnnualB:1.2,  note:'EUV machines at TSMC for GPUs' },
    ],
    customers: [
      { ticker:'MSFT',  name:'Microsoft',                  category:'Azure AI Clusters',      estAnnualB:10.0, note:'H100/H200 for Copilot / OpenAI' },
      { ticker:'GOOGL', name:'Alphabet / Google',          category:'GCP AI Infra',           estAnnualB:8.0,  note:'GPUs for DeepMind & Gemini' },
      { ticker:'AMZN',  name:'Amazon / AWS',               category:'AWS AI Services',        estAnnualB:8.0,  note:'AWS Bedrock GPU clusters' },
      { ticker:'META',  name:'Meta Platforms',             category:'AI Research',            estAnnualB:5.0,  note:'350k H100s for Llama training' },
      { ticker:'TSLA',  name:'Tesla',                      category:'Dojo Training',          estAnnualB:0.5,  note:'DGX systems for Autopilot' },
      { ticker:'ORCL',  name:'Oracle',                     category:'OCI AI Cloud',           estAnnualB:3.0,  note:'GPU clusters in Oracle Cloud' },
    ]
  },
  GOOGL: {
    company: 'Alphabet Inc.',
    suppliers: [
      { ticker:'NVDA',  name:'NVIDIA',                     category:'AI / GPU Compute',       estAnnualB:4.0,  note:'GPUs for Cloud & DeepMind' },
      { ticker:'AVGO',  name:'Broadcom',                   category:'Custom Silicon',         estAnnualB:3.0,  note:'TPU co-development' },
      { ticker:'INTC',  name:'Intel',                      category:'Server CPUs',            estAnnualB:2.5,  note:'Data center processors' },
      { ticker:'AMD',   name:'Advanced Micro Devices',     category:'Server CPUs',            estAnnualB:1.5,  note:'EPYC processors for GCP' },
      { ticker:'ANET',  name:'Arista Networks',            category:'Networking',             estAnnualB:0.8,  note:'Data center switches' },
    ],
    customers: [
      { ticker:'AAPL',  name:'Apple',                      category:'Search Default',         estAnnualB:20.0, note:'Safari default search engine payment' },
      { ticker:'SNAP',  name:'Snap Inc.',                  category:'Cloud Infrastructure',   estAnnualB:0.4,  note:'GCP customer' },
      { ticker:'SPOT',  name:'Spotify',                    category:'Cloud Infrastructure',   estAnnualB:0.2,  note:'GCP for podcast analytics' },
      { ticker:'TWLO',  name:'Twilio',                     category:'Cloud Infrastructure',   estAnnualB:0.1,  note:'GCP services' },
    ]
  },
  META: {
    company: 'Meta Platforms Inc.',
    suppliers: [
      { ticker:'NVDA',  name:'NVIDIA',                     category:'AI / GPU Compute',       estAnnualB:5.0,  note:'H100 clusters for AI research' },
      { ticker:'AMD',   name:'Advanced Micro Devices',     category:'Server CPUs',            estAnnualB:1.0,  note:'EPYC for data centers' },
      { ticker:'ANET',  name:'Arista Networks',            category:'Networking',             estAnnualB:0.7,  note:'High-speed network switches' },
      { ticker:'MSFT',  name:'Microsoft',                  category:'Cloud / Search',         estAnnualB:0.5,  note:'Bing integration & Azure' },
    ],
    customers: [
      { ticker:'AMZN',  name:'Amazon',                     category:'Advertising',            estAnnualB:1.5,  note:'Major ad spender' },
      { ticker:'DIS',   name:'Walt Disney Co.',            category:'Advertising',            estAnnualB:0.6,  note:'Media & entertainment ads' },
      { ticker:'PG',    name:'Procter & Gamble',           category:'Advertising',            estAnnualB:0.4,  note:'Consumer goods ads' },
      { ticker:'LVMUY', name:'LVMH',                       category:'Advertising',            estAnnualB:0.3,  note:'Luxury fashion ads' },
    ]
  },
  NFLX: {
    company: 'Netflix Inc.',
    suppliers: [
      { ticker:'AMZN',  name:'Amazon Web Services',        category:'Cloud Infrastructure',   estAnnualB:1.0,  note:'100% of cloud runs on AWS' },
      { ticker:'CDW',   name:'CDW Corporation',            category:'IT Hardware',            estAnnualB:0.1,  note:'General enterprise IT' },
      { ticker:'AKAM',  name:'Akamai',                     category:'CDN Services',           estAnnualB:0.2,  note:'Content delivery (fallback)' },
    ],
    customers: [
      { ticker:'T',     name:'AT&T',                       category:'Distribution',           estAnnualB:0.5,  note:'Bundled subscription packages' },
      { ticker:'TMUS',  name:'T-Mobile',                   category:'Distribution',           estAnnualB:0.4,  note:'Netflix On Us program' },
      { ticker:'CMCSA', name:'Comcast',                    category:'Distribution',           estAnnualB:0.3,  note:'Xfinity integration' },
    ]
  },
  INTC: {
    company: 'Intel Corporation',
    suppliers: [
      { ticker:'ASML',  name:'ASML Holding',               category:'EUV Lithography',        estAnnualB:3.5,  note:'EUV systems for fabs' },
      { ticker:'AMAT',  name:'Applied Materials',          category:'Wafer Fab Equipment',    estAnnualB:1.5,  note:'Deposition & etch tools' },
      { ticker:'LRCX',  name:'Lam Research',               category:'Wafer Fab Equipment',    estAnnualB:1.0,  note:'Etch and deposition systems' },
      { ticker:'KLAC',  name:'KLA Corporation',            category:'Inspection',             estAnnualB:0.5,  note:'Process control & yield management' },
    ],
    customers: [
      { ticker:'DELL',  name:'Dell Technologies',          category:'Client CPUs',            estAnnualB:8.0,  note:'PCs and servers' },
      { ticker:'HPQ',   name:'HP Inc.',                    category:'Client CPUs',            estAnnualB:6.0,  note:'Consumer and enterprise PCs' },
      { ticker:'LNVGY', name:'Lenovo',                     category:'Client CPUs',            estAnnualB:5.0,  note:'PCs and data center' },
      { ticker:'MSFT',  name:'Microsoft',                  category:'Server CPUs',            estAnnualB:3.5,  note:'Azure data centers' },
      { ticker:'AMZN',  name:'Amazon / AWS',               category:'Server CPUs',            estAnnualB:2.1,  note:'AWS EC2 instances' },
    ]
  },
  AMD: {
    company: 'Advanced Micro Devices',
    suppliers: [
      { ticker:'TSM',   name:'Taiwan Semiconductor',       category:'Chip Foundry',           estAnnualB:6.0,  note:'Ryzen and EPYC fabrication' },
      { ticker:'GFS',   name:'GlobalFoundries',            category:'Chip Foundry',           estAnnualB:1.0,  note:'Legacy node components' },
      { ticker:'ASE',   name:'ASE Technology',             category:'Packaging',              estAnnualB:0.5,  note:'OSAT packaging & testing' },
    ],
    customers: [
      { ticker:'MSFT',  name:'Microsoft',                  category:'Data Center / Gaming',   estAnnualB:4.0,  note:'Azure EPYC & Xbox custom silicon' },
      { ticker:'SONY',  name:'Sony Group',                 category:'Gaming',                 estAnnualB:3.0,  note:'PlayStation 5 custom silicon' },
      { ticker:'AMZN',  name:'Amazon / AWS',               category:'Data Center',            estAnnualB:3.0,  note:'AWS EC2 instances' },
      { ticker:'META',  name:'Meta Platforms',             category:'Data Center',            estAnnualB:1.0,  note:'EPYC for internal infrastructure' },
      { ticker:'DELL',  name:'Dell Technologies',          category:'Client CPUs',            estAnnualB:1.5,  note:'PCs and servers' },
    ]
  }
};

// ── Fallback generator for unknown tickers ─────────────────────────────────────
const POOL = [
  { ticker:'AAPL', name:'Apple Inc.', category:'Consumer Electronics' },
  { ticker:'MSFT', name:'Microsoft Corp.', category:'Software' },
  { ticker:'AMZN', name:'Amazon.com Inc.', category:'E-Commerce' },
  { ticker:'GOOGL', name:'Alphabet Inc.', category:'Internet' },
  { ticker:'META', name:'Meta Platforms', category:'Social Media' },
  { ticker:'TSLA', name:'Tesla Inc.', category:'Auto Manufacturers' },
  { ticker:'NVDA', name:'NVIDIA Corp.', category:'Semiconductors' },
  { ticker:'JPM', name:'JPMorgan Chase', category:'Banks' },
  { ticker:'V', name:'Visa Inc.', category:'Credit Services' },
  { ticker:'JNJ', name:'Johnson & Johnson', category:'Drug Manufacturers' },
  { ticker:'WMT', name:'Walmart Inc.', category:'Retail' },
  { ticker:'PG', name:'Procter & Gamble', category:'Household Goods' },
  { ticker:'MA', name:'Mastercard Inc.', category:'Credit Services' },
  { ticker:'HD', name:'Home Depot', category:'Home Improvement' },
  { ticker:'CVX', name:'Chevron Corp.', category:'Oil & Gas' },
  { ticker:'ABBV', name:'AbbVie Inc.', category:'Drug Manufacturers' },
  { ticker:'MRK', name:'Merck & Co.', category:'Drug Manufacturers' },
  { ticker:'KO', name:'Coca-Cola Co.', category:'Beverages' },
  { ticker:'PEP', name:'PepsiCo Inc.', category:'Beverages' },
  { ticker:'AVGO', name:'Broadcom Inc.', category:'Semiconductors' },
  { ticker:'ORCL', name:'Oracle Corp.', category:'Software' },
  { ticker:'TMO', name:'Thermo Fisher', category:'Diagnostics' },
  { ticker:'COST', name:'Costco Wholesale', category:'Discount Stores' },
  { ticker:'CSCO', name:'Cisco Systems', category:'Networking' },
  { ticker:'MCD', name:'McDonald\'s Corp.', category:'Restaurants' },
  { ticker:'CRM', name:'Salesforce Inc.', category:'Software' },
  { ticker:'DHR', name:'Danaher Corp.', category:'Diagnostics' },
  { ticker:'TMUS', name:'T-Mobile US', category:'Telecom' },
  { ticker:'ABT', name:'Abbott Labs', category:'Medical Devices' },
  { ticker:'NKE', name:'NIKE Inc.', category:'Apparel' },
  { ticker:'LIN', name:'Linde plc', category:'Specialty Chemicals' },
  { ticker:'UNP', name:'Union Pacific', category:'Railroads' },
  { ticker:'VZ', name:'Verizon', category:'Telecom' },
  { ticker:'TXN', name:'Texas Instruments', category:'Semiconductors' },
  { ticker:'PM', name:'Philip Morris', category:'Tobacco' },
  { ticker:'NEE', name:'NextEra Energy', category:'Utilities' },
  { ticker:'UPS', name:'United Parcel Service', category:'Logistics' },
  { ticker:'RTX', name:'RTX Corporation', category:'Aerospace' },
  { ticker:'MS', name:'Morgan Stanley', category:'Capital Markets' },
  { ticker:'HON', name:'Honeywell', category:'Conglomerates' },
  { ticker:'INTC', name:'Intel Corp.', category:'Semiconductors' },
  { ticker:'BMY', name:'Bristol-Myers Squibb', category:'Drug Manufacturers' },
  { ticker:'QCOM', name:'Qualcomm Inc.', category:'Semiconductors' },
  { ticker:'BA', name:'Boeing Co.', category:'Aerospace' },
  { ticker:'DIS', name:'Walt Disney Co.', category:'Entertainment' },
  { ticker:'CAT', name:'Caterpillar Inc.', category:'Heavy Machinery' },
  { ticker:'AXP', name:'American Express', category:'Credit Services' },
  { ticker:'IBM', name:'Intl Business Machines', category:'IT Services' },
  { ticker:'GS', name:'Goldman Sachs', category:'Capital Markets' },
  { ticker:'GE', name:'General Electric', category:'Conglomerates' },
  { ticker:'F', name:'Ford Motor Co.', category:'Auto Manufacturers' },
  { ticker:'UBER', name:'Uber Tech', category:'Ride Sharing' },
  { ticker:'SNOW', name:'Snowflake', category:'Software' },
  { ticker:'PLTR', name:'Palantir', category:'Software' }
];

function generateFallback(ticker) {
  let hash = 0;
  for (let i = 0; i < ticker.length; i++) {
    hash = ((hash << 5) - hash) + ticker.charCodeAt(i);
    hash |= 0; 
  }
  hash = Math.abs(hash);

  const numSuppliers = 10 + (hash % 15);
  const numCustomers = 10 + ((hash >> 2) % 15);

  const pickFromPool = (offset, count) => {
    let result = [];
    let poolCopy = [...POOL];
    for (let i = 0; i < count; i++) {
      if (poolCopy.length === 0) break;
      let idx = (hash + offset + i * 13) % poolCopy.length;
      let item = poolCopy.splice(idx, 1)[0];
      if (item.ticker !== ticker.toUpperCase()) {
        result.push({
          ticker: item.ticker,
          name: item.name,
          category: item.category,
          estAnnualB: Number((0.5 + ((hash + i * 7) % 50) * 0.1).toFixed(1)),
          note: 'Strategic partnership and supply agreement.'
        });
      }
    }
    return result.sort((a,b) => b.estAnnualB - a.estAnnualB);
  };

  return {
    company: ticker.toUpperCase() + ' Corp.',
    suppliers: pickFromPool(17, numSuppliers),
    customers: pickFromPool(99, numCustomers)
  };
}

// ── GET /api/supplychain/:ticker ───────────────────────────────────────────────
router.get('/:ticker', (req, res) => {
  const ticker = req.params.ticker.toUpperCase();
  const data   = CHAINS[ticker] || generateFallback(ticker);
  res.json({ ticker, ...data });
});

module.exports = router;
