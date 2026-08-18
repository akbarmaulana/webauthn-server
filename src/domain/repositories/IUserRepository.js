/**
 * IUserRepository — port defining how the application layer talks to
 * user storage, without knowing the concrete persistence technology.
 * Any adapter (in-memory, MySQL, Mongo, ...) must implement this contract.
 */
class IUserRepository {
  /** @returns {Promise<import('../entities/User')|null>} */
  async findById(_id) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('../entities/User')|null>} */
  async findByUsername(_username) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('../entities/User')>} */
  async create(_user) {
    throw new Error('Not implemented');
  }
}

module.exports = IUserRepository;
