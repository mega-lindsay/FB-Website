const fs = require('fs');
const https = require('https');

// Path to Zoho MCP OAuth config files (local dev fallback)
const tokensPath = '/Users/Work/.mcp-auth/mcp-remote-0.1.37/ffbea0455b66e4e46198c79cef6a5283_tokens.json';
const clientInfoPath = '/Users/Work/.mcp-auth/mcp-remote-0.1.37/ffbea0455b66e4e46198c79cef6a5283_client_info.json';

// Global in-memory cache for token
let cachedAccessToken = null;

// Function to refresh the access token directly via HTTP POST
async function refreshAccessToken() {
  console.log('Refreshing Zoho CRM access token via HTTP POST...');

  let refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  let clientId = process.env.ZOHO_CLIENT_ID;
  let tokenEndpoint = process.env.ZOHO_TOKEN_ENDPOINT || 'https://mcp.zoho.com/baas/mcp/v1/oauth/6f2a4a91336a7705d9708e245487b1a0/41167000000013038/token';

  // Fallback to local files if environment variables are not set
  if (!refreshToken || !clientId) {
    console.log('Environment variables ZOHO_REFRESH_TOKEN or ZOHO_CLIENT_ID not found, falling back to local OAuth config files...');
    if (fs.existsSync(tokensPath) && fs.existsSync(clientInfoPath)) {
      try {
        const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
        const clientInfo = JSON.parse(fs.readFileSync(clientInfoPath, 'utf8'));
        refreshToken = tokens.refresh_token;
        clientId = clientInfo.client_id;
      } catch (err) {
        throw new Error('Failed to read local OAuth configuration files: ' + err.message);
      }
    } else {
      throw new Error('No Zoho OAuth credentials found (neither environment variables nor local files).');
    }
  }

  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId
  });

  const parsedUrl = new URL(tokenEndpoint);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.access_token) {
            cachedAccessToken = result.access_token;
            console.log('Access token refreshed and loaded successfully via HTTP request.');

            // Try saving to local file for local dev, but catch errors if file system is read-only
            if (fs.existsSync(tokensPath)) {
              try {
                const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
                tokens.access_token = result.access_token;
                fs.writeFileSync(tokensPath, JSON.stringify(tokens, null, 2), 'utf8');
                console.log('Updated local token store file.');
              } catch (writeErr) {
                console.warn('Could not write back to local tokens path (might be read-only filesystem):', writeErr.message);
              }
            }
            resolve(result.access_token);
          } else {
            reject(new Error('Token refresh response did not contain access_token: ' + data));
          }
        } catch (e) {
          reject(new Error('Failed to parse token refresh response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(params.toString());
    req.end();
  });
}

// Function to perform lead insertion in Zoho CRM module FB_Clients_Leads
function insertLeadIntoCRM(accessToken, leadData) {
  const payload = JSON.stringify({
    data: [leadData]
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'www.zohoapis.com',
      path: '/crm/v6/FB_Clients_Leads',
      method: 'POST',
      headers: {
        'Authorization': `Zoho-oauthtoken ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(new Error('Parse error in lead insertion response: ' + data));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// Insert a lead into FB_Clients_Leads, transparently refreshing the access
// token and retrying once if the cached/stored token has expired.
async function submitLeadToCRM(leadPayload) {
  let accessToken = cachedAccessToken;
  if (!accessToken && fs.existsSync(tokensPath)) {
    try {
      const tokens = JSON.parse(fs.readFileSync(tokensPath, 'utf8'));
      accessToken = tokens.access_token;
      cachedAccessToken = accessToken;
    } catch (err) {
      console.warn('Failed to read local tokens file:', err.message);
    }
  }

  let crmResponse;
  if (accessToken) {
    crmResponse = await insertLeadIntoCRM(accessToken, leadPayload);
  } else {
    crmResponse = { code: 'INVALID_TOKEN' };
  }

  const isTokenError = crmResponse.code === 'INVALID_TOKEN' ||
    (crmResponse.status === 'error' && (crmResponse.message || '').includes('token'));

  if (isTokenError) {
    console.log('Access token expired or invalid. Attempting refresh...');
    accessToken = await refreshAccessToken();
    console.log('Re-submitting lead with new token...');
    crmResponse = await insertLeadIntoCRM(accessToken, leadPayload);
  }

  return crmResponse;
}

module.exports = { submitLeadToCRM };
