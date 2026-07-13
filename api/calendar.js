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

// Every webinar runs at 2:00 PM Eastern (fixed schedule — see api/_schedule.js).
// The merge field's time is unreliable (Zoho renders it in varying formats and
// timezones), so we derive only the DATE from it and always apply the known
// 2 PM ET start. This keeps the calendar time correct regardless of format.
const WEBINAR_HOUR = 14;

function parseToInstant(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  try { s = decodeURIComponent(s); } catch (e) { /* already decoded */ }
  s = s.trim();
  if (!s) return null;

  // Extract the calendar date (year, month, day) from common formats.
  let Y, Mo, D, m;
  if ((m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/))) {            // ISO-ish YYYY-MM-DD
    Y = +m[1]; Mo = +m[2]; D = +m[3];
  } else if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {   // US M/D/YYYY
    Mo = +m[1]; D = +m[2]; Y = +m[3];
  } else {
    const d = new Date(s);                                       // last resort
    if (isNaN(d.getTime())) return null;
    Y = d.getUTCFullYear(); Mo = d.getUTCMonth() + 1; D = d.getUTCDate();
  }

  // Build the instant for 2 PM Eastern on that date (DST-aware offset).
  const sample = new Date(Date.UTC(Y, Mo - 1, D, 18, 0, 0)); // afternoon, clear of DST edge
  const iso = `${Y}-${String(Mo).padStart(2, '0')}-${String(D).padStart(2, '0')}`
    + `T${String(WEBINAR_HOUR).padStart(2, '0')}:00:00${etOffset(sample)}`;
  const d = new Date(iso);
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
  // Stable UID per session so re-importing updates the event instead of
  // creating a duplicate.
  const uid = `${startCompact}-fbe-webinar@federalbenefitsexchange.com`;
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Federal Benefits Exchange//Webinar//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${dtstamp}
DTSTART:${startCompact}
DTEND:${endCompact}
SUMMARY:${TITLE}
DESCRIPTION:${DETAILS}
LOCATION:${WEBINAR_URL}
URL:${WEBINAR_URL}
END:VEVENT
END:VCALENDAR`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="webinar.ics"');
  res.send(icsContent);
};
