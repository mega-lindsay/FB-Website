const express = require('express');
const path = require('path');
const registerHandler = require('./api/register');
const contactHandler = require('./api/contact');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Remove trailing slashes and redirect to avoid MIME type issues with relative assets
app.use((req, res, next) => {
  if (req.path.endsWith('/') && req.path.length > 1) {
    const query = req.url.slice(req.path.length);
    res.redirect(301, req.path.slice(0, -1) + query);
  } else {
    next();
  }
});

// Explicitly handle top-level routes to avoid conflicts with directories (e.g. /blog vs /blog/)
// MUST be before express.static so express doesn't auto-redirect /blog to /blog/
const pages = ['/', '/index', '/about', '/blog', '/faq', '/resources', '/glossary', '/contact'];
pages.forEach(page => {
  app.get(page, (req, res) => {
    const filename = page === '/' || page === '/index' ? 'index.html' : `${page.substring(1)}.html`;
    res.sendFile(path.join(__dirname, filename));
  });
});

// Serve static assets from project root, allowing extensionless HTML
app.use(express.static(path.join(__dirname), { extensions: ['html'] }));

// REST Endpoint to handle registrations (delegated to standard API handler)
app.post('/api/register', registerHandler);

// REST Endpoint to handle contact form submissions
app.post('/api/contact', contactHandler);

const calendarHandler = require('./api/calendar');

// ICS Calendar Generator Endpoint
app.get('/api/calendar', calendarHandler);

const scheduleHandler = require('./api/schedule');

// Upcoming webinar schedule (single source for the registration dropdown)
app.get('/api/schedule', scheduleHandler);



// For any other non-file route, redirect to home or handle as SPA if desired
// In this case, we'll let 404s happen for missing files so the browser doesn't try to parse HTML as CSS.

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

module.exports = app;
