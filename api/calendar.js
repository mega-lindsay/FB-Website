// Calendar helper for webinar registrations.
//
// Accepts either:
//   ?date=<ISO or parseable datetime>   — single start time; end is +1 hour
//   ?dates=<START>/<END>                — legacy compact UTC pair (used by the
//                                         website success state, already formatted)
// and optionally:
//   ?provider=google                    — 302-redirect to a prefilled Google
//                                         Calendar event (otherwise returns .ics)
//
// This exists because email merge fields (e.g. Zoho's Webinar Date) render a
// human/ISO date, NOT the compact YYYYMMDDTHHMMSSZ format Google/ICS require.
// Formatting on the server means the emails just pass the raw date through.

const WEBINAR_URL = 'https://fbe.webinargeek.com/the-federal-employee-hour-of-power-benefits-briefing/join/ouyu0khg';
const TITLE = 'The Federal Employee "Hour of Power" Benefits Briefing';
const DETAILS = `Join the webinar here: ${WEBINAR_URL}`;
const TZ = 'America/New_York';
const DURATION_MS = 60 * 60 * 1000;

// Eastern UTC-offset (e.g. '-04:00'/'-05:00') at a given instant, DST-aware.
function etOffset(instant) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'shortOffset' })
    .formatToParts(instant).find(p => p.type === 'timeZoneName').value; // 'GMT-4'
  const m = name.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
  const sign = m[1] === '-' ? '-' : '+';
  return `${sign}${String(m[2]).padStart(2, '0')}:${m[3] || '00'}`;
}

// Parse a webinar date string to a Date. Handles ISO-8601 with an explicit
// offset directly; for a timezone-less datetime it assumes Eastern (all
// webinars run 2 PM ET), so Google/ICS get the correct instant.
function parseToInstant(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  try { s = decodeURIComponent(s); } catch (e) { /* already decoded */ }
  s = s.trim();
  if (!s) return null;

  const hasTz = /(?:z|[+-]\d{2}:?\d{2})$/i.test(s);
  if (hasTz) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }

  // Pull Y-M-D H:M[:S] out of ISO-ish or "YYYY-MM-DD HH:MM:SS" and treat as ET.
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (m) {
    const [, Y, Mo, D, H, Mi, Se] = m;
    const sample = new Date(Date.UTC(+Y, +Mo - 1, +D, 18, 0, 0)); // afternoon, clear of DST edge
    const iso = `${Y}-${Mo}-${D}T${H}:${Mi}:${Se || '00'}${etOffset(sample)}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  // Fallback: let the engine try (may assume server TZ — last resort only).
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// Date -> compact UTC 'YYYYMMDDTHHMMSSZ'.
function toCompactUtc(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const { date, dates, provider } = req.query;

  let startCompact, endCompact;
  if (dates && dates.includes('/')) {
    // Legacy: already-formatted compact START/END from the website.
    [startCompact, endCompact] = dates.split('/');
    if (!startCompact || !endCompact) {
      return res.status(400).send('Invalid dates format.');
    }
  } else if (date) {
    const start = parseToInstant(date);
    if (!start) return res.status(400).send('Could not parse the webinar date.');
    startCompact = toCompactUtc(start);
    endCompact = toCompactUtc(new Date(start.getTime() + DURATION_MS));
  } else {
    return res.status(400).send('Missing webinar date.');
  }

  if (provider === 'google') {
    const url = 'https://www.google.com/calendar/render?action=TEMPLATE'
      + `&text=${encodeURIComponent(TITLE)}`
      + `&dates=${startCompact}/${endCompact}`
      + `&details=${encodeURIComponent(DETAILS)}`;
    res.statusCode = 302;
    res.setHeader('Location', url);
    return res.end();
  }

  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Federal Benefits Exchange//Webinar//EN
BEGIN:VEVENT
DTSTAMP:${dtstamp}
DTSTART:${startCompact}
DTEND:${endCompact}
SUMMARY:${TITLE}
DESCRIPTION:${DETAILS}
URL:${WEBINAR_URL}
END:VEVENT
END:VCALENDAR`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="webinar.ics"');
  res.send(icsContent);
};
