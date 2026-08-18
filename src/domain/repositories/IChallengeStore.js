/**
 * IChallengeStore — port for temporarily persisting the random challenge
 * issued during a registration/authentication ceremony, so it can be
 * verified once the client responds. Typically backed by the HTTP session,
 * but could be Redis, etc.
 */
class IChallengeStore {
  /** @returns {Promise<void>} */
  async setChallenge(_key, _challenge) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<string|null>} */
  async getChallenge(_key) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<void>} */
  async clearChallenge(_key) {
    throw new Error('Not implemented');
  }
}

module.exports = IChallengeStore;
