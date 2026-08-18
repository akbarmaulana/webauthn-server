const path = require('path');
const express = require('express');
const cors = require('cors');
const session = require('express-session');

const env = require('../../infrastructure/config/env');
const errorHandler = require('./middlewares/errorHandler');
const { webauthnRoutes, protectedRoutes } = require('./routes/webauthnRoutes');

/**
 * Builds and returns the Express app, wired with the given controller.
 * Keeping this as a factory (rather than a module-level singleton) makes
 * the app easy to spin up in tests with different dependencies.
 *
 * @param {import('./controllers/WebAuthnController')} webAuthnController
 */
function createApp(webAuthnController) {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: env.ORIGIN,
      credentials: true,
    })
  );
  app.use(
    session({
      name: 'connect.sid',
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        // secure: true, // enable once served over HTTPS
        maxAge: 1000 * 60 * 10, // 10 minutes is plenty for a WebAuthn ceremony + session
      },
    })
  );

  app.use(express.static(path.join(__dirname, '../../../public')));

  app.use('/api/webauthn', webauthnRoutes(webAuthnController));
  app.use('/api', protectedRoutes());

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.use(errorHandler);

  return app;
}

module.exports = createApp;
