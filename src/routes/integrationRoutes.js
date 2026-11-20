const express = require('express');
const router = express.Router();

const { oauth2Client } = require('../integrations/google/googleClient');
const slackClient = require('../integrations/slack/slackClient');

router.get('/', async (req, res) => {
    const integrations = {
        google: { connected: false },
        slack: { connected: false }
    };

    // Проверяем Google
    try {
        const credentials = oauth2Client.credentials;

        if (credentials.access_token || credentials.refresh_token) {
            await oauth2Client.getAccessToken();
            integrations.google.connected = true;
        }
    } catch (error) {
        console.error('Google status error:', error.message);
    }

    // Проверяем Slack
    try {
        if (slackClient) {
            const result = await slackClient.auth.test();

            integrations.slack = {
                connected: true,
                team: result.team
            };
        }
    } catch (error) {
        console.error('Slack status error:', error.message);
    }

    res.json(integrations);
});

module.exports = router;
