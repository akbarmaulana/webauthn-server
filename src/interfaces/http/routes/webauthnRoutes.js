const { Router } = require('express');
const requireAuth = require('../middlewares/requireAuth');

/**
 * @param {import('../controllers/WebAuthnController')} controller
 */
function webauthnRoutes(controller) {
  const router = Router();

  // Registration ceremony (sign-up / add a new passkey)
  router.post('/register/options', controller.registrationOptions);
  router.post('/register/verify', controller.verifyRegistration);

  // Authentication ceremony (login with an existing passkey)
  router.post('/login/options', controller.authenticationOptions);
  router.post('/login/verify', controller.verifyAuthentication);

  // Session helpers
  router.get('/me', controller.me);
  router.post('/logout', controller.logout);

  return router;
}

// Example of a protected route living alongside auth routes, for reference.
function protectedRoutes() {
  const router = Router();
  router.get('/protected/ping', requireAuth, (req, res) => {
    res.json({ ok: true, user: req.session.authenticatedUser });
  });
  return router;
}

module.exports = { webauthnRoutes, protectedRoutes };
