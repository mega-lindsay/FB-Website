// Single source of truth for the webinar schedule.
//
// Webinars run every Wednesday at 2:00 PM America/New_York (Eastern). This
// module generates the next N upcoming sessions on demand, so the schedule
// rolls forward automatically and never goes stale — no hardcoded dates in
// the HTML, the CRM validation, or anywhere else.

const TZ = 'America/New_York';
const WEBINAR_HOUR = 14;    // 2:00 PM local Eastern
const WEBINAR_WEEKDAY = 3;  // Wednesday (0 = Sunday)

// Eastern UTC-offset string (e.g. '-04:00' for EDT, '-05:00' for EST) at a
// given instant. Uses the IANA zone so DST is handled correctly.
function etOffset(instant) {
  const name = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, timeZoneName: 'shortOffset'
  }).formatToParts(instant).find(p => p.type === 'timeZoneName').value; // 'GMT-4'
  const m = name.match(/GMT([+-]?)(\d{1,2})(?::(\d{2}))?/);
  const sign = m[1] === '-' ? '-' : '+';
  const hh = String(m[2]).padStart(2, '0');
  const mm = m[3] || '00';
  return `${sign}${hh}:${mm}`;
}

// Eastern calendar date (YYYY-MM-DD) for a given instant.
function etDateStr(instant) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit'
  }).format(instant);
}

// Human label, e.g. "Wednesday, July 22 at 2:00 PM EDT".
function humanize(instant) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'long', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short'
  }).formatToParts(instant);
  const get = t => (parts.find(p => p.type === t) || {}).value || '';
  return `${get('weekday')}, ${get('month')} ${get('day')} at ${get('hour')}:${get('minute')} ${get('dayPeriod')} ${get('timeZoneName')}`;
}

// The exact instant for 2:00 PM Eastern on the given Eastern calendar day.
function webinarInstant(year, month, day) {
  // Sample the offset in the afternoon, well clear of the 2 AM DST boundary.
  const sample = new Date(Date.UTC(year, month - 1, day, 18, 0, 0));
  const offset = etOffset(sample);
  const iso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    + `T${String(WEBINAR_HOUR).padStart(2, '0')}:00:00${offset}`;
  return { iso, date: new Date(iso) };
}

// The next `count` upcoming webinars, each { iso, human }. A session is
// "upcoming" until its 2:00 PM ET start time passes.
function getUpcomingWebinars(count = 8, now = new Date()) {
  const results = [];
  const startStr = etDateStr(now);                 // Eastern calendar "today"
  const cursor = new Date(`${startStr}T00:00:00Z`); // iterate day-by-day in UTC
  for (let i = 0; i < 120 && results.length < count; i++) {
    if (cursor.getUTCDay() === WEBINAR_WEEKDAY) {
      const { iso, date } = webinarInstant(
        cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()
      );
      if (date.getTime() > now.getTime()) {
        results.push({ iso, human: humanize(date) });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return results;
}

// Is this ISO string one of the currently-valid upcoming sessions? Uses a
// generous look-ahead so a date can't fall out between page load and submit.
function isValidWebinarDate(iso, now = new Date()) {
  if (!iso) return false;
  return getUpcomingWebinars(16, now).some(w => w.iso === iso);
}

// Human label for a valid submitted date, or null if it isn't a valid session.
function humanForDate(iso, now = new Date()) {
  const match = getUpcomingWebinars(16, now).find(w => w.iso === iso);
  return match ? match.human : null;
}

module.exports = { getUpcomingWebinars, isValidWebinarDate, humanForDate };
