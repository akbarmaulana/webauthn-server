/**
 * ICredentialRepository — port defining how the application layer talks to
 * credential (passkey) storage.
 */
class ICredentialRepository {
  /** @returns {Promise<import('../entities/Credential')|null>} */
  async findById(_credentialId) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('../entities/Credential')[]>} */
  async findByUserId(_userId) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<import('../entities/Credential')>} */
  async save(_credential) {
    throw new Error('Not implemented');
  }

  /** @returns {Promise<void>} */
  async updateCounter(_credentialId, _newCounter) {
    throw new Error('Not implemented');
  }
}

module.exports = ICredentialRepository;
