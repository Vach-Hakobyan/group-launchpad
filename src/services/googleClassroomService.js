const { google } = require('googleapis');

const { oauth2Client } = require('../integrations/google/googleClient');

const classroom = google.classroom({
    version: 'v1',
    auth: oauth2Client
});

const createClassroomCourse = async (groupName, startDate) => {
    const response = await classroom.courses.create({
        requestBody: {
            name: groupName,
            section: `Group Launchpad - ${startDate}`,
            ownerId: 'me'
        }
    });

    return {
        id: response.data.id,
        name: response.data.name,
        link: response.data.alternateLink
    };
};

module.exports = {
    createClassroomCourse
};
