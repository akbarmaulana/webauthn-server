/**
 * base64url.js — Base64URL helpers for the PowerAuth Cloud adapter.
 *
 * Two genuinely different things live behind "encoding" here, discovered by
 * inspecting PowerAuth Cloud's actual live Swagger schema (not just its
 * prose docs) plus Wultra's own Activation-Code spec:
 *
 * 1. WEBAUTHN-NATIVE VALUES (credentialId, clientDataJSON, attestationObject)
 *    are produced by the authenticator/browser itself, already Base64URL
 *    per the WebAuthn spec. PowerAuth Cloud's FIDO2 endpoints accept these
 *    verbatim in that same form -- no conversion needed at all. (An earlier
 *    version of this adapter incorrectly assumed these were standard Base64
 *    on PowerAuth Cloud's side and converted them; that was wrong.)
 *
 * 2. The `challenge` field PowerAuth Cloud issues is NOT WebAuthn-native at
 *    all -- it's PowerAuth's classic Activation Code: four dash-separated
 *    Base32 groups (e.g. "LBDQ5-PEXYR-5OS26-XVMRQ"). Per Wultra's own spec
 *    (powerauth-crypto/docs/Activation-Code.md), in protocol V3 this code
 *    "is no longer used in the cryptographic calculations" -- it's just an
 *    opaque reference string with a CRC-16 typo-check, not raw entropy to
 *    decode. WebAuthn's `challenge` field must still be Base64URL, so we
 *    treat the activation-code string as opaque TEXT and Base64URL-encode
 *    its UTF-8 bytes -- then reverse that exact transform when sending
 *    `expectedChallenge` back to PowerAuth Cloud, so it gets back the
 *    identical literal string it originally issued.
 */

/** Wrap an opaque string (e.g. PowerAuth's activation-code challenge) as a WebAuthn-safe Base64URL string. */
function encodeOpaqueChallenge(str) {
  if (!str) return str;
  return Buffer.from(str, 'utf8').toString('base64url');
}

/** Reverse of encodeOpaqueChallenge -- recovers PowerAuth Cloud's original literal challenge string. */
function decodeOpaqueChallenge(base64url) {
  if (!base64url) return base64url;
  return Buffer.from(base64url, 'base64url').toString('utf8');
}

// PowerAuth's classic activation code format: four 5-character groups
// (restricted Base32 alphabet, no ambiguous chars) separated by dashes,
// e.g. "LBDQ5-PEXYR-5OS26-XVMRQ". Used here only to sanity-check that a
// PowerAuth Cloud deployment is really issuing this format, so problems
// show up as a clear error instead of silent corruption.
const ACTIVATION_CODE_PATTERN = /^[A-Z2-7]{5}(-[A-Z2-7]{5}){3}$/;

function isActivationCodeShaped(challenge) {
  return ACTIVATION_CODE_PATTERN.test(challenge);
}

function base64UrlToBase64(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return base64;
}

/**
 * Convert a fixed list of fields on an object from Base64URL to standard Base64.
 * Skips fields that are missing/null (e.g. userHandle on non-resident-key assertions).
 */
function convertFieldsToBase64(obj, fields) {
  const converted = { ...obj };
  for (const field of fields) {
    if (converted[field]) {
      converted[field] = base64UrlToBase64(converted[field]);
    }
  }
  return converted;
}

module.exports = { encodeOpaqueChallenge, decodeOpaqueChallenge, isActivationCodeShaped, base64UrlToBase64, convertFieldsToBase64 };
