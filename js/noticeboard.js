/* ════════════════════════════════════════════════════════════
   Pirates TC — Court Availability Board
   JavaScript — API fetch, data processing, render logic
   ════════════════════════════════════════════════════════════ */

// ════════════════════════════════════════════════════════════
//  API CONFIG
//  ── Requests go to the Azure Function proxy at /api/bookings
//  ── The proxy holds the SportyHQ credentials server-side ─
// ════════════════════════════════════════════════════════════
const API_BASE = '/api/bookings';

// How often to re-fetch from the API (milliseconds)
const REFRESH_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

// ════════════════════════════════════════════════════════════
//  COURT CONFIG
//  ── Adjust names/types to match your actual courts ───────
//  type: 'members' | 'genflood' | 'general'
// ════════════════════════════════════════════════════════════
const COURTS = [
  { id:1, assetName:'Court 1', type:'members',  label:'Members · Floodlit' },
  { id:2, assetName:'Court 2', type:'members',  label:'Members · Floodlit' },
  { id:3, assetName:'Court 3', type:'genflood', label:'General · Floodlit'  },
  { id:4, assetName:'Court 4', type:'genflood', label:'General · Floodlit'  },
  { id:5, assetName:'Court 5', type:'general',  label:'General'             },
  { id:6, assetName:'Court 6', type:'general',  label:'General'             },
];

// ════════════════════════════════════════════════════════════
//  BOOKING TYPE CLASSIFICATION
//  ── Customise this with your own block booking IDs ───────
//  ── Return: 'member' | 'lesson' | 'club' | 'maint' ──────
// ════════════════════════════════════════════════════════════
function classifyBooking(booking) {
  // All bookings in this demo are member bookings.
  // When you have your own data, check booking.multiple_unique_id
  // or other fields to return 'lesson', 'club', or 'maint'.
  // Example:
  //   if (booking.multiple_unique_id === 'block_v2_999') return 'lesson';
  return 'member';
}

// ════════════════════════════════════════════════════════════
//  DISPLAY CONFIG
// ════════════════════════════════════════════════════════════
const COURT_OPEN   = 8;   // Opening hour (24h)
const COURT_CLOSE  = 21;  // Closing hour (24h)
const SLOT_MINS    = 30;  // Duration of each slot in minutes
const WINDOW_SLOTS = 6;   // Number of slots visible (6 × 30min = 3 hours)

const BOLT_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`;

// ════════════════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════════════════
let currentBlocks = []; // Processed bookings: [{court, start, name, type}, ...]
let lastFetchTime = null;

// ════════════════════════════════════════════════════════════
//  API FETCH
//  Converts SportyHQ API response → internal block format
// ════════════════════════════════════════════════════════════
async function fetchBookings() {
  setFetchStatus('loading', 'Refreshing…');

  const today = getTodayDateString();
  const url   = `${API_BASE}?date=${today}`;

  try {
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    if (data.status !== 'success') throw new Error('API returned non-success status');

    // Use active bookings only.
    // Filter to parent_booking_id === null to avoid processing
    // overlapping child records from multi-slot bookings.
    const active = (data.bookings?.active ?? []).filter(b => b.parent_booking_id === null);

    currentBlocks = active.map(b => ({
      court: courtNumFromName(b.club_asset_name),
      start: b.start_time.slice(0, 5),          // "HH:MM:SS" → "HH:MM"
      name:  b.owner_name || 'Block Booking',   // owner_name can be false
      type:  classifyBooking(b),
    })).filter(b => b.court !== null);

    lastFetchTime = new Date();
    setFetchStatus('ok', `Updated ${formatTime(lastFetchTime)}`);

  } catch (err) {
    console.error('Booking fetch failed:', err);
    setFetchStatus('error', 'Fetch failed – retrying');
    // Keep displaying previous data if available
  }

  render();
  document.getElementById('loadingOverlay').classList.add('hidden');
}

// Extract court number from asset name e.g. "Court 3" → 3
function courtNumFromName(name) {
  const match = name.match(/\d+/);
  return match ? parseInt(match[0]) : null;
}

function setFetchStatus(state, text) {
  const el = document.getElementById('fetchStatus');
  el.className = 'fetch-status' + (state === 'error' ? ' error' : state === 'loading' ? ' loading' : '');
  el.textContent = text;
}

// ════════════════════════════════════════════════════════════
//  DATE & TIME HELPERS
// ════════════════════════════════════════════════════════════

function getTodayDateString() {
  // ── DEMO ONLY ── hardcoded to match demo API data.
  // For production, remove this line and uncomment the block below.
  return '2024-05-28'; // ← REMOVE FOR PRODUCTION

  // const d = new Date();
  // return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getNowMins() {
  // ── DEMO ONLY ── pinned to 09:42 to show morning bookings.
  // For production, remove this line and uncomment the line below.
  return 9 * 60 + 42; // ← REMOVE FOR PRODUCTION

  // const n = new Date(); return n.getHours() * 60 + n.getMinutes();
}

function hhmm2mins(s) {
  const [h, m] = s.split(':').map(Number);
  return h * 60 + m;
}

function mins2label(m) {
  const h      = Math.floor(m / 60);
  const mm     = m % 60;
  const suffix = h < 12 ? 'am' : 'pm';
  const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return mm === 0
    ? `${h12}${suffix}`
    : `${h12}:${String(mm).padStart(2,'0')}${suffix}`;
}

function mins2ruler(m) {
  const h  = Math.floor(m / 60);
  const mm = m % 60;
  if (mm === 0) {
    const suffix = h < 12 ? 'am' : 'pm';
    const h12    = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}${suffix}`;
  }
  return `:${String(mm).padStart(2,'0')}`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
}

function floorSlot(m) {
  return Math.floor(m / SLOT_MINS) * SLOT_MINS;
}

// ════════════════════════════════════════════════════════════
//  MERGE consecutive same-name 30-min blocks → visual runs
//  e.g. 3 × "Smith / Jones" at 09:00, 09:30, 10:00
//       → one run { startMins:540, endMins:630 }
// ════════════════════════════════════════════════════════════
function mergeBlocks(courtId, allBlocks) {
  const blocks = allBlocks
    .filter(b => b.court === courtId)
    .map(b => ({ name: b.name, type: b.type, startMins: hhmm2mins(b.start) }))
    .sort((a, b) => a.startMins - b.startMins);

  const merged = [];
  for (const blk of blocks) {
    const last = merged[merged.length - 1];
    if (
      last &&
      last.name === blk.name &&
      last.type === blk.type &&
      last.endMins === blk.startMins
    ) {
      last.endMins += SLOT_MINS;
    } else {
      merged.push({ ...blk, endMins: blk.startMins + SLOT_MINS });
    }
  }
  return merged;
}

// ════════════════════════════════════════════════════════════
//  WINDOW — the 6 visible 30-min slots starting from now
// ════════════════════════════════════════════════════════════
function getWindowSlots(nowMins) {
  const windowStart = floorSlot(nowMins);
  return Array.from({ length: WINDOW_SLOTS }, (_, i) => windowStart + i * SLOT_MINS);
}

// ════════════════════════════════════════════════════════════
//  SUMMARY — "What's next" logic for the right-hand panel
// ════════════════════════════════════════════════════════════
function getSummary(courtId, runs, windowSlots) {
  const windowEnd = windowSlots[windowSlots.length - 1] + SLOT_MINS;
  const lastSlot  = windowSlots[windowSlots.length - 1];

  // Is the last visible slot occupied?
  const lastOcc = runs.find(r => r.startMins <= lastSlot && r.endMins > lastSlot);

  if (lastOcc) {
    // Court is booked at the end of the window.
    // Show when it next becomes free.
    const freeAt = lastOcc.endMins;
    if (freeAt >= COURT_CLOSE * 60) {
      return { status:'closed', main:'No more play today', sub:'' };
    }
    const next = runs.find(r => r.startMins >= freeAt);
    if (next) {
      return { status:'booked', main:`Free ${mins2label(freeAt)}`, sub:`then ${next.name} ${mins2label(next.startMins)}` };
    }
    return { status:'booked', main:`Free from ${mins2label(freeAt)}`, sub:'until close' };
  } else {
    // Court is free at the end of the window.
    // Show when the next booking starts.
    const next = runs.find(r => r.startMins >= windowEnd);
    if (!next) return { status:'free', main:'Free all evening', sub:'' };
    return { status:'free', main:`Free until ${mins2label(next.startMins)}`, sub:`then ${next.name}` };
  }
}

// ════════════════════════════════════════════════════════════
//  RENDER — builds the full DOM from currentBlocks state
// ════════════════════════════════════════════════════════════
function render() {
  const nowMins     = getNowMins();
  const windowSlots = getWindowSlots(nowMins);
  const windowStart = windowSlots[0];
  const windowEnd   = windowSlots[windowSlots.length - 1] + SLOT_MINS;
  const nowFrac     = (nowMins - windowStart) / (WINDOW_SLOTS * SLOT_MINS);

  // ── Clock
  // ── DEMO ONLY: fixed values. For production replace both lines:
  //    document.getElementById('clock').textContent = formatTime(new Date());
  //    const d = new Date();
  document.getElementById('clock').textContent = '09:42'; // ← CHANGE FOR PRODUCTION
  const d = new Date('2024-05-28');                        // ← CHANGE FOR PRODUCTION

  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('dateline').textContent =
    `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // ── Window range label
  document.getElementById('windowRange').textContent =
    `${mins2label(windowStart)} – ${mins2label(windowEnd)}`;

  // ── Time ruler
  document.getElementById('rulerSlots').innerHTML = windowSlots.map((sm, idx) => {
    const isOnHour = sm % 60 === 0;
    const isNow    = nowMins >= sm && nowMins < sm + SLOT_MINS;
    const cls = ['ruler-slot', isOnHour ? 'on-hour':'', isNow ? 'is-now':''].filter(Boolean).join(' ');
    return `<div class="${cls}">${mins2ruler(sm)}</div>`;
  }).join('');

  // ── Court rows
  const courtsList = document.getElementById('courtsList');
  courtsList.innerHTML = '';

  for (const court of COURTS) {
    const runs       = mergeBlocks(court.id, currentBlocks);
    const summary    = getSummary(court.id, runs, windowSlots);
    const isFloodlit = court.type === 'members' || court.type === 'genflood';

    // Build slot cells
    const cellsHTML = windowSlots.map((sm, idx) => {
      const run        = runs.find(r => r.startMins <= sm && r.endMins > sm);
      const isOccupied = !!run;
      const isStart    = isOccupied && run.startMins === sm;
      const isHourStart = sm % 60 === 0 && idx > 0;
      const bgCls   = isOccupied ? `occ-${run.type}` : 'free-cell';
      const hourCls = isHourStart ? ' hour-start' : '';

      let blockHTML = '';
      if (isStart) {
        // Calculate visual width to span all slots in this run
        const clamped   = Math.min(run.endMins, windowEnd);
        const spanned   = (clamped - run.startMins) / SLOT_MINS;
        const widthCalc = `calc(${spanned * 100}% + ${spanned - 1}px)`;
        const timeLabel = `${mins2label(run.startMins)}–${mins2label(run.endMins)}`;
        blockHTML = `
          <div class="booking-block bb-${run.type}" style="left:2px;right:auto;width:${widthCalc};max-width:${widthCalc};">
            <div class="bb-name">${run.name}</div>
            <div class="bb-time">${timeLabel}</div>
          </div>`;
      }

      return `<div class="slot-cell ${bgCls}${hourCls}">${blockHTML}</div>`;
    }).join('');

    // Summary panel
    const statusLabels = { free:'Court free ›', booked:'Court busy ›', closed:'Closed' };
    const summaryHTML = `
      <div class="summary-inner">
        <div class="summary-status status-${summary.status}">${statusLabels[summary.status]}</div>
        <div class="summary-main">${summary.main}</div>
        ${summary.sub ? `<div class="summary-sub">${summary.sub}</div>` : ''}
      </div>`;

    const row = document.createElement('div');
    row.className = `court-row type-${court.type}`;
    row.innerHTML = `
      <div class="court-header">
        <span class="court-num">Court ${court.id}</span>
        <div class="court-divider"></div>
        <span class="court-type-badge">${court.label}</span>
        ${isFloodlit ? `<span class="floodlit-icon">${BOLT_SVG} Floodlit</span>` : ''}
      </div>
      <div class="court-body">
        <div class="slots-track">
          ${cellsHTML}
          <div class="now-line" style="left:${(nowFrac * 100).toFixed(3)}%"></div>
        </div>
        <div class="summary-panel">${summaryHTML}</div>
      </div>`;

    courtsList.appendChild(row);
  }

  // ── Ticker: upcoming bookings in the next 4 hours
  const cutoff   = nowMins + 4 * 60;
  const upcoming = [];

  for (const court of COURTS) {
    for (const run of mergeBlocks(court.id, currentBlocks)) {
      if (run.startMins > nowMins && run.startMins <= cutoff) {
        upcoming.push({ courtId: court.id, ...run });
      }
    }
  }

  upcoming.sort((a, b) => a.startMins - b.startMins);

  const tickerItems = upcoming.map(u =>
    `<span class="ticker-item">
      Court ${u.courtId} <span class="ticker-dim">·</span>
      ${u.name} <span class="ticker-dim">·</span>
      ${mins2label(u.startMins)}–${mins2label(u.endMins)}
      <span class="ticker-sep"> ◆ </span>
    </span>`
  ).join('');

  document.getElementById('tickerTrack').innerHTML = tickerItems + tickerItems;
}

// ════════════════════════════════════════════════════════════
//  CLOCK TICK
//  Runs every 30 seconds — re-renders to advance the now-line
//  and window position without a new API call.
// ════════════════════════════════════════════════════════════
function tickClock() {
  render();
}

// ════════════════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════════════════
fetchBookings();                                  // Initial load on page open
setInterval(fetchBookings, REFRESH_INTERVAL_MS);  // Re-fetch API every 5 minutes
setInterval(tickClock, 30_000);                   // Re-render every 30 seconds
