
const express = require('express');

const router = express.Router();

const {
    oauth2Client,
    getGoogleAuthUrl
} = require('../integrations/google/googleClient');

const {
    saveGoogleTokens
} = require('../integrations/google/googleTokenStorage');

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

        // Сохраняем старый refresh_token, если Google его не вернул
        const updatedTokens = {
            ...oauth2Client.credentials,
            ...tokens
        };

        oauth2Client.setCredentials(updatedTokens);

        await saveGoogleTokens(updatedTokens);

        console.log('Google authorization successful');

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
