const {
  AppError,
  ValidationError,
  NotFoundError,
  VerificationFailedError,
} = require('../../application/errors/AppError');

/**
 * PowerAuthCloudClient — low-level HTTP client for PowerAuth Cloud's private
 * REST API (Passkeys / FIDO2 endpoints). This is the only file that knows
 * about HTTP transport details (base URL, auth headers, error-code mapping)
 * for talking to PowerAuth Cloud; PowerAuthCloudFido2Service builds on top
 * of it and speaks the domain's language.
 *
 * Uses the global `fetch` (Node 18+) so no extra HTTP dependency is needed.
 */
class PowerAuthCloudClient {
  /**
   * @param {object} params
   * @param {string} params.baseUrl - e.g. https://powerauth-cloud.example.com
   * @param {'basic'|'bearer'|'none'} params.authType
   * @param {string} [params.username]
   * @param {string} [params.password]
   * @param {string} [params.token]
   * @param {boolean} [params.debug] - log raw request/response bodies (see env.DEBUG_POWERAUTH)
   */
  constructor({ baseUrl, authType = 'basic', username, password, token, debug = false }) {
    if (!baseUrl) {
      throw new Error(
        'PowerAuthCloudClient: baseUrl is required (set POWERAUTH_CLOUD_BASE_URL)'
      );
    }
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.authType = authType;
    this.username = username;
    this.password = password;
    this.token = token;
    this.debug = debug;
  }

  _authHeader() {
    if (this.authType === 'basic') {
      const raw = `${this.username}:${this.password}`;
      return `Basic ${Buffer.from(raw).toString('base64')}`;
    }
    if (this.authType === 'bearer') {
      return `Bearer ${this.token}`;
    }
    return null;
  }

  /**
   * POST helper. Maps PowerAuth Cloud error codes onto our AppError hierarchy
   * so the rest of the codebase never needs to know this is an HTTP call.
   */
  async post(path, body) {
    const headers = { 'Content-Type': 'application/json' };
    const auth = this._authHeader();
    if (auth) headers.Authorization = auth;

    if (this.debug) {
      console.log(`\n[PowerAuthCloud] --> POST ${this.baseUrl}${path}`);
      console.log(JSON.stringify(body, null, 2));
    }

    let res;
    try {
      res = await fetch(`${this.baseUrl}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
    } catch (networkErr) {
      throw new AppError(`Could not reach PowerAuth Cloud: ${networkErr.message}`, 502);
    }

    let data = null;
    try {
      data = await res.json();
    } catch (_) {
      // No/invalid JSON body — fall through to status-based handling below.
    }

    if (this.debug) {
      console.log(`[PowerAuthCloud] <-- ${res.status} ${path}`);
      console.log(JSON.stringify(data, null, 2));
    }

    if (res.ok) return data;

    const errorCode = data?.error?.code || data?.code;
    const message = data?.error?.message || data?.message || `PowerAuth Cloud request failed (${res.status})`;

    switch (errorCode) {
      case 'ERROR_FIDO2':
        throw new VerificationFailedError(message);
      case 'ERROR_HTTP_REQUEST':
        throw new ValidationError(message);
      case 'ERROR_UNAUTHORIZED':
        throw new AppError(message, 401);
      case 'ERROR_NOT_FOUND':
        throw new NotFoundError(message);
      default:
        throw new AppError(message, res.status >= 400 && res.status < 600 ? res.status : 502);
    }
  }
}

module.exports = PowerAuthCloudClient;
