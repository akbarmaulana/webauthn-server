const SessionChallengeStore = require('../../../infrastructure/persistence/SessionChallengeStore');

/**
 * WebAuthnController — HTTP interface adapter. Its only jobs are:
 *  1. Pull data out of the HTTP request
 *  2. Call the relevant use case
 *  3. Translate the use case's result into an HTTP response
 * It contains no business logic of its own.
 */
class WebAuthnController {
  constructor({
    startRegistrationUseCase,
    finishRegistrationUseCase,
    startAuthenticationUseCase,
    finishAuthenticationUseCase,
  }) {
    this.startRegistrationUseCase = startRegistrationUseCase;
    this.finishRegistrationUseCase = finishRegistrationUseCase;
    this.startAuthenticationUseCase = startAuthenticationUseCase;
    this.finishAuthenticationUseCase = finishAuthenticationUseCase;

    // Bind so these can be passed directly as Express route handlers.
    this.registrationOptions = this.registrationOptions.bind(this);
    this.verifyRegistration = this.verifyRegistration.bind(this);
    this.authenticationOptions = this.authenticationOptions.bind(this);
    this.verifyAuthentication = this.verifyAuthentication.bind(this);
    this.me = this.me.bind(this);
    this.logout = this.logout.bind(this);
  }

  async registrationOptions(req, res, next) {
    try {
      const { username, displayName } = req.body;
      const challengeStore = new SessionChallengeStore(req.session);

      const options = await this.startRegistrationUseCase.execute({
        username,
        displayName,
        challengeStore,
      });

      res.json(options);
    } catch (err) {
      next(err);
    }
  }

  async verifyRegistration(req, res, next) {
    try {
      const { username, response } = req.body;
      const challengeStore = new SessionChallengeStore(req.session);

      const result = await this.finishRegistrationUseCase.execute({
        username,
        response,
        challengeStore,
      });

      res.json({ verified: result.verified, credentialId: result.credentialId });
    } catch (err) {
      next(err);
    }
  }

  async authenticationOptions(req, res, next) {
    try {
      // templateName/parameters are only meaningful when the WebAuthn
      // provider is PowerAuth Cloud — e.g. templateName: 'payment',
      // parameters: { iban: '...', amount: '...' } for operation approval.
      // Plain login just omits them.
      const { username, templateName, parameters } = req.body;
      const challengeStore = new SessionChallengeStore(req.session);

      const options = await this.startAuthenticationUseCase.execute({
        username,
        challengeStore,
        templateName,
        parameters,
      });

      res.json(options);
    } catch (err) {
      next(err);
    }
  }

  async verifyAuthentication(req, res, next) {
    try {
      const { username, response } = req.body;
      const challengeStore = new SessionChallengeStore(req.session);

      const result = await this.finishAuthenticationUseCase.execute({
        username,
        response,
        challengeStore,
      });

      // Mark the HTTP session as authenticated for this user.
      req.session.authenticatedUser = { id: result.user.id, username: result.user.username };

      res.json({ verified: result.verified, username: result.user.username });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res) {
    res.json({ user: req.session.authenticatedUser || null });
  }

  async logout(req, res, next) {
    req.session.destroy((err) => {
      if (err) return next(err);
      res.clearCookie('connect.sid');
      res.json({ ok: true });
    });
  }
}

module.exports = WebAuthnController;
