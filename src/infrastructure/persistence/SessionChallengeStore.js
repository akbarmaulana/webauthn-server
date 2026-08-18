const IChallengeStore = require('../../domain/repositories/IChallengeStore');

/**
 * SessionChallengeStore — adapter implementing IChallengeStore backed by the
 * HTTP session (express-session). One instance is created per request since
 * it wraps that request's `req.session`. This keeps the WebAuthn challenge
 * tied to the browser that started the ceremony (mitigates CSRF-style abuse)
 * without the use cases needing to know HTTP/session exists at all.
 */
class SessionChallengeStore extends IChallengeStore {
  constructor(session) {
    super();
    this.session = session;
    if (!this.session.challenges) {
      this.session.challenges = {};
    }
  }

  async setChallenge(key, challenge) {
    this.session.challenges[key] = challenge;
  }

  async getChallenge(key) {
    return this.session.challenges[key] || null;
  }

  async clearChallenge(key) {
    delete this.session.challenges[key];
  }
}

module.exports = SessionChallengeStore;
