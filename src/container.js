const env = require('./infrastructure/config/env');

const InMemoryUserRepository = require('./infrastructure/persistence/InMemoryUserRepository');
const InMemoryCredentialRepository = require('./infrastructure/persistence/InMemoryCredentialRepository');
const SimpleWebAuthnService = require('./infrastructure/webauthn/SimpleWebAuthnService');
const PowerAuthCloudClient = require('./infrastructure/powerauth/PowerAuthCloudClient');
const PowerAuthCloudFido2Service = require('./infrastructure/webauthn/PowerAuthCloudFido2Service');

const StartRegistrationUseCase = require('./application/usecases/StartRegistrationUseCase');
const FinishRegistrationUseCase = require('./application/usecases/FinishRegistrationUseCase');
const StartAuthenticationUseCase = require('./application/usecases/StartAuthenticationUseCase');
const FinishAuthenticationUseCase = require('./application/usecases/FinishAuthenticationUseCase');

const WebAuthnController = require('./interfaces/http/controllers/WebAuthnController');

/**
 * Builds the "FIDO2 server adapter" — the one piece that actually changes
 * between "plain WebAuthn" and the Talisman/PowerAuth architecture. Picking
 * between the two is a one-line env var (WEBAUTHN_PROVIDER); every other
 * layer (domain, application, interfaces/http) is unaware this choice exists.
 */
function buildWebAuthnService() {
  if (env.WEBAUTHN_PROVIDER === 'powerauth-cloud') {
    const client = new PowerAuthCloudClient({
      baseUrl: env.POWERAUTH_CLOUD_BASE_URL,
      authType: env.POWERAUTH_CLOUD_AUTH_TYPE,
      username: env.POWERAUTH_CLOUD_USERNAME,
      password: env.POWERAUTH_CLOUD_PASSWORD,
      token: env.POWERAUTH_CLOUD_TOKEN,
      debug: env.DEBUG_POWERAUTH,
    });

    return new PowerAuthCloudFido2Service({
      client,
      appId: env.POWERAUTH_CLOUD_APP_ID,
      rpID: env.RP_ID,
      rpName: env.RP_NAME,
      origin: env.ORIGIN,
      loginTemplateName: env.POWERAUTH_CLOUD_LOGIN_TEMPLATE,
      debug: env.DEBUG_POWERAUTH,
    });
  }

  // Default: local verification via @simplewebauthn/server (dev/demo mode,
  // no external FIDO2 server / Talisman required).
  return new SimpleWebAuthnService({
    rpName: env.RP_NAME,
    rpID: env.RP_ID,
    origin: env.ORIGIN,
  });
}

/**
 * Composition root. This is the ONLY place that knows about every layer at
 * once — it wires infrastructure adapters into use cases, and use cases
 * into the HTTP controller. Swapping persistence (e.g. In-memory -> MySQL)
 * means changing only the two `new InMemory...Repository()` lines below.
 */
function buildContainer() {
  // --- Infrastructure (outermost layer) ---
  const userRepository = new InMemoryUserRepository();
  const credentialRepository = new InMemoryCredentialRepository();
  const webAuthnService = buildWebAuthnService();

  // --- Application (use cases) ---
  const startRegistrationUseCase = new StartRegistrationUseCase({
    userRepository,
    credentialRepository,
    webAuthnService,
  });
  const finishRegistrationUseCase = new FinishRegistrationUseCase({
    userRepository,
    credentialRepository,
    webAuthnService,
  });
  const startAuthenticationUseCase = new StartAuthenticationUseCase({
    userRepository,
    credentialRepository,
    webAuthnService,
  });
  const finishAuthenticationUseCase = new FinishAuthenticationUseCase({
    userRepository,
    credentialRepository,
    webAuthnService,
  });

  // --- Interfaces (HTTP controller) ---
  const webAuthnController = new WebAuthnController({
    startRegistrationUseCase,
    finishRegistrationUseCase,
    startAuthenticationUseCase,
    finishAuthenticationUseCase,
  });

  return {
    userRepository,
    credentialRepository,
    webAuthnService,
    webAuthnController,
  };
}

module.exports = buildContainer;
