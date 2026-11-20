
const express = require('express');
const fs = require('fs/promises');
const path = require('path');

const router = express.Router();

const {
    oauth2Client,
    getGoogleAuthUrl
} = require('../integrations/google/googleClient');

const tokenPath = path.join(
    __dirname,
    '../../.tokens/google-token.json'
);

router.get('/google', (req, res) => {
    const url = getGoogleAuthUrl();
    res.redirect(url);
});

router.get('/google/callback', async (req, res) => {
    const { code } = req.query;

    if (!code) {
        return res.status(400).json({
            error: 'Authorization code is missing'
        });
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);

        oauth2Client.setCredentials(tokens);

        await fs.mkdir(path.dirname(tokenPath), {
            recursive: true
        });

        await fs.writeFile(
            tokenPath,
            JSON.stringify(tokens, null, 2),
            { mode: 0o600 }
        );

        console.log('Google authorization successful');
        console.log('Google tokens saved');

        res.json({
            message: 'Google account connected successfully'
        });
    } catch (error) {
        console.error('Google OAuth error:', error.message);

        res.status(500).json({
            error: 'Google authorization failed'
        });
    }
});

module.exports = router;
