const { submitLeadToCRM } = require('./_zoho');
const { verifyTurnstile } = require('./_turnstile');

// Serverless / Express request handler
module.exports = async function handler(req, res) {
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
    const { name, email, phone, message, turnstileToken } = req.body;

    // Cloudflare Turnstile CAPTCHA check
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

    if (!name || !email || !message) {
      return res.status(400).json({ success: false, error: 'Name, Email, and Message are required.' });
    }

    const fullName = name.trim();
    const firstName = fullName.split(/\s+/)[0];
    const cleanPhone = phone ? phone.replace(/\D/g, '') : '';

    const notes = `Message: ${message.trim()}\nRegistration Origin: Contact Form\n`;

    const leadPayload = {
      Name: fullName,
      Client_First_Name: firstName,
      Email: email.trim(),
      Mobile_Phone: cleanPhone,
      Leads_Agent: 'FB Website',
      Notes_Questions: notes
    };

    console.log('Sending contact lead payload to Zoho CRM:', JSON.stringify(leadPayload, null, 2));

    let crmResponse;
    try {
      crmResponse = await submitLeadToCRM(leadPayload);
    } catch (refreshErr) {
      console.error('Failed to refresh access token:', refreshErr.message);
      return res.status(401).json({ success: false, error: 'Authentication failed with Zoho CRM.' });
    }

    console.log('CRM API response:', JSON.stringify(crmResponse, null, 2));

    if (crmResponse.data && crmResponse.data[0]) {
      const recordStatus = crmResponse.data[0];
      if (recordStatus.status === 'success') {
        return res.status(200).json({ success: true, id: recordStatus.details.id });
      }
      return res.status(400).json({ success: false, error: recordStatus.message, details: recordStatus.details });
    }

    return res.status(500).json({ success: false, error: 'Unexpected response from Zoho CRM.', details: crmResponse });
  } catch (err) {
    console.error('Error submitting contact form:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};
