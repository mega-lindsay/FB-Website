const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || '0x4AAAAAADxY-NSPlrjPJ7EnuigMIX_owzM';

// Verifies a Cloudflare Turnstile token server-side. Returns true/false;
// throws only on network/parsing failure so callers can distinguish
// "verification failed" from "couldn't reach Cloudflare".
async function verifyTurnstile(req, token) {
  if (!token) return false;

  const params = new URLSearchParams();
  params.append('secret', TURNSTILE_SECRET_KEY);
  params.append('response', token);
  if (req.headers['x-forwarded-for']) {
    params.append('remoteip', req.headers['x-forwarded-for'].split(',')[0]);
  }

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: params
  });
  const result = await response.json();
  return !!result.success;
}

module.exports = { verifyTurnstile };
