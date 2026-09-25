const { encodeOpaqueChallenge, decodeOpaqueChallenge, isActivationCodeShaped, base64UrlToBase64 } = require('./base64url');

/**
 * PowerAuthCloudFido2Service -- infrastructure adapter implementing the SAME
 * shape as SimpleWebAuthnService (generateRegistrationOptions,
 * verifyRegistrationResponse, generateAuthenticationOptions,
 * verifyAuthenticationResponse), but backed by PowerAuth Cloud's Passkeys
 * REST API instead of doing cryptographic verification locally.
 *
 * This is the "WebAuthn Component" side of the Wultra/Talisman architecture:
 * it mediates between the browser and the FIDO2 server (PowerAuth Cloud),
 * but never verifies a signature itself -- PowerAuth Cloud is the source of
 * truth for that. See:
 * https://developers.wultra.com/products/talisman-hard-token-fido2/overview
 * https://developers.wultra.com/components/powerauth-cloud/2.1.x/documentation/API-Passkeys
 *
 * Field shapes here are cross-checked against the deployment's own live
 * Swagger UI (FIDO2 Registrations Controller), not just prose docs -- see
 * base64url.js for why `challenge` needs special handling.
 *
 * Because it implements the same interface as SimpleWebAuthnService, NOTHING
 * in domain/ or application/ needs to change to use this adapter instead --
 * only container.js picks which one to construct.
 */
class PowerAuthCloudFido2Service {
  /**
   * @param {object} params
   * @param {import('./PowerAuthCloudClient')} params.client
   * @param {string} params.appId - PowerAuth Cloud application identifier
   * @param {string} params.rpID - Relying party domain (must match PowerAuth app config)
   * @param {string} params.rpName - Human-friendly relying party name
   * @param {string} params.origin - Exact origin the frontend is served from
   * @param {string} [params.loginTemplateName] - Operation template used for plain logins
   * @param {boolean} [params.debug] - log raw PowerAuth Cloud payloads and final WebAuthn options
   */
  constructor({ client, appId, rpID, rpName, origin, loginTemplateName = 'login', debug = false }) {
    this.client = client;
    this.appId = appId;
    this.rpID = rpID;
    this.rpName = rpName;
    this.origin = origin.replace(/\/+$/, '');
    this.loginTemplateName = loginTemplateName;
    this.debug = debug;
  }

  /**
   * Registration step 1: ask PowerAuth Cloud for a registration challenge,
   * then assemble it into a standard PublicKeyCredentialCreationOptionsJSON
   * for navigator.credentials.create(). PowerAuth Cloud itself decides
   * excludeCredentials (devices already enrolled for this user), so the
   * `excludeCredentials` argument coming from the use case is not needed
   * here -- it exists only so this method has the same signature as
   * SimpleWebAuthnService's.
   *
   * @param {object} params
   * @param {import('../../domain/entities/User')} params.user
   */
  async generateRegistrationOptions({ user }) {
    const data = await this.client.post('/v2/fido2/registrations/challenge', {
      userId: user.id,
      appId: this.appId,
    });

    if (this.debug && !isActivationCodeShaped(data.challenge)) {
      console.log(
        '[PowerAuthCloudFido2Service] NOTE: challenge does not look like a PowerAuth ' +
          'activation code -- the opaque-string encoding in base64url.js may not apply ' +
          'to your deployment. Re-check the raw value logged below.'
      );
    }

    const options = {
      rp: { id: this.rpID, name: this.rpName },
      user: {
        // WebAuthn's user.id is an opaque byte handle, JSON-serialized as
        // Base64URL -- not the raw human-readable id string.
        id: Buffer.from(user.id).toString('base64url'),
        name: user.username,
        displayName: user.displayName,
      },
      // PowerAuth Cloud's `challenge` is an opaque activation-code-style
      // string, not WebAuthn-native Base64URL data -- wrap its UTF-8 bytes.
      challenge: encodeOpaqueChallenge(data.challenge),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      timeout: 60000,
      attestation: 'none',
      // credentialId values PowerAuth Cloud stores/returns are themselves
      // WebAuthn-native Base64URL (produced by an authenticator originally)
      // -- passed through verbatim, no conversion.
      excludeCredentials: (data.excludeCredentials || []).map((c) => ({
        id: c.credentialId,
        type: c.type || 'public-key',
        transports: c.transports,
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'cross-platform', // Talisman is a roaming/cross-platform authenticator
      },
    };

    if (this.debug) {
      console.log('\n[PowerAuthCloudFido2Service] Raw challenge response from PowerAuth Cloud:');
      console.log(JSON.stringify(data, null, 2));
      console.log('[PowerAuthCloudFido2Service] Final PublicKeyCredentialCreationOptionsJSON sent to browser:');
      console.log(JSON.stringify(options, null, 2));
    }

    return options;
  }

  /**
   * Registration step 2: forward the browser's attestation response to
   * PowerAuth Cloud, which performs the actual cryptographic verification
   * and stores the credential server-side.
   *
   * @param {object} params
   * @param {object} params.response - RegistrationResponseJSON from the browser
   * @param {string} params.expectedChallenge
   * @param {import('../../domain/entities/User')} [params.user]
   */
  async verifyRegistrationResponse({ response, expectedChallenge, user }) {
    const payload = {
      appId: this.appId,
      registrationName: `${user?.username || 'device'}-${Date.now()}`,
      // Recover PowerAuth Cloud's original literal challenge string (see
      // base64url.js) -- it expects this back exactly as it issued it, not
      // the Base64URL form we handed the browser.
      expectedChallenge: decodeOpaqueChallenge(expectedChallenge),
      authenticatorParameters: {
        // response.id datang sebagai Base64URL dari browser -- PowerAuth Cloud
        // butuh Base64 standar (dikonfirmasi tim Wultra), jadi dikonversi di sini.
        credentialId: base64UrlToBase64(response.id),
        type: response.type || 'public-key',
        authenticatorAttachment: response.authenticatorAttachment || 'cross-platform',
        // clientDataJSON/attestationObject juga Base64URL dari browser --
        // PowerAuth Cloud butuh Base64 standar untuk keduanya.
        response: {
          clientDataJSON: base64UrlToBase64(response.response.clientDataJSON),
          attestationObject: base64UrlToBase64(response.response.attestationObject),
          transports: response.response.transports || [],
        },
        relyingPartyId: this.rpID,
        allowedOrigins: [this.origin],
        allowedTopOrigins: [this.origin],
        requiresUserVerification: true,
      },
    };

    if (this.debug) {
      console.log('\n[PowerAuthCloudFido2Service] POST /v2/fido2/registrations payload:');
      console.log(JSON.stringify(payload, null, 2));
    }

    const data = await this.client.post('/v2/fido2/registrations', payload);

    // registrationStatus is e.g. CREATED/ACTIVE depending on PowerAuth Cloud's
    // configured activation flow; presence of a credentialId means the
    // authenticator was accepted and verified.
    const verified = Boolean(data.credentialId);

    return {
      verified,
      registrationInfo: verified
        ? {
            credential: {
              id: data.credentialId,
              publicKey: data.publicKeyBytes || '',
              counter: 0, // PowerAuth Cloud tracks the real counter server-side
              transports: [],
            },
            credentialDeviceType: 'multiDevice',
            credentialBackedUp: false,
            registrationId: data.registrationId,
            registrationStatus: data.registrationStatus,
          }
        : undefined,
    };
  }

  /**
   * Authentication/operation-approval step 1: ask PowerAuth Cloud for an
   * assertion challenge. Pass `templateName`/`parameters` for a payment or
   * generic operation (e.g. IBAN + amount, shown on the Talisman screen);
   * omit them for a plain login.
   *
   * @param {object} params
   * @param {import('../../domain/entities/User')} params.user
   * @param {string} [params.templateName]
   * @param {Record<string,string>} [params.parameters]
   */
  async generateAuthenticationOptions({ user, templateName, parameters }) {
    // Confirmed against live Swagger: this endpoint takes { externalId,
    // templateName, parameters } — no userId, no operationId field.
    const data = await this.client.post('/v2/fido2/assertions/challenge', {
      externalId: user.id,
      templateName: templateName || this.loginTemplateName,
      parameters,
    });

    const options = {
      challenge: encodeOpaqueChallenge(data.challenge),
      rpId: this.rpID,
      timeout: 60000,
      userVerification: 'preferred',
      allowCredentials: (data.allowCredentials || []).map((c) => ({
        id: c.credentialId,
        type: c.type || 'public-key',
        transports: c.transports,
      })),
    };

    if (this.debug) {
      console.log('\n[PowerAuthCloudFido2Service] Raw assertion challenge response from PowerAuth Cloud:');
      console.log(JSON.stringify(data, null, 2));
      console.log('[PowerAuthCloudFido2Service] Final PublicKeyCredentialRequestOptionsJSON sent to browser:');
      console.log(JSON.stringify(options, null, 2));
    }

    return options;
  }

  /**
   * Authentication/operation-approval step 2: forward the browser's
   * assertion response to PowerAuth Cloud for verification.
   *
   * @param {object} params
   * @param {object} params.response - AuthenticationResponseJSON from the browser
   * @param {string} params.expectedChallenge
   * @param {import('../../domain/entities/Credential')} [params.credential] - local mirror, used only to compute a bookkeeping counter
   */
  async verifyAuthenticationResponse({ response, expectedChallenge, credential }) {
    const payload = {
      credentialId: base64UrlToBase64(response.id),
      type: response.type || 'public-key',
      authenticatorAttachment: response.authenticatorAttachment || 'cross-platform',
      response: {
        clientDataJSON: base64UrlToBase64(response.response.clientDataJSON),
        authenticatorData: base64UrlToBase64(response.response.authenticatorData),
        signature: base64UrlToBase64(response.response.signature),
        // userHandle cuma ada untuk resident-key/discoverable credential
        userHandle: response.response.userHandle ? base64UrlToBase64(response.response.userHandle) : undefined,
      },
      applicationId: this.appId,
      relyingPartyId: this.rpID,
      allowedOrigins: [this.origin],
      allowedTopOrigins: [this.origin],
      requiresUserVerification: true,
      expectedChallenge: decodeOpaqueChallenge(expectedChallenge),
    };

    if (this.debug) {
      console.log('\n[PowerAuthCloudFido2Service] POST /v2/fido2/assertions payload:');
      console.log(JSON.stringify(payload, null, 2));
    }

    const data = await this.client.post('/v2/fido2/assertions', payload);

    return {
      verified: Boolean(data.assertionValid),
      authenticationInfo: {
        credentialID: response.id,
        // PowerAuth Cloud owns replay protection internally; we still bump our
        // local mirror so FinishAuthenticationUseCase's bookkeeping call succeeds.
        newCounter: (credential?.counter || 0) + 1,
        registrationId: data.registrationId,
        remainingAttempts: data.remainingAttempts,
      },
    };
  }
}

module.exports = PowerAuthCloudFido2Service;
