const bizSdk = require('facebook-nodejs-business-sdk');
const { neon } = require('@neondatabase/serverless');
const { submitLeadToCRM } = require('./_zoho');
const { verifyTurnstile } = require('./_turnstile');
const { isValidWebinarDate, humanForDate } = require('./_schedule');

const META_ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const META_PIXEL_ID = process.env.META_PIXEL_ID;

if (META_ACCESS_TOKEN) {
  bizSdk.FacebookAdsApi.init(META_ACCESS_TOKEN);
}

// --- Neon Postgres Backup ---
let dbInitialized = false;

async function getDb() {
  const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn('Postgres backup skipped: POSTGRES_URL or DATABASE_URL not configured.');
    return null;
  }
  return neon(connectionString);
}

async function ensureTable(sql) {
  if (dbInitialized) return;
  await sql`
    CREATE TABLE IF NOT EXISTS registrations (
      id SERIAL PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      email TEXT,
      phone TEXT,
      agency TEXT,
      years_service TEXT,
      topic TEXT,
      webinar_date TEXT,
      webinar_date_human TEXT,
      zoho_record_id TEXT,
      source_page TEXT,
      marketing_consent BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Backfill the column for tables created before marketing_consent existed.
  await sql`ALTER TABLE registrations ADD COLUMN IF NOT EXISTS marketing_consent BOOLEAN`;
  dbInitialized = true;
  console.log('Postgres registrations table ready.');
}

// Returns true if this email is already registered for this webinar date.
// Best-effort: any DB error is swallowed so it never blocks a registration.
async function isDuplicateRegistration(email, webinarDate) {
  try {
    const sql = await getDb();
    if (!sql) return false;
    await ensureTable(sql);
    const rows = await sql`
      SELECT 1 FROM registrations
      WHERE lower(email) = ${email.toLowerCase()} AND webinar_date = ${webinarDate}
      LIMIT 1
    `;
    return rows.length > 0;
  } catch (err) {
    console.error('Duplicate check error (non-blocking):', err.message);
    return false;
  }
}

async function backupToPostgres(data) {
  try {
    const sql = await getDb();
    if (!sql) return;
    await ensureTable(sql);
    await sql`
      INSERT INTO registrations (first_name, last_name, email, phone, agency, years_service, topic, webinar_date, webinar_date_human, zoho_record_id, source_page, marketing_consent)
      VALUES (${data.firstName}, ${data.lastName}, ${data.email}, ${data.phone}, ${data.agency}, ${data.yearsService}, ${data.topic}, ${data.webinarDate}, ${data.webinarDateHuman}, ${data.zohoRecordId}, ${data.sourcePage}, ${data.marketingConsent})
    `;
    console.log('Postgres backup: registration saved successfully.');
  } catch (err) {
    console.error('Postgres backup error (non-blocking):', err.message);
  }
}

// Helper to map values to human-readable names for notes
const serviceMap = {
  '0-5': '0 – 5 years',
  '6-10': '6 – 10 years',
  '11-20': '11 – 20 years',
  '21+': '21+ years'
};

const topicMap = {
  'fegli': 'FEGLI Life Insurance',
  'tsp': 'TSP Retirement',
  'fehb': 'FEHB Health Insurance',
  'all': 'All three equally'
};

// Webinar dates are validated and humanized via the shared schedule module
// (api/_schedule.js) — the single rolling source of truth.

// Function to send event to Meta Conversions API
async function sendMetaCapiEvent(req, userData, eventData) {
  if (!META_ACCESS_TOKEN || !META_PIXEL_ID) {
    console.warn('Meta CAPI skipped: META_ACCESS_TOKEN or META_PIXEL_ID not configured.');
    return;
  }

  const { ServerEvent, EventRequest, UserData } = bizSdk;
  
  try {
    // 1. Setup User Data
    const user = (new UserData())
      .setEmail(userData.email)
      .setPhone(userData.phone)
      .setFirstName(userData.firstName)
      .setLastName(userData.lastName)
      .setClientIpAddress(req.headers['x-forwarded-for'] || req.socket.remoteAddress)
      .setClientUserAgent(userData.clientUserAgent);

    if (userData.fbp) user.setFbp(userData.fbp);
    if (userData.fbc) user.setFbc(userData.fbc);

    // 2. Setup Event
    const serverEvent = (new ServerEvent())
      .setEventName('Lead')
      .setEventTime(Math.floor(new Date() / 1000))
      .setUserData(user)
      .setEventSourceUrl(userData.eventSourceUrl)
      .setEventId(userData.eventId) // For Deduplication
      .setActionSource('website');

    // 3. Execute Request
    const eventRequest = (new EventRequest(META_ACCESS_TOKEN, META_PIXEL_ID))
      .setEvents([serverEvent]);
      
    const response = await eventRequest.execute();
    console.log('Meta CAPI Success: Lead event accepted.');
    return response;
  } catch (error) {
    console.error('Meta CAPI Error:', error.message);
  }
}

// Serverless / Express request handler
module.exports = async function handler(req, res) {
  // Set CORS headers if needed, and handle preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const { firstName, lastName, email, phone, yearsService, topic, webinarDate, agency } = req.body;
    const marketingConsent = req.body.marketingConsent === true;

    // 1. Cloudflare Turnstile CAPTCHA check
    const { turnstileToken } = req.body;
    if (!turnstileToken) {
      return res.status(400).json({ success: false, error: 'Security check failed. Please complete the CAPTCHA.' });
    }

    let turnstileOk;
    try {
      turnstileOk = await verifyTurnstile(req, turnstileToken);
    } catch (err) {
      console.error('Turnstile verification error:', err);
      return res.status(500).json({ success: false, error: 'Could not verify security check due to network error.' });
    }
    if (!turnstileOk) {
      console.warn('Spam detected: Turnstile validation failed.');
      return res.status(400).json({ success: false, error: 'Security check failed. Please refresh the page and try again.' });
    }

    if (!firstName || !lastName || !email || !webinarDate) {
      return res.status(400).json({ success: false, error: 'First Name, Last Name, Email, and Webinar Date are required.' });
    }

    // --- Server-side validation (never trust the client) ---
    // Length caps to reject abuse / oversized payloads.
    const lengthLimits = {
      firstName: 100, lastName: 100, email: 254, phone: 30,
      agency: 50, yearsService: 20, topic: 20
    };
    for (const [field, max] of Object.entries(lengthLimits)) {
      const val = req.body[field];
      if (typeof val === 'string' && val.length > max) {
        return res.status(400).json({ success: false, error: `The ${field} field is too long.` });
      }
    }

    // Email format.
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(String(email).trim())) {
      return res.status(400).json({ success: false, error: 'Please enter a valid email address.' });
    }

    // Webinar date must be one of the offered upcoming sessions — blocks
    // arbitrary or expired values from flowing into the CRM and Postgres.
    if (!isValidWebinarDate(webinarDate)) {
      return res.status(400).json({ success: false, error: 'Please select a valid webinar date.' });
    }

    // Duplicate-registration guard: if this email is already booked for this
    // session, treat it as an idempotent success instead of creating a dupe.
    if (await isDuplicateRegistration(email.trim(), webinarDate)) {
      console.log('Duplicate registration ignored (already booked for this session).');
      return res.status(200).json({ success: true, duplicate: true });
    }

    // Format fields
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';
    const registrationAgency = agency || 'Federal';
    
    // Format Notes_Questions from service/topic selection
    let notes = '';
    if (webinarDate) {
      const humanDate = humanForDate(webinarDate) || webinarDate;
      notes += `Selected Webinar: ${humanDate}\n`;
    }
    if (yearsService && serviceMap[yearsService]) {
      if (registrationAgency === 'USPS') {
        notes += `Years with USPS: ${serviceMap[yearsService]}\n`;
      } else {
        notes += `Years of Federal Service: ${serviceMap[yearsService]}\n`;
      }
    }
    if (topic && topicMap[topic]) {
      notes += `Most Interested Topic: ${topicMap[topic]}\n`;
    }
    notes += `Registration Origin: ${registrationAgency === 'USPS' ? 'USPS Landing Page' : 'General Federal Home Page'}\n`;
    notes += `Marketing/SMS Consent: ${marketingConsent ? 'Yes' : 'No'}\n`;

    const leadPayload = {
      Name: fullName,
      Client_First_Name: firstName.trim(),
      Email: email.trim(),
      Mobile_Phone: cleanPhone,
      Leads_Agent: 'FB Website',
      Stage: 'Webinar',
      Webinar_Date: webinarDate,
      Webinar_Appointment: webinarDate,
      Notes_Questions: notes.trim()
    };

    // Do not log the payload — it contains PII (name, email, phone).
    console.log('Submitting lead to Zoho CRM...');

    let crmResponse;
    try {
      crmResponse = await submitLeadToCRM(leadPayload);
    } catch (refreshErr) {
      console.error('Failed to refresh access token:', refreshErr.message);
      return res.status(401).json({ success: false, error: 'Authentication failed with Zoho CRM.' });
    }

    // Handle Zoho API errors
    if (crmResponse.data && crmResponse.data[0]) {
      const recordStatus = crmResponse.data[0];
      console.log(`CRM response: status=${recordStatus.status}, code=${recordStatus.code || 'n/a'}`);
      if (recordStatus.status === 'success') {
        // SUCCESS: Meta Conversions API (Fire and forget)
        const metaUserData = {
          email: email.trim(),
          phone: cleanPhone,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          clientUserAgent: req.body.clientUserAgent,
          eventSourceUrl: req.body.eventSourceUrl,
          eventId: req.body.eventId,
          fbp: req.body.fbp,
          fbc: req.body.fbc
        };
        sendMetaCapiEvent(req, metaUserData).catch(err => console.error('Meta Background Error:', err));

        // Backup to Postgres (must await — Vercel kills the function after response)
        const humanDate = humanForDate(webinarDate) || webinarDate;
        try {
          await backupToPostgres({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: cleanPhone,
            agency: registrationAgency,
            yearsService: yearsService || null,
            topic: topic || null,
            webinarDate: webinarDate,
            webinarDateHuman: humanDate,
            zohoRecordId: recordStatus.details.id,
            sourcePage: req.body.eventSourceUrl || null,
            marketingConsent: marketingConsent
          });
        } catch (pgErr) {
          console.error('Postgres backup error:', pgErr.message);
        }

        return res.status(200).json({ success: true, id: recordStatus.details.id });
      } else {
        // CRM failed — still try to backup to Postgres so we don't lose the lead
        const humanDate = humanForDate(webinarDate) || webinarDate;
        try {
          await backupToPostgres({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim(),
            phone: cleanPhone,
            agency: registrationAgency,
            yearsService: yearsService || null,
            topic: topic || null,
            webinarDate: webinarDate,
            webinarDateHuman: humanDate,
            zohoRecordId: null,
            sourcePage: req.body.eventSourceUrl || null,
            marketingConsent: marketingConsent
          });
        } catch (pgErr) {
          console.error('Postgres backup error:', pgErr.message);
        }

        return res.status(400).json({ success: false, error: recordStatus.message, details: recordStatus.details });
      }
    }

    return res.status(500).json({ success: false, error: 'Unexpected response from Zoho CRM.', details: crmResponse });
  } catch (err) {
    console.error('Error registering lead:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
