require('dotenv').config();

const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),
  RP_NAME: process.env.RP_NAME || 'My WebAuthn App',
  RP_ID: process.env.RP_ID || 'localhost',
  ORIGIN: process.env.ORIGIN || 'http://localhost:3000',
  SESSION_SECRET: process.env.SESSION_SECRET || 'dev-secret-change-me',

  // Which FIDO2 server / WebAuthn library adapter to wire up in the container.
  // 'simple'          -> @simplewebauthn/server does verification locally (dev/demo mode)
  // 'powerauth-cloud'  -> delegates verification to PowerAuth Cloud (Talisman / PowerAuth architecture)
  WEBAUTHN_PROVIDER: process.env.WEBAUTHN_PROVIDER || 'simple',

  // --- PowerAuth Cloud (FIDO2 server) config — only used when WEBAUTHN_PROVIDER=powerauth-cloud ---
  POWERAUTH_CLOUD_BASE_URL: process.env.POWERAUTH_CLOUD_BASE_URL || '',
  POWERAUTH_CLOUD_APP_ID: process.env.POWERAUTH_CLOUD_APP_ID || '',
  // Auth to PowerAuth Cloud's private REST API. 'basic' is the common case for a trusted
  // backend-to-backend call; switch to 'bearer' if your deployment issues an OAuth/API token.
  POWERAUTH_CLOUD_AUTH_TYPE: process.env.POWERAUTH_CLOUD_AUTH_TYPE || 'basic',
  POWERAUTH_CLOUD_USERNAME: process.env.POWERAUTH_CLOUD_USERNAME || '',
  POWERAUTH_CLOUD_PASSWORD: process.env.POWERAUTH_CLOUD_PASSWORD || '',
  POWERAUTH_CLOUD_TOKEN: process.env.POWERAUTH_CLOUD_TOKEN || '',
  // Default operation template used for a plain login assertion (no payment/generic payload).
  POWERAUTH_CLOUD_LOGIN_TEMPLATE: process.env.POWERAUTH_CLOUD_LOGIN_TEMPLATE || 'login',

  // When 'true', logs the raw request/response payloads exchanged with
  // PowerAuth Cloud and the exact WebAuthn options handed to the browser —
  // invaluable for diagnosing encoding/format mismatches against a real
  // PowerAuth Cloud deployment. Never enable in production (logs challenges).
  DEBUG_POWERAUTH: process.env.DEBUG_POWERAUTH === 'true',
};

module.exports = env;
