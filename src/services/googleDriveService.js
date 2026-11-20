
const { google } = require('googleapis');

const { oauth2Client } = require('../integrations/google/googleClient');

const drive = google.drive({
    version: 'v3',
    auth: oauth2Client
});

const createGroupFolder = async (groupName) => {
    const response = await drive.files.create({
        requestBody: {
            name: groupName,
            mimeType: 'application/vnd.google-apps.folder'
        },
        fields: 'id, name, webViewLink'
    });

    return {
        id: response.data.id,
        name: response.data.name,
        link: response.data.webViewLink
    };
};

module.exports = {
    createGroupFolder
};
