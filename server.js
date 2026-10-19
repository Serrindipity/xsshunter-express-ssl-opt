'use strict';

const get_app_server = require('./app.js');
const database = require('./database.js');
const database_init = database.database_init;

// BEHIND_PROXY=true: Traefik handles TLS; this app serves plain HTTP.
const behind_proxy = process.env.BEHIND_PROXY === 'true';

if (!behind_proxy && !process.env.SSL_CONTACT_EMAIL) {
    console.error(
        "[ERROR] Set SSL_CONTACT_EMAIL when running without BEHIND_PROXY=true."
    );
    process.exit(1);
}

(async () => {
    try {
        await database_init();

        const app = await get_app_server();

        if (behind_proxy) {
            // Trust only the proxy address that the app actually sees.
            // Do not use `true`: that would trust forwarded headers from anyone.
            const trustedProxy = process.env.TRUSTED_PROXY || '100.91.19.115';
            app.set('trust proxy', trustedProxy);

            const port = Number(process.env.PORT || 8080);
            if (!Number.isInteger(port) || port < 1 || port > 65535) {
                throw new Error(`Invalid PORT value: ${process.env.PORT}`);
            }

            const server = app.listen(port, '0.0.0.0', () => {
                console.log(`XSS Hunter listening on HTTP port ${port}`);
            });

            server.on('error', (err) => {
                console.error('HTTP server failed to start:', err);
                process.exit(1);
            });

            return;
        }

        require('greenlock-express').init({
            packageRoot: __dirname,
            configDir: './greenlock.d',
            cluster: false,
            maintainerEmail: process.env.SSL_CONTACT_EMAIL,
        }).serve(app);
    } catch (err) {
        console.error('XSS Hunter failed to start:', err);
        process.exit(1);
    }
})();
