module.exports = async function handler(req, res) {
  // Set CORS headers if needed
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  const dates = req.query.dates; // Expected format: YYYYMMDDTHHMMSSZ/YYYYMMDDTHHMMSSZ
  
  if (!dates || !dates.includes('/')) {
    return res.status(400).send('Invalid dates format.');
  }
  
  const [start, end] = dates.split('/');
  const webinarUrl = 'https://fbe.webinargeek.com/the-federal-employee-hour-of-power-benefits-briefing/join/ouyu0khg';
  
  const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Federal Benefits Exchange//Webinar//EN
BEGIN:VEVENT
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${start}
DTEND:${end}
SUMMARY:Federal Benefits Webinar
DESCRIPTION:Join the webinar here: ${webinarUrl}
URL:${webinarUrl}
END:VEVENT
END:VCALENDAR`;

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="webinar.ics"');
  res.send(icsContent);
};
