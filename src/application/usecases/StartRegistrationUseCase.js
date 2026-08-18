const { v4: uuidv4 } = require('uuid');
const User = require('../../domain/entities/User');
const { ValidationError } = require('../errors/AppError');

const REGISTRATION_CHALLENGE_KEY = (username) => `reg:${username}`;

/**
 * StartRegistrationUseCase
 * Generates PublicKeyCredentialCreationOptions for navigator.credentials.create().
 * Creates the user record on first registration attempt if they don't exist yet.
 */
class StartRegistrationUseCase {
  constructor({ userRepository, credentialRepository, webAuthnService }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.webAuthnService = webAuthnService;
  }

  /**
   * @param {object} params
   * @param {string} params.username
   * @param {string} [params.displayName]
   * @param {import('../../domain/repositories/IChallengeStore')} params.challengeStore
   */
  async execute({ username, displayName, challengeStore }) {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new ValidationError('username is required');
    }

    let user = await this.userRepository.findByUsername(username);
    let existingCredentials = [];

    if (user) {
      existingCredentials = await this.credentialRepository.findByUserId(user.id);
      // Allow re-registering a *new* device for an existing user (multiple passkeys per user),
      // but refuse if this exact device already registered would be handled client-side via
      // excludeCredentials below, so we don't hard-block here.
    } else {
      user = await this.userRepository.create(
        new User({ id: uuidv4(), username, displayName })
      );
    }

    const options = await this.webAuthnService.generateRegistrationOptions({
      user,
      excludeCredentials: existingCredentials,
    });

    await challengeStore.setChallenge(REGISTRATION_CHALLENGE_KEY(username), options.challenge);

    return options;
  }
}

StartRegistrationUseCase.CHALLENGE_KEY = REGISTRATION_CHALLENGE_KEY;

module.exports = StartRegistrationUseCase;
