const { ValidationError, NotFoundError } = require('../errors/AppError');

const AUTH_CHALLENGE_KEY = (username) => `auth:${username}`;

/**
 * StartAuthenticationUseCase
 * Generates PublicKeyCredentialRequestOptions for navigator.credentials.get().
 */
class StartAuthenticationUseCase {
  constructor({ userRepository, credentialRepository, webAuthnService }) {
    this.userRepository = userRepository;
    this.credentialRepository = credentialRepository;
    this.webAuthnService = webAuthnService;
  }

  /**
   * @param {object} params
   * @param {string} params.username
   * @param {import('../../domain/repositories/IChallengeStore')} params.challengeStore
   * @param {string} [params.templateName] - Operation template (e.g. 'payment'); omit for plain login
   * @param {Record<string,string>} [params.parameters] - Template parameters (e.g. IBAN, amount)
   *   shown to the user on the authenticator during operation approval. Ignored by adapters
   *   that don't support rich operations (e.g. the local/demo SimpleWebAuthnService).
   */
  async execute({ username, challengeStore, templateName, parameters }) {
    if (!username) throw new ValidationError('username is required');

    const user = await this.userRepository.findByUsername(username);
    if (!user) throw new NotFoundError('User not found');

    const credentials = await this.credentialRepository.findByUserId(user.id);
    if (credentials.length === 0) {
      throw new NotFoundError('No registered passkeys for this user');
    }

    const options = await this.webAuthnService.generateAuthenticationOptions({
      user,
      allowCredentials: credentials,
      templateName,
      parameters,
    });

    await challengeStore.setChallenge(AUTH_CHALLENGE_KEY(username), options.challenge);

    return options;
  }
}

StartAuthenticationUseCase.CHALLENGE_KEY = AUTH_CHALLENGE_KEY;

module.exports = StartAuthenticationUseCase;
