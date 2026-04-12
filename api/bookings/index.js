'use strict';

// ════════════════════════════════════════════════════════════
//  SportyHQ API Proxy
//
//  Forwards GET /api/bookings?date=YYYY-MM-DD to the upstream
//  SportyHQ API using credentials stored as Azure Application
//  Settings (SPORTYHQ_API_KEY, SPORTYHQ_CLUB_KEY).
//  Credentials are never exposed to the browser.
// ════════════════════════════════════════════════════════════

const https = require('https');

const UPSTREAM_BASE = 'https://www.sportyhq.com/api/book/daily_bookings';
const DATE_PATTERN  = /^\d{4}-\d{2}-\d{2}$/;

module.exports = async function (context, req) {
  // ── TEMPORARY PING: remove once confirmed working ──────────
  if (req.query.ping) {
    context.res = { status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: true }) };
    return;
  }

  context.log('Bookings function invoked. Query params:', JSON.stringify(req.query));

  const apiKey  = process.env.SPORTYHQ_API_KEY;
  const clubKey = process.env.SPORTYHQ_CLUB_KEY;

  context.log(`Env check — API_KEY present: ${!!apiKey}, CLUB_KEY present: ${!!clubKey}`);

  if (!apiKey || !clubKey) {
    context.log.error('SPORTYHQ_API_KEY or SPORTYHQ_CLUB_KEY is not set in Application Settings.');
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server configuration error.' }),
    };
    return;
  }

  const date = req.query.date;
  context.log('Date param received:', date);

  if (!date || !DATE_PATTERN.test(date)) {
    context.log.warn('Invalid or missing date param:', date);
    context.res = {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Missing or invalid date parameter. Expected YYYY-MM-DD.' }),
    };
    return;
  }

  const upstreamUrl = `${UPSTREAM_BASE}` +
    `?X-API-KEY=${encodeURIComponent(apiKey)}` +
    `&club_key=${encodeURIComponent(clubKey)}` +
    `&date=${encodeURIComponent(date)}`;

  // Log the URL with credentials redacted
  context.log('Calling upstream:', `${UPSTREAM_BASE}?X-API-KEY=[REDACTED]&club_key=[REDACTED]&date=${encodeURIComponent(date)}`);

  try {
    const { statusCode, body: data } = await httpsGetJson(upstreamUrl);
    context.log(`Upstream responded with HTTP ${statusCode}`);
    context.log('Upstream response body (first 500 chars):', JSON.stringify(data).slice(0, 500));
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    };
  } catch (err) {
    context.log.error('Upstream SportyHQ request failed:', err.message);
    context.res = {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Failed to fetch upstream booking data.', detail: err.message }),
    };
  }
};

// Wrapper around https.get that resolves with { statusCode, body }.
function httpsGetJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(raw) });
        } catch {
          reject(new Error(`Upstream response was not valid JSON (HTTP ${res.statusCode}). Body starts: ${raw.slice(0, 200)}`));
        }
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}
