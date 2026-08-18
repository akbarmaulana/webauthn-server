const Credential = require('../../domain/entities/Credential');
const { ValidationError, NotFoundError, VerificationFailedError } = require('../errors/AppError');
const StartRegistrationUseCase = require('./StartRegistrationUseCase');

const REGISTRATION_CHALLENGE_KEY = StartRegistrationUseCase.CHALLENGE_KEY;

/**
 * FinishRegistrationUseCase
 * Verifies the attestation response from navigator.credentials.create()
 * and, if valid, persists the new credential (passkey) for the user.
 */
class FinishRegistrationUseCase {
  constructor({ userRepository, credentialRepository, webAuthnService }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.webAuthnService = webAuthnService;
  }

  /**
   * @param {object} params
   * @param {string} params.username
   * @param {object} params.response - RegistrationResponseJSON from the browser
   * @param {import('../../domain/repositories/IChallengeStore')} params.challengeStore
   */
  async execute({ username, response, challengeStore }) {
    if (!username) throw new ValidationError('username is required');
    if (!response) throw new ValidationError('response is required');

    const user = await this.userRepository.findByUsername(username);
    if (!user) throw new NotFoundError('User not found');

    const key = REGISTRATION_CHALLENGE_KEY(username);
    const expectedChallenge = await challengeStore.getChallenge(key);
    if (!expectedChallenge) {
      throw new ValidationError('No registration challenge in progress for this user');
    }

    const verification = await this.webAuthnService.verifyRegistrationResponse({
      response,
      expectedChallenge,
      user,
    });

    await challengeStore.clearChallenge(key);

    if (!verification.verified || !verification.registrationInfo) {
      throw new VerificationFailedError('Could not verify registration response');
    }

    const { credential } = verification.registrationInfo;

    const savedCredential = await this.credentialRepository.save(
      new Credential({
        id: credential.id,
        userId: user.id,
        publicKey: credential.publicKey,
        counter: credential.counter,
        transports: credential.transports || [],
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
      })
    );

    return { verified: true, credentialId: savedCredential.id, user };
  }
}

module.exports = FinishRegistrationUseCase;
