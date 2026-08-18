const env = require('./src/infrastructure/config/env');
const buildContainer = require('./src/container');
const createApp = require('./src/interfaces/http/app');

const { webAuthnController } = buildContainer();
const app = createApp(webAuthnController);

app.listen(env.PORT, () => {
  console.log(`WebAuthn server listening on http://localhost:${env.PORT}`);
  console.log(`RP_ID=${env.RP_ID}  ORIGIN=${env.ORIGIN}`);
});
