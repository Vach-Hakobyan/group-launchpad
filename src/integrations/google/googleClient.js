
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');

const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

const tokenPath = path.join(
    __dirname,
    '../../../.tokens/google-token.json'
);

if (fs.existsSync(tokenPath)) {
    const tokens = JSON.parse(
        fs.readFileSync(tokenPath, 'utf8')
    );

    oauth2Client.setCredentials(tokens);

    console.log('Google tokens loaded');
}

const getGoogleAuthUrl = () => {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/classroom.courses',
    'https://www.googleapis.com/auth/classroom.rosters',
    'https://www.googleapis.com/auth/forms.body',
    'https://www.googleapis.com/auth/forms.responses.readonly'
],
        prompt: 'consent'
    });
};

module.exports = {
    oauth2Client,
    getGoogleAuthUrl
};
