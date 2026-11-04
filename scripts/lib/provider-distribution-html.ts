import {
    PLACE_CENTERS,
    type NamedCount,
    type NamedMoney,
    type ProviderDistributionReport,
} from '../../src/lib/provider-distribution';

function esc(value: string | number | null | undefined): string {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/** Extra hubs for map pins (not necessarily used in nearest-place resolution). */
const MAP_EXTRA_PLACES: Array<{ name: string; lat: number; lng: number }> = [
    { name: 'Addis Ababa', lat: 9.019, lng: 38.752 },
    { name: 'Bishoftu', lat: 8.752, lng: 38.978 },
];

type MapPoint = { name: string; count: number; lat: number; lng: number };

function resolvePlaceCoords(key: string): { lat: number; lng: number } | null {
    const hubs = [...PLACE_CENTERS, ...MAP_EXTRA_PLACES];
    const exact = hubs.find((p) => p.name === key);
    if (exact) return { lat: exact.lat, lng: exact.lng };

    const near = key.match(/^Near\s+(-?\d+(?:\.\d+)?)°,\s*(-?\d+(?:\.\d+)?)°$/i);
    if (near) {
        const lat = Number(near[1]);
        const lng = Number(near[2]);
        if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    // Named street in Addis without a dedicated hub → city center
    if (/addis\s*ababa/i.test(key)) {
        const central = hubs.find((p) => p.name === 'Addis Ababa (central)');
        if (central) return { lat: central.lat, lng: central.lng };
    }
    return null;
}

function mapPoints(rows: NamedCount[]): MapPoint[] {
    return rows.flatMap((row) => {
        const coords = resolvePlaceCoords(row.key);
        if (!coords) return [];
        return [{ name: row.key, count: row.count, lat: coords.lat, lng: coords.lng }];
    });
}

function money(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return '—';
    return `ETB ${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

function pct(n: number): string {
    return `${n}%`;
}

function maxCount(rows: NamedCount[]): number {
    return Math.max(1, ...rows.map((r) => r.count));
}

function maxMoney(rows: NamedMoney[]): number {
    return Math.max(1, ...rows.map((r) => r.amount));
}

function barListCounts(rows: NamedCount[], max: number): string {
    return rows
        .map((row) => {
            const ratio = Math.max(0.02, row.count / max);
            return `<div class="bar-row">
  <div class="bar-label" title="${esc(row.key)}">${esc(row.key)}</div>
  <div class="bar-track" aria-hidden="true"><span class="bar-fill" style="transform:scaleX(${ratio})"></span></div>
  <div class="bar-value">${esc(row.count)}</div>
</div>`;
        })
        .join('\n');
}

function barListMoney(rows: NamedMoney[], max: number): string {
    return rows
        .map((row) => {
            const ratio = Math.max(0.02, row.amount / max);
            return `<div class="bar-row">
  <div class="bar-label" title="${esc(row.key)}">${esc(row.key)}</div>
  <div class="bar-track" aria-hidden="true"><span class="bar-fill accent-2" style="transform:scaleX(${ratio})"></span></div>
  <div class="bar-value">${esc(money(row.amount))}<small>${esc(row.count)} jobs</small></div>
</div>`;
        })
        .join('\n');
}

function dataTable(headers: string[], rows: string[][]): string {
    const head = headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('');
    const body = rows
        .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`)
        .join('\n');
    return `<div class="table-wrap"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

export function renderProviderDistributionHtml(report: ProviderDistributionReport): string {
    const day = report.generatedAt.slice(0, 10);
    const s = report.snapshot;
    const locAllMax = maxCount(report.location.all.topAreas);
    const locSvcMax = maxCount(report.location.withServices.topAreas);
    const priceMax = maxCount(report.listPrices.buckets);
    const revAreaMax = maxMoney(report.bookingRevenue.byArea);
    const mapAll = mapPoints(report.location.all.topAreas);
    const mapSvc = mapPoints(report.location.withServices.topAreas);
    const mapAllJson = JSON.stringify(mapAll).replace(/</g, '\\u003c');
    const mapSvcJson = JSON.stringify(mapSvc).replace(/</g, '\\u003c');
    const mapUnmappedAll = report.location.all.topAreas.length - mapAll.length;
    const mapUnmappedSvc = report.location.withServices.topAreas.length - mapSvc.length;

    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Provider distribution · ${esc(day)}</title>
<style>
  :root {
    --bg: #f4f7f5;
    --surface: #ffffff;
    --ink: #122018;
    --muted: #4d6357;
    --line: #d7e3db;
    --primary: #027a3b;
    --primary-soft: #e7f6ee;
    --primary-ink: #015c2d;
    --warn-bg: #fff8eb;
    --warn-ink: #7a4b00;
    --shadow: 0 1px 2px rgb(18 32 24 / 6%), 0 8px 24px rgb(18 32 24 / 4%);
    --radius: 12px;
    --font: "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
    --mono: "IBM Plex Mono", ui-monospace, monospace;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  @media (prefers-reduced-motion: reduce) {
    html { scroll-behavior: auto; }
    .bar-fill { transition: none !important; }
  }
  body {
    margin: 0;
    font-family: var(--font);
    color: var(--ink);
    background:
      radial-gradient(900px 420px at 8% -10%, rgb(2 122 59 / 10%), transparent 55%),
      radial-gradient(700px 380px at 100% 0%, rgb(2 122 59 / 6%), transparent 50%),
      var(--bg);
    line-height: 1.45;
  }
  a { color: var(--primary-ink); }
  .shell { max-width: 1120px; margin: 0 auto; padding: 28px 20px 72px; }
  .topnav {
    position: sticky; top: 0; z-index: 20;
    display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center;
    padding: 10px 0 12px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(10px);
    border-bottom: 1px solid var(--line);
    margin-bottom: 22px;
  }
  .topnav a {
    text-decoration: none; color: var(--muted); font-size: 0.8125rem; font-weight: 560;
    padding: 4px 0;
  }
  .topnav a:hover, .topnav a:focus-visible { color: var(--primary-ink); outline: none; }
  .brand { font-weight: 700; color: var(--ink); margin-right: 8px; font-size: 0.875rem; }
  .hero {
    display: grid; gap: 18px;
    margin-bottom: 28px;
  }
  .hero h1 {
    margin: 0;
    font-size: 1.85rem;
    letter-spacing: -0.02em;
    text-wrap: balance;
  }
  .hero .lede {
    margin: 0;
    max-width: 62ch;
    color: var(--muted);
    font-size: 0.975rem;
  }
  .meta {
    display: inline-flex; gap: 10px; flex-wrap: wrap; align-items: center;
    font-size: 0.8125rem; color: var(--muted);
  }
  .pill {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 4px 10px; border-radius: 999px;
    background: var(--primary-soft); color: var(--primary-ink);
    font-weight: 600; font-size: 0.75rem;
  }
  .kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 10px;
  }
  .kpi {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    padding: 14px 14px 12px;
    box-shadow: var(--shadow);
  }
  .kpi .v {
    font-family: var(--mono);
    font-size: 1.2rem;
    font-weight: 650;
    letter-spacing: -0.02em;
  }
  .kpi .l {
    margin-top: 4px;
    font-size: 0.75rem;
    color: var(--muted);
    font-weight: 550;
  }
  section.block {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: 16px;
    padding: 22px 20px 20px;
    margin-bottom: 18px;
    box-shadow: var(--shadow);
  }
  section.block > h2 {
    margin: 0 0 6px;
    font-size: 1.15rem;
    letter-spacing: -0.015em;
  }
  .section-num {
    display: inline-flex; align-items: center; justify-content: center;
    width: 1.55rem; height: 1.55rem; border-radius: 7px;
    background: var(--primary); color: #fff;
    font-size: 0.75rem; font-weight: 700; margin-right: 8px;
    vertical-align: 2px;
  }
  .hint {
    margin: 0 0 16px;
    color: var(--muted);
    font-size: 0.875rem;
    max-width: 70ch;
  }
  .callout {
    margin: 0 0 16px;
    padding: 10px 12px;
    border-radius: 10px;
    background: var(--warn-bg);
    color: var(--warn-ink);
    font-size: 0.8125rem;
    border: 1px solid color-mix(in srgb, var(--warn-ink) 18%, transparent);
  }
  .split {
    display: grid;
    grid-template-columns: 1fr;
    gap: 18px;
  }
  @media (min-width: 880px) {
    .split { grid-template-columns: 1fr 1fr; gap: 22px; }
  }
  .panel h3 {
    margin: 0 0 4px;
    font-size: 0.95rem;
  }
  .panel .sub {
    margin: 0 0 12px;
    color: var(--muted);
    font-size: 0.78rem;
  }
  .bar-row {
    display: grid;
    grid-template-columns: minmax(96px, 34%) 1fr auto;
    gap: 8px;
    align-items: center;
    margin-bottom: 7px;
  }
  .bar-label {
    font-size: 0.78rem;
    color: var(--ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .bar-track {
    height: 8px;
    border-radius: 999px;
    background: #edf3ef;
    overflow: hidden;
  }
  .bar-fill {
    display: block; height: 100%; width: 100%;
    border-radius: inherit;
    background: var(--primary);
    transform-origin: left center;
    transform: scaleX(0.02);
    transition: transform 400ms cubic-bezier(0.16, 1, 0.3, 1);
  }
  .bar-fill.accent-2 {
    background: color-mix(in srgb, var(--primary) 70%, #0f766e);
  }
  .bar-value {
    font-family: var(--mono);
    font-size: 0.72rem;
    color: var(--muted);
    text-align: right;
    min-width: 4.5rem;
  }
  .bar-value small {
    display: block;
    font-family: var(--font);
    font-size: 0.65rem;
    color: var(--muted);
  }
  .table-wrap { overflow-x: auto; border: 1px solid var(--line); border-radius: 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8125rem; }
  th, td { padding: 9px 11px; text-align: left; border-bottom: 1px solid var(--line); }
  th {
    background: #123528;
    color: #f3faf6;
    font-weight: 600;
    font-size: 0.72rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  tbody tr:nth-child(even) { background: #f7fbf8; }
  tbody tr:hover { background: var(--primary-soft); }
  td:nth-child(n+2) { font-family: var(--mono); font-variant-numeric: tabular-nums; }
  .stack { display: grid; gap: 14px; }
  .map-panel { margin-bottom: 18px; }
  .map-toolbar {
    display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
    margin-bottom: 10px;
  }
  .map-toolbar .sub { margin: 0; flex: 1; min-width: 12rem; }
  .map-toggle {
    display: inline-flex; border: 1px solid var(--line); border-radius: 999px;
    overflow: hidden; background: #edf3ef;
  }
  .map-toggle button {
    border: 0; background: transparent; color: var(--muted);
    font: inherit; font-size: 0.75rem; font-weight: 600;
    padding: 6px 12px; cursor: pointer;
  }
  .map-toggle button[aria-pressed="true"] {
    background: var(--primary); color: #fff;
  }
  #loc-map {
    height: min(52vh, 480px);
    min-height: 280px;
    width: 100%;
    border-radius: 10px;
    border: 1px solid var(--line);
    z-index: 1;
  }
  .leaflet-container { font: inherit; }
  footer.page-foot {
    margin-top: 28px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    color: var(--muted);
    font-size: 0.75rem;
    display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap;
  }
  @media print {
    body { background: #fff; }
    .topnav { position: static; backdrop-filter: none; }
    section.block { box-shadow: none; break-inside: avoid; }
    #loc-map { height: 360px; break-inside: avoid; }
  }
</style>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=IBM+Plex+Sans:wght@450;550;650;700&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
</head>
<body>
  <div class="shell">
    <nav class="topnav" aria-label="Report sections">
      <span class="brand">Zemen Service</span>
      <a href="#snapshot">Snapshot</a>
      <a href="#location">Location</a>
      <a href="#prices">Prices</a>
      <a href="#tiers">Tiers</a>
      <a href="#revenue">Revenue</a>
      <a href="#supply">Supply</a>
      <a href="#health">Health</a>
    </nav>

    <header class="hero">
      <div>
        <h1>Provider distribution</h1>
        <p class="lede">Where providers sit, what they charge, which tiers they hold, and how completed bookings line up with supply.</p>
      </div>
      <div class="meta">
        <span class="pill">Live Supabase snapshot</span>
        <span>Generated ${esc(report.generatedAt)}</span>
      </div>
      <div class="kpis" role="group" aria-label="Key metrics">
        <div class="kpi"><div class="v">${esc(s.totalProviders)}</div><div class="l">Providers</div></div>
        <div class="kpi"><div class="v">${esc(s.withActiveService)}</div><div class="l">With active services (${esc(pct(s.withActiveServicePct))})</div></div>
        <div class="kpi"><div class="v">${esc(s.activated)}</div><div class="l">Activation paid (${esc(pct(s.activatedPct))})</div></div>
        <div class="kpi"><div class="v">${esc(money(s.medianListPrice))}</div><div class="l">Median list price</div></div>
        <div class="kpi"><div class="v">${esc(s.withLocation)}</div><div class="l">GPS coverage (${esc(pct(s.withLocationPct))})</div></div>
        <div class="kpi"><div class="v">${esc(s.completedBookingsAll)}</div><div class="l">Completed jobs</div></div>
        <div class="kpi"><div class="v">${esc(money(s.completedRevenueAll))}</div><div class="l">Revenue (all-time)</div></div>
        <div class="kpi"><div class="v">${esc(money(s.completedRevenue90d))}</div><div class="l">Revenue (last 90d)</div></div>
      </div>
    </header>

    <section class="block" id="snapshot">
      <h2><span class="section-num">1</span>Executive snapshot</h2>
      <p class="hint">Completed jobs last 90 days: <strong>${esc(s.completedBookings90d)}</strong>. Places prefer address locality names; GPS maps to the nearest known hub when the address is thin.</p>
    </section>

    <section class="block" id="location">
      <h2><span class="section-num">2</span>Location</h2>
      <p class="callout">Separate view for providers who already have at least one active service — that is your real marketplace supply map.</p>
      <div class="panel map-panel">
        <h3>Geographic distribution</h3>
        <div class="map-toolbar">
          <div class="map-toggle" role="group" aria-label="Map dataset">
            <button type="button" id="map-btn-all" aria-pressed="true">All providers</button>
            <button type="button" id="map-btn-svc" aria-pressed="false">With services</button>
          </div>
          <p class="sub" id="map-hint">Bubble size ∝ provider count. ${esc(mapAll.length)} places plotted${mapUnmappedAll > 0 ? ` · ${esc(mapUnmappedAll)} unmapped` : ''}.</p>
        </div>
        <div id="loc-map" role="img" aria-label="Map of provider locations"></div>
      </div>
      <div class="split">
        <div class="panel">
          <h3>All providers (${esc(report.location.all.providerCount)})</h3>
          <p class="sub">Missing GPS: ${esc(report.location.all.missingGps)} · Unresolved place: ${esc(report.location.all.missingPlace)}</p>
          ${barListCounts(report.location.all.topAreas, locAllMax)}
        </div>
        <div class="panel">
          <h3>With active services (${esc(report.location.withServices.providerCount)})</h3>
          <p class="sub">Missing GPS: ${esc(report.location.withServices.missingGps)} · Unresolved place: ${esc(report.location.withServices.missingPlace)}</p>
          ${barListCounts(report.location.withServices.topAreas, locSvcMax)}
        </div>
      </div>
    </section>

    <section class="block" id="prices">
      <h2><span class="section-num">3</span>Listed service prices</h2>
      <p class="hint">Overall p25 / median / p75: <strong>${esc(money(report.listPrices.overall.p25))}</strong> · <strong>${esc(money(report.listPrices.overall.median))}</strong> · <strong>${esc(money(report.listPrices.overall.p75))}</strong></p>
      <div class="split">
        <div class="panel">
          <h3>Price buckets</h3>
          <p class="sub">Active, non-archived services</p>
          ${barListCounts(report.listPrices.buckets, priceMax)}
        </div>
        <div class="panel">
          <h3>By category</h3>
          <p class="sub">Top categories by service count</p>
          ${dataTable(
              ['Category', 'n', 'p25', 'median', 'p75'],
              report.listPrices.byCategory.map((r) => [
                  esc(r.category),
                  esc(r.count),
                  esc(money(r.p25)),
                  esc(money(r.median)),
                  esc(money(r.p75)),
              ])
          )}
        </div>
      </div>
    </section>

    <section class="block" id="tiers">
      <h2><span class="section-num">4</span>Activation / posting tier</h2>
      <div class="stack">
        ${dataTable(
            ['Tier max', 'Providers'],
            report.tiers.byTier.map((r) => [esc(r.key), esc(r.count)])
        )}
        <p class="hint">Over paid tier: <strong>${esc(report.tiers.overTierProviders)}</strong> · Admin-unpaid services: <strong>${esc(report.tiers.adminUnpaidServices)}</strong> · Zero services: <strong>${esc(report.tiers.zeroServiceProviders)}</strong></p>
      </div>
    </section>

    <section class="block" id="revenue">
      <h2><span class="section-num">5</span>Booking revenue (completed)</h2>
      <div class="split">
        <div class="panel">
          <h3>By place</h3>
          <p class="sub">Completed booking revenue</p>
          ${barListMoney(report.bookingRevenue.byArea, revAreaMax)}
        </div>
        <div class="panel">
          <h3>By category</h3>
          <p class="sub">Provider’s primary service category</p>
          ${dataTable(
              ['Category', 'Jobs', 'Revenue'],
              report.bookingRevenue.byCategory.map((r) => [
                  esc(r.key),
                  esc(r.count),
                  esc(money(r.amount)),
              ])
          )}
        </div>
      </div>
      <div class="panel" style="margin-top:16px">
        <h3>Top providers</h3>
        <p class="sub">By completed revenue · ${esc(report.bookingRevenue.withServicesZeroCompleted)} providers have services but zero completed jobs</p>
        ${dataTable(
            ['Provider', 'Jobs', 'Revenue'],
            report.bookingRevenue.topProviders.map((r) => [
                esc(r.name),
                esc(r.count),
                esc(money(r.amount)),
            ])
        )}
      </div>
    </section>

    <section class="block" id="supply">
      <h2><span class="section-num">6</span>Supply vs demand</h2>
      <p class="hint">Supply counts only providers with active services.</p>
      ${dataTable(
          ['Place', 'Supply', 'Jobs', 'Revenue', 'Jobs / provider'],
          report.supplyDemand.map((r) => [
              esc(r.area),
              esc(r.providers),
              esc(r.completedBookings),
              esc(money(r.revenue)),
              esc(r.bookingsPerProvider == null ? '—' : r.bookingsPerProvider),
          ])
      )}
    </section>

    <section class="block" id="health">
      <h2><span class="section-num">7</span>Health flags</h2>
      <div class="kpis">
        <div class="kpi"><div class="v">${esc(report.health.inactiveProviders)}</div><div class="l">Inactive providers</div></div>
        <div class="kpi"><div class="v">${esc(report.health.zeroServices)}</div><div class="l">Zero services</div></div>
        <div class="kpi"><div class="v">${esc(report.health.notActivationPaid)}</div><div class="l">Not activation paid</div></div>
        <div class="kpi"><div class="v">${esc(report.health.adminUnpaidServices)}</div><div class="l">Admin-unpaid services</div></div>
      </div>
    </section>

    <footer class="page-foot">
      <span>Zemen Service admin · provider distribution</span>
      <span>${esc(day)} · open in a browser · File → Print if you need a PDF</span>
    </footer>
  </div>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
(function () {
  var datasets = {
    all: ${mapAllJson},
    svc: ${mapSvcJson}
  };
  var hints = {
    all: ${JSON.stringify(`Bubble size ∝ provider count. ${mapAll.length} places plotted${mapUnmappedAll > 0 ? ` · ${mapUnmappedAll} unmapped` : ''}.`)},
    svc: ${JSON.stringify(`Bubble size ∝ provider count. ${mapSvc.length} places plotted${mapUnmappedSvc > 0 ? ` · ${mapUnmappedSvc} unmapped` : ''}.`)}
  };
  var mapEl = document.getElementById('loc-map');
  if (!mapEl || typeof L === 'undefined') return;

  var map = L.map(mapEl, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);

  var layer = L.layerGroup().addTo(map);
  var btnAll = document.getElementById('map-btn-all');
  var btnSvc = document.getElementById('map-btn-svc');
  var hintEl = document.getElementById('map-hint');

  // Keep bubbles small — most pins sit inside Addis and used to obliterate each other.
  function radiusFor(count, maxCount) {
    var t = Math.sqrt(count / Math.max(1, maxCount));
    return 4 + t * 10;
  }

  function render(mode) {
    var points = datasets[mode] || [];
    layer.clearLayers();
    if (hintEl) hintEl.textContent = hints[mode] || '';
    if (btnAll) btnAll.setAttribute('aria-pressed', mode === 'all' ? 'true' : 'false');
    if (btnSvc) btnSvc.setAttribute('aria-pressed', mode === 'svc' ? 'true' : 'false');
    if (!points.length) {
      map.setView([9.02, 38.75], 6);
      return;
    }
    var maxCount = 1;
    for (var i = 0; i < points.length; i++) maxCount = Math.max(maxCount, points[i].count);
    var bounds = [];
    for (var j = 0; j < points.length; j++) {
      var p = points[j];
      var circle = L.circleMarker([p.lat, p.lng], {
        radius: radiusFor(p.count, maxCount),
        color: '#015c2d',
        weight: 1,
        fillColor: mode === 'svc' ? '#0f766e' : '#027a3b',
        fillOpacity: 0.42
      });
      circle.bindPopup('<strong>' + p.name + '</strong><br>' + p.count + ' provider' + (p.count === 1 ? '' : 's'));
      circle.bindTooltip(p.name + ' · ' + p.count, { direction: 'top', opacity: 0.95 });
      circle.addTo(layer);
      bounds.push([p.lat, p.lng]);
    }
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
  }

  if (btnAll) btnAll.addEventListener('click', function () { render('all'); });
  if (btnSvc) btnSvc.addEventListener('click', function () { render('svc'); });
  render('all');
  setTimeout(function () { map.invalidateSize(); }, 80);
})();
</script>
</body>
</html>`;
}
