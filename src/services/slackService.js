
const slackClient = require('../integrations/slack/slackClient');

// Создаём Slack-канал
const createSlackChannel = async (groupName) => {
    if (!slackClient) {
        throw new Error('SLACK_BOT_TOKEN is not configured');
    }

    const channelName = groupName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80);

    if (!channelName) {
        throw new Error('Invalid Slack channel name');
    }

    try {
        const result = await slackClient.conversations.create({
            name: channelName,
            is_private: false
        });

        return {
            id: result.channel.id,
            name: result.channel.name,
            created: true
        };
    } catch (error) {
        if (error.data?.error === 'name_taken') {
            return {
                name: channelName,
                created: false,
                message: 'Channel already exists'
            };
        }

        throw error;
    }
};

// Ищем пользователя по email
const findSlackUserByEmail = async (email) => {
    const result = await slackClient.users.lookupByEmail({ email });
    return result.user.id;
};

// Приглашаем пользователя в канал
const inviteUserToChannel = async (channelId, userId) => {
    await slackClient.conversations.invite({
        channel: channelId,
        users: userId
    });

    return true;
};

// Получаем участников канала
const getSlackChannelMembers = async (channelId) => {
    const result = await slackClient.conversations.members({
        channel: channelId
    });

    return result.members;
};

// Отправляем сообщение в канал
const sendChannelMessage = async (channelId, message) => {
    const result = await slackClient.chat.postMessage({
        channel: channelId,
        text: message
    });

    return {
        sent: result.ok,
        timestamp: result.ts
    };
};

module.exports = {
    createSlackChannel,
    findSlackUserByEmail,
    inviteUserToChannel,
    getSlackChannelMembers,
    sendChannelMessage
};
