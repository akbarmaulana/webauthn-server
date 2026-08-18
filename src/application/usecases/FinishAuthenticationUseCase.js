const { ValidationError, NotFoundError, VerificationFailedError } = require('../errors/AppError');
const StartAuthenticationUseCase = require('./StartAuthenticationUseCase');

const AUTH_CHALLENGE_KEY = StartAuthenticationUseCase.CHALLENGE_KEY;

/**
 * FinishAuthenticationUseCase
 * Verifies the assertion response from navigator.credentials.get() against
 * the stored credential's public key and signature counter.
 */
class FinishAuthenticationUseCase {
  constructor({ userRepository, credentialRepository, webAuthnService }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.webAuthnService = webAuthnService;
  }

  /**
   * @param {object} params
   * @param {string} params.username
   * @param {object} params.response - AuthenticationResponseJSON from the browser
   * @param {import('../../domain/repositories/IChallengeStore')} params.challengeStore
   */
  async execute({ username, response, challengeStore }) {
    if (!username) throw new ValidationError('username is required');
    if (!response) throw new ValidationError('response is required');

    const user = await this.userRepository.findByUsername(username);
    if (!user) throw new NotFoundError('User not found');

    const key = AUTH_CHALLENGE_KEY(username);
    const expectedChallenge = await challengeStore.getChallenge(key);
    if (!expectedChallenge) {
      throw new ValidationError('No authentication challenge in progress for this user');
    }

    const credential = await this.credentialRepository.findById(response.id);
    if (!credential || credential.userId !== user.id) {
      throw new NotFoundError('Passkey not recognized for this user');
    }

    const verification = await this.webAuthnService.verifyAuthenticationResponse({
      response,
      expectedChallenge,
      credential,
    });

    await challengeStore.clearChallenge(key);

    if (!verification.verified) {
      throw new VerificationFailedError('Could not verify authentication response');
    }

    await this.credentialRepository.updateCounter(
      credential.id,
      verification.authenticationInfo.newCounter
    );

    return { verified: true, user };
  }
}

module.exports = FinishAuthenticationUseCase;
