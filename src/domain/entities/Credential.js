/**
 * Credential entity — represents a registered WebAuthn authenticator
 * (a passkey) bound to a user.
 */
class Credential {
  /**
   * @param {object} params
   * @param {string} params.id - Base64URL credential ID (as returned by the authenticator)
   * @param {string} params.userId - Owning user's internal id
   * @param {Uint8Array} params.publicKey - COSE public key bytes
   * @param {number} params.counter - Signature counter, used to detect cloned authenticators
   * @param {string[]} [params.transports] - e.g. ['internal'], ['usb','nfc','ble']
   * @param {'singleDevice'|'multiDevice'} [params.deviceType]
   * @param {boolean} [params.backedUp] - Whether the credential is backed up (synced passkey)
   */
  constructor({ id, userId, publicKey, counter, transports = [], deviceType, backedUp = false }) {
    this.id = id;
    this.userId = userId;
    this.publicKey = publicKey;
    this.counter = counter;
    this.transports = transports;
    this.deviceType = deviceType;
    this.backedUp = backedUp;
  }
}

module.exports = Credential;
