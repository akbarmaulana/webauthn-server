const IUserRepository = require('../../domain/repositories/IUserRepository');

/**
 * InMemoryUserRepository — demo/dev adapter implementing IUserRepository.
 * Swap this out for a real database adapter (e.g. MySQL/Mongo) in production;
 * nothing outside this file needs to change since it honors the same port.
 */
class InMemoryUserRepository extends IUserRepository {
  constructor() {
    super();
    /** @type {Map<string, import('../../domain/entities/User')>} */
    this.usersById = new Map();
    /** @type {Map<string, string>} username -> id */
    this.usernameIndex = new Map();
  }

  async findById(id) {
    return this.usersById.get(id) || null;
  }

  async findByUsername(username) {
    const id = this.usernameIndex.get(username);
    if (!id) return null;
    return this.usersById.get(id) || null;
  }

  async create(user) {
    this.usersById.set(user.id, user);
    this.usernameIndex.set(user.username, user.id);
    return user;
  }
}

module.exports = InMemoryUserRepository;
