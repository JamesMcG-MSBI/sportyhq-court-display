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

const EVENING_LOCK_START = 20 * 60;  // 8:00pm — freeze window from this time onwards
const NEXT_DAY_AFTER     = 23 * 60;  // 11:00pm — switch to following day's bookings
const NEXT_DAY_OPEN      =  6 * 60;  // 6:00am  — first visible slot in next-day mode

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

  const today = getNowMins() >= NEXT_DAY_AFTER ? getTomorrowDateString() : getTodayDateString();
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
      durationMins: parseInt(b.length, 10) || SLOT_MINS,
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
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getTomorrowDateString() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getNowMins() {
  const n = new Date(); return n.getHours() * 60 + n.getMinutes();
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
    .map(b => ({ name: b.name, type: b.type, startMins: hhmm2mins(b.start), durationMins: b.durationMins || SLOT_MINS }))
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
      merged.push({ ...blk, endMins: blk.startMins + blk.durationMins });
    }
  }
  return merged;
}

// ════════════════════════════════════════════════════════════
//  WINDOW — the 6 visible 30-min slots starting from now
// ════════════════════════════════════════════════════════════
function getWindowSlots(nowMins) {
  let windowStart;
  if (nowMins >= NEXT_DAY_AFTER) {
    windowStart = NEXT_DAY_OPEN;           // 11pm–midnight: show 6am onwards (tomorrow)
  } else if (nowMins < NEXT_DAY_OPEN + SLOT_MINS) {
    windowStart = NEXT_DAY_OPEN;           // midnight–6:30am: show 6am onwards (today)
  } else if (nowMins >= EVENING_LOCK_START) {
    windowStart = EVENING_LOCK_START;      // 8pm–11pm: freeze at 8pm
  } else {
    windowStart = floorSlot(nowMins);      // Normal: slide with current time
  }
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

function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

function render() {
  const portrait = isPortrait();
  document.body.classList.toggle('is-portrait',  portrait);
  document.body.classList.toggle('is-landscape', !portrait);

  const nowMins     = getNowMins();
  const nextDayMode  = nowMins >= NEXT_DAY_AFTER;                           // 11pm–midnight: fetch/show tomorrow
  const earlyMorning = !nextDayMode && nowMins < NEXT_DAY_OPEN + SLOT_MINS; // midnight–6:30am: frozen 6am window
  // Hide cursor before 6am; reveal it once it enters the 6am+ window
  const cursorMins   = (nextDayMode || (earlyMorning && nowMins < NEXT_DAY_OPEN)) ? -1 : nowMins;
  const windowSlots = getWindowSlots(nowMins);
  const windowStart = windowSlots[0];
  const windowEnd   = windowSlots[windowSlots.length - 1] + SLOT_MINS;
  const nowFrac     = (cursorMins - windowStart) / (WINDOW_SLOTS * SLOT_MINS);

  // ── Shared: clock & date (show tomorrow's date when in next-day mode)
  document.getElementById('clock').textContent = formatTime(new Date());
  const d = nextDayMode ? (() => { const t = new Date(); t.setDate(t.getDate() + 1); return t; })() : new Date();
  const DAYS   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  document.getElementById('dateline').textContent =
    `${DAYS[d.getDay()]} · ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

  // ── Shared: window range label
  document.getElementById('windowRange').textContent =
    `${mins2label(windowStart)} – ${mins2label(windowEnd)}`;

  if (portrait) {
    renderPortrait(cursorMins, windowSlots, windowEnd);
  } else {
    renderLandscape(cursorMins, windowSlots, windowStart, windowEnd, nowFrac);
  }

  // ── Shared: ticker — upcoming bookings in the next 4 hours
  // In next-day mode, anchor from the window start rather than real now
  const tickerBase = nextDayMode ? windowStart : nowMins;
  const cutoff     = tickerBase + 4 * 60;
  const upcoming   = [];

  for (const court of COURTS) {
    for (const run of mergeBlocks(court.id, currentBlocks)) {
      if (run.startMins > tickerBase && run.startMins <= cutoff) {
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
//  RENDER LANDSCAPE — horizontal slot rows (original layout)
// ════════════════════════════════════════════════════════════
function renderLandscape(nowMins, windowSlots, windowStart, windowEnd, nowFrac) {
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

    const cellsHTML = windowSlots.map((sm, idx) => {
      const run         = runs.find(r => r.startMins <= sm && r.endMins > sm);
      const isOccupied  = !!run;
      const isStart     = isOccupied && run.startMins === sm;
      const isHourStart = sm % 60 === 0 && idx > 0;
      const bgCls       = isOccupied ? `occ-${run.type}` : 'free-cell';
      const hourCls     = isHourStart ? ' hour-start' : '';

      let blockHTML = '';
      if (isStart) {
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
}

// ════════════════════════════════════════════════════════════
//  RENDER PORTRAIT — 3×2 grid, slots stacked vertically
// ════════════════════════════════════════════════════════════
function renderPortrait(nowMins, windowSlots, windowEnd) {
  const grid = document.getElementById('courtsGrid');
  grid.innerHTML = '';

  for (const court of COURTS) {
    const runs       = mergeBlocks(court.id, currentBlocks);
    const summary    = getSummary(court.id, runs, windowSlots);
    const isFloodlit = court.type === 'members' || court.type === 'genflood';

    const slotRowsHTML = windowSlots.map((sm, idx) => {
      const run         = runs.find(r => r.startMins <= sm && r.endMins > sm);
      const isOccupied  = !!run;
      const isStart     = isOccupied && run.startMins === sm;
      const isHourStart = sm % 60 === 0 && idx > 0;
      const bgCls       = isOccupied ? `occ-${run.type}` : 'free-cell';
      const hourCls     = isHourStart ? ' hour-start' : '';

      let nowLineHTML = '';
      if (nowMins >= sm && nowMins < sm + SLOT_MINS) {
        const frac = (nowMins - sm) / SLOT_MINS;
        nowLineHTML = `<div class="now-line-h" style="top:${(frac * 100).toFixed(2)}%"></div>`;
      }

      let blockHTML = '';
      if (isStart) {
        const clamped   = Math.min(run.endMins, windowEnd);
        const spanSlots = (clamped - run.startMins) / SLOT_MINS;
        const timeLabel = `${mins2label(run.startMins)}–${mins2label(run.endMins)}`;
        blockHTML = `
          <div class="booking-block bb-${run.type}" data-span="${spanSlots}" style="bottom:auto;">
            <div class="bb-name">${run.name}</div>
            <div class="bb-time">${timeLabel}</div>
          </div>`;
      }

      return `
        <div class="slot-row${hourCls}">
          <div class="slot-time-label">${mins2ruler(sm)}</div>
          <div class="slot-fill ${bgCls}">
            ${blockHTML}
            ${nowLineHTML}
          </div>
        </div>`;
    }).join('');

    const statusLabels = { free:'Court free ›', booked:'Court busy ›', closed:'Closed' };
    const card = document.createElement('div');
    card.className = `court-card type-${court.type}`;
    card.innerHTML = `
      <div class="court-header">
        <span class="court-num">Court ${court.id}</span>
        <div class="court-divider"></div>
        <span class="court-type-badge">${court.label}</span>
        ${isFloodlit ? `<span class="floodlit-icon">${BOLT_SVG} Floodlit</span>` : ''}
      </div>
      <div class="slots-stack">${slotRowsHTML}</div>
      <div class="summary-panel-p">
        <div class="summary-status status-${summary.status}">${statusLabels[summary.status]}</div>
        <div class="summary-main">${summary.main}</div>
        ${summary.sub ? `<div class="summary-sub">${summary.sub}</div>` : ''}
      </div>`;

    grid.appendChild(card);
  }

  // Fix booking-block heights now that rows have real pixel heights
  requestAnimationFrame(() => {
    document.querySelectorAll('#courtsGrid .booking-block[data-span]').forEach(block => {
      const span = parseFloat(block.getAttribute('data-span'));
      const row  = block.closest('.slot-row');
      const rowH = row.getBoundingClientRect().height;
      block.style.height = `calc(${span} * ${rowH}px - 6px)`;
    });
  });
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
window.addEventListener('resize', render);        // Switch layout on orientation change
