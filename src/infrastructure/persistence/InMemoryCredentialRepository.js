const ICredentialRepository = require('../../domain/repositories/ICredentialRepository');

/**
 * InMemoryCredentialRepository — demo/dev adapter implementing ICredentialRepository.
 * Swap this out for a real database adapter in production.
 */
class InMemoryCredentialRepository extends ICredentialRepository {
  constructor() {
    super();
    /** @type {Map<string, import('../../domain/entities/Credential')>} */
    this.credentialsById = new Map();
  }

  async findById(credentialId) {
    return this.credentialsById.get(credentialId) || null;
  }

  async findByUserId(userId) {
    return [...this.credentialsById.values()].filter((c) => c.userId === userId);
  }

  async save(credential) {
    this.credentialsById.set(credential.id, credential);
    return credential;
  }

  async updateCounter(credentialId, newCounter) {
    const credential = this.credentialsById.get(credentialId);
    if (credential) {
      credential.counter = newCounter;
      this.credentialsById.set(credentialId, credential);
    }
  }
}

module.exports = InMemoryCredentialRepository;
