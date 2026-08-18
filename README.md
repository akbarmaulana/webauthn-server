# WebAuthn Server (Node.js + Express, Clean Architecture)

A FIDO2/WebAuthn (passkey) authentication server, built with Express and
[`@simplewebauthn/server`](https://simplewebauthn.dev/), organized using
Clean Architecture so business rules stay independent of Express, the
WebAuthn library, and the storage technology.

## Architecture

```
src/
├── domain/              # Enterprise business rules — zero external deps
│   ├── entities/         User, Credential
│   └── repositories/     IUserRepository, ICredentialRepository, IChallengeStore (ports)
│
├── application/         # Application business rules (use cases)
│   ├── usecases/         StartRegistration, FinishRegistration,
│   │                     StartAuthentication, FinishAuthentication
│   └── errors/           AppError and subclasses
│
├── infrastructure/      # Adapters implementing the domain ports
│   ├── config/           env.js (reads .env)
│   ├── persistence/      InMemoryUserRepository, InMemoryCredentialRepository,
│   │                     SessionChallengeStore
│   ├── powerauth/        PowerAuthCloudClient (HTTP client for PowerAuth Cloud)
│   └── webauthn/         SimpleWebAuthnService (local verification via @simplewebauthn/server)
│                         PowerAuthCloudFido2Service (delegates verification to PowerAuth Cloud)
│
├── interfaces/http/     # Delivery mechanism — Express
│   ├── controllers/      WebAuthnController (HTTP <-> use cases)
│   ├── routes/            webauthnRoutes
│   ├── middlewares/       errorHandler, requireAuth
│   └── app.js             Express app factory
│
└── container.js         # Composition root — wires everything together

server.js                # Entry point
public/index.html        # Minimal demo frontend (@simplewebauthn/browser)
```

**Dependency rule:** arrows only point inward. `domain` knows nothing about
Express or SimpleWebAuthn. `application` depends only on `domain` (via the
repository/service interfaces it's handed). `infrastructure` implements
those interfaces. `interfaces/http` depends on `application`, never the
other way around. Everything is wired together once, in `container.js`.

To swap the in-memory storage for a real database, write a new class that
implements `IUserRepository` / `ICredentialRepository` and swap two lines in
`container.js` — nothing else changes.

## Setup

```bash
cp .env.example .env
npm install
npm start        # or: npm run dev (nodemon)
```

Open `http://localhost:3000` in a browser that supports WebAuthn (any
modern Chrome/Edge/Safari/Firefox), enter a username, and click
"Register passkey", then "Login with passkey".

### Environment variables (`.env`)

| Variable         | Description                                            |
|-------------------|--------------------------------------------------------|
| `PORT`            | HTTP port (default `3000`)                              |
| `RP_NAME`         | Human-friendly Relying Party name shown to the user      |
| `RP_ID`           | Relying Party domain, no scheme/port (e.g. `localhost`, `example.com`) |
| `ORIGIN`          | Exact origin your frontend is served from (must match browser origin) |
| `SESSION_SECRET`  | Secret used to sign the session cookie                   |
| `WEBAUTHN_PROVIDER` | `simple` (default, verifies locally) or `powerauth-cloud` (delegates to PowerAuth Cloud — see below) |
| `POWERAUTH_CLOUD_BASE_URL` | PowerAuth Cloud base URL — only used when `WEBAUTHN_PROVIDER=powerauth-cloud` |
| `POWERAUTH_CLOUD_APP_ID` | PowerAuth Cloud application id |
| `POWERAUTH_CLOUD_AUTH_TYPE` | `basic` (default) or `bearer` — how the backend authenticates to PowerAuth Cloud's private API |
| `POWERAUTH_CLOUD_USERNAME` / `POWERAUTH_CLOUD_PASSWORD` | Credentials for `basic` auth |
| `POWERAUTH_CLOUD_TOKEN` | Token for `bearer` auth |
| `POWERAUTH_CLOUD_LOGIN_TEMPLATE` | Operation template used for a plain login assertion (default `login`) |

> **Deploying to production:** `RP_ID` must be your real domain (e.g.
> `example.com`), `ORIGIN` must be the exact HTTPS origin
> (`https://example.com`), and the app must be served over HTTPS — WebAuthn
> requires a secure context (localhost is exempted for local dev). Also
> uncomment `cookie.secure: true` in `src/interfaces/http/app.js`.

## API

All endpoints are prefixed with `/api/webauthn` and expect/return JSON.
A session cookie (set automatically) ties the challenge issued in the
"options" step to the "verify" step, so calls must be made with
`credentials: 'include'` from the browser.

| Method | Path                | Body                          | Description                                   |
|--------|---------------------|--------------------------------|------------------------------------------------|
| POST   | `/register/options` | `{ username, displayName? }`   | Creates the user if new; returns creation options for `navigator.credentials.create()` |
| POST   | `/register/verify`  | `{ username, response }`       | Verifies the attestation and stores the new passkey |
| POST   | `/login/options`    | `{ username, templateName?, parameters? }` | Returns request options for `navigator.credentials.get()`. `templateName`/`parameters` are only meaningful with the `powerauth-cloud` provider (e.g. `templateName: "payment"`, `parameters: { iban, amount }` for operation approval) |
| POST   | `/login/verify`     | `{ username, response }`       | Verifies the assertion and starts a session |
| GET    | `/me`                | —                              | Returns the currently authenticated user, if any |
| POST   | `/logout`            | —                              | Destroys the session |

A `requireAuth` middleware and an example `GET /api/protected/ping` route
are included in `webauthnRoutes.js` to show how to gate routes behind an
established WebAuthn session.

## Talisman / PowerAuth Cloud architecture support

This project supports two interchangeable "FIDO2 server" adapters, selected
via `WEBAUTHN_PROVIDER` in `.env` — nothing in `domain/` or `application/`
changes between them, only which class `container.js` instantiates:

| | `WEBAUTHN_PROVIDER=simple` (default) | `WEBAUTHN_PROVIDER=powerauth-cloud` |
|---|---|---|
| Who verifies signatures | This Node process (`@simplewebauthn/server`) | PowerAuth Cloud, over its private REST API |
| Adapter file | `src/infrastructure/webauthn/SimpleWebAuthnService.js` | `src/infrastructure/webauthn/PowerAuthCloudFido2Service.js` |
| Typical authenticator | Any platform/roaming FIDO2 authenticator (Touch ID, YubiKey, ...) | Wultra Talisman hard token (or any FIDO2 authenticator PowerAuth Cloud is configured to accept) |
| Use case | Local dev/demo, no external dependency | Production banking-grade setup matching the [Talisman/PowerAuth architecture](https://developers.wultra.com/products/talisman-hard-token-fido2/overview) |

In that architecture this Node app plays the role of the **WebAuthn
Component** (a.k.a. PowerAuth Authorization Server in Wultra's docs): it
talks to the browser and mediates every registration/authentication
ceremony, but never verifies a signature itself — it forwards the browser's
response to PowerAuth Cloud (the **FIDO2 Server**) via
`PowerAuthCloudClient`, and PowerAuth Cloud is the one that ultimately
decides whether the assertion from the **Talisman authenticator** is valid.

```
Talisman (authenticator) ⇄ Browser (WebAuthn API) ⇄ this app (WebAuthn Component) ⇄ PowerAuth Cloud (FIDO2 Server)
```

**Registration** (`POST /register/options` → `POST /register/verify`) calls
PowerAuth Cloud's `/v2/fido2/registrations/challenge` then
`/v2/fido2/registrations`.

**Login / operation approval** (`POST /login/options` → `POST /login/verify`)
calls `/v2/fido2/assertions/challenge` then `/v2/fido2/assertions`. Pass
`templateName` + `parameters` in `/login/options` for a payment or generic
operation (so the amount/IBAN/etc. show up on the Talisman's screen for
WYSIWYS confirmation); omit them for a plain login, which falls back to
`POWERAUTH_CLOUD_LOGIN_TEMPLATE`.

**Trying it locally without a real PowerAuth Cloud instance:** point
`POWERAUTH_CLOUD_BASE_URL` at any HTTP server that implements the four
endpoints above per the [Passkeys API reference](https://developers.wultra.com/components/powerauth-cloud/2.1.x/documentation/API-Passkeys)
— this was how the adapter was verified during development (register →
verify → login → verify → session, plus a payment-template call), using a
~80-line mock server standing in for PowerAuth Cloud.

**Known assumption to double-check against Wultra's official client SDK:**
the `authenticatorParameters.response` / `response` field sent to PowerAuth
Cloud is built here as `Base64(JSON.stringify(browserResponse.response))`.
The API reference documents this field only as "authenticator response,
Base64-encoded" without specifying the exact serialization — if Wultra
publishes (or you have access to) an official browser-side helper library,
prefer whatever encoding it produces over this adapter's assumption.

**`challenge` is not Base64 at all — it's a PowerAuth Activation Code (found
via live Swagger against a real deployment):** the field PowerAuth Cloud
issues as `challenge` from `/v2/fido2/registrations/challenge` and
`/v2/fido2/assertions/challenge` looks like `"LBDQ5-PEXYR-5OS26-XVMRQ"` —
that's PowerAuth's classic Activation Code format (four dash-separated
Base32 groups with a CRC-16 typo-check), not raw Base64/Base64URL challenge
bytes. Per Wultra's own spec, as of protocol V3 this code
["is no longer used in the cryptographic calculations"](https://github.com/wultra/powerauth-crypto/blob/develop/docs/Activation-Code.md) —
it's just an opaque reference string. `PowerAuthCloudFido2Service` treats it
as opaque text (`src/infrastructure/webauthn/base64url.js`):
`encodeOpaqueChallenge()` Base64URL-wraps its UTF-8 bytes for the browser,
and `decodeOpaqueChallenge()` reverses that exact transform before sending
`expectedChallenge` back to PowerAuth Cloud, so it receives back the
identical literal string it issued. **Do not** apply a standard-Base64 ↔
Base64URL character-swap to this field — the dashes are literal formatting
in PowerAuth's string, not a Base64 `+` substitute, and swapping them
corrupts the round trip. Also cross-checked against the deployment's live
Swagger (both the registrations and assertions controllers):
`authenticatorParameters.response`/`response` in the verify calls is a
**structured object** — `{ clientDataJSON, attestationObject, transports }`
for registration, `{ clientDataJSON, authenticatorData, signature, userHandle }`
for assertions — not a single Base64-encoded blob, and
`credentialId`/`clientDataJSON`/`attestationObject`/`authenticatorData`/`signature`
are WebAuthn-native Base64URL values PowerAuth Cloud accepts verbatim, no
conversion needed. Two field-naming inconsistencies worth knowing about in
this deployment's API (confirmed via Swagger, not assumed): the
registration-verify endpoint uses `appId`, but the assertion-verify endpoint
uses `applicationId` for the same concept; and the assertion-challenge
endpoint identifies the user via `externalId`, not `userId` (unlike the
registration-challenge endpoint) and has no `operationId` field at all.

If a request still gets refused by the authenticator (e.g. Talisman's
"Unable to process operation", or Windows WebAuthN logging
`0x800704C7 — canceled by user` for what looks like a device-side failure,
not an actual user cancellation) after confirming the device itself is
provisioned, treat any encoding/field-name assumption in this adapter as
suspect until verified against your own deployment's live Swagger UI, not
just prose docs — field names and formats can differ by version/configuration.

### Troubleshooting an authenticator that refuses/rejects a request

If a request reaches the device (browser shows the OS security-key prompt)
but the authenticator itself refuses it — e.g. Talisman's "Unable to process
operation", or Chrome/Edge throwing `NotAllowedError` — work from real data
instead of guessing:

1. **Set `DEBUG_POWERAUTH=true`** in `.env` and restart. This logs, for every
   PowerAuth Cloud call: the raw request/response bodies
   (`PowerAuthCloudClient`) and the exact `PublicKeyCredentialCreationOptionsJSON`
   / `RequestOptionsJSON` handed to the browser (`PowerAuthCloudFido2Service`).
   Compare the raw `challenge`/`credentialId` PowerAuth Cloud actually
   returns against what gets sent to the browser — confirms the Base64 ↔
   Base64URL conversion is doing what you expect against your real deployment.
   **Turn this off again outside of local debugging** — it logs challenge
   values.
2. **Open `chrome://webauthn-internals/` (or `edge://webauthn-internals/`)**
   before triggering the ceremony. It records the actual CTAP2
   request/response exchanged with the authenticator — far more specific
   than the device's own display or the OS event log, and the most reliable
   way to see the *real* reason a request was rejected.
3. **Check the browser console (F12)** for the exact error `navigator.credentials.create()`/`.get()` rejected with — e.g. `NotAllowedError`,
   often with more detail than what reaches the OS-level log.
4. Confirm `RP_ID`/`ORIGIN` in `.env` exactly match what's configured for
   your application (`POWERAUTH_CLOUD_APP_ID`) on the PowerAuth Cloud side —
   a relying-party-id mismatch is rejected by the browser before the request
   even reaches the authenticator, but is still worth ruling out.
5. Confirm the Talisman device itself has completed its one-time PIN setup
   (see the [product overview](https://developers.wultra.com/products/talisman-hard-token-fido2/overview))
   — an unprovisioned device rejects any incoming request.



- Storage is in-memory (`Map`s) for easy local testing — data is lost on
  restart. Replace `InMemoryUserRepository` / `InMemoryCredentialRepository`
  with real DB-backed implementations of the same interfaces for production.
- The signature counter returned on each login (`newCounter`) is persisted
  and should always be checked against the stored value to help detect
  cloned authenticators — this is handled in `FinishAuthenticationUseCase`.
- Users can register more than one passkey (e.g. phone + security key);
  `excludeCredentials` is populated during registration so the browser
  won't offer to re-register a device that's already enrolled.
