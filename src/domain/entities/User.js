/**
 * User entity — plain domain object, no framework/library dependency.
 */
class User {
  /**
   * @param {object} params
   * @param {string} params.id - Internal unique user id (UUID)
   * @param {string} params.username - Login handle (e.g. email)
   * @param {string} [params.displayName] - Human friendly name
   */
  constructor({ id, username, displayName }) {
    this.id = id;
    this.username = username;
    this.displayName = displayName || username;
  }
}

module.exports = User;
