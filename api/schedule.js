const { getUpcomingWebinars } = require('./_schedule');

// GET /api/schedule?count=8 — returns the upcoming webinar sessions that
// feed the registration dropdown. Single source shared with server-side
// validation in register.js.
module.exports = function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const requested = parseInt(req.query.count, 10);
  const count = Math.min(Number.isFinite(requested) && requested > 0 ? requested : 8, 16);
  const webinars = getUpcomingWebinars(count);

  // Cache briefly in the browser and longer at the edge — the list only
  // changes on a weekly boundary.
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
  return res.status(200).json({ webinars });
};
