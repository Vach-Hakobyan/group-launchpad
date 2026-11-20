const { google } = require('googleapis');

const { oauth2Client } = require('../integrations/google/googleClient');

const forms = google.forms({
    version: 'v1',
    auth: oauth2Client
});

const createGroupForm = async (groupName) => {
    const response = await forms.forms.create({
        requestBody: {
            info: {
                title: `${groupName} - Student Information Form`,
                documentTitle: `${groupName} - Student Information`
            }
        }
    });

    const formId = response.data.formId;

    await forms.forms.batchUpdate({
        formId,
        requestBody: {
            requests: [
                {
                    createItem: {
                        item: {
                            title: 'Full Name',
                            questionItem: {
                                question: {
                                    required: true,
                                    textQuestion: {}
                                }
                            }
                        },
                        location: {
                            index: 0
                        }
                    }
                },
                {
                    createItem: {
                        item: {
                            title: 'Email',
                            questionItem: {
                                question: {
                                    required: true,
                                    textQuestion: {}
                                }
                            }
                        },
                        location: {
                            index: 1
                        }
                    }
                },
                {
                    createItem: {
                        item: {
                            title: 'Phone Number',
                            questionItem: {
                                question: {
                                    required: false,
                                    textQuestion: {}
                                }
                            }
                        },
                        location: {
                            index: 2
                        }
                    }
                }
            ]
        }
    });

    return {
        id: formId,
        name: response.data.info.title,
        link: `https://docs.google.com/forms/d/${formId}/viewform`
    };
};
const getGroupFormResponses = async (formId) => {
    const formResponse = await forms.forms.get({
        formId
    });

    const questions = {};

    for (const item of formResponse.data.items || []) {
        const question = item.questionItem?.question;

        if (question?.questionId) {
            questions[item.title] = question.questionId;
        }
    }

    const response = await forms.forms.responses.list({
        formId
    });

    const responses = response.data.responses || [];

    return responses.map((item) => {
        const answers = item.answers || {};

        const getAnswer = (questionTitle) => {
            const questionId = questions[questionTitle];

            if (!questionId || !answers[questionId]) {
                return null;
            }

            return answers[questionId]
                .textAnswers?.answers?.[0]?.value || null;
        };

        return {
            responseId: item.responseId,
            fullName: getAnswer('Full Name'),
            email: getAnswer('Email'),
            phone: getAnswer('Phone Number')
        };
    });
};
module.exports = {
    createGroupForm,
    getGroupFormResponses
};

