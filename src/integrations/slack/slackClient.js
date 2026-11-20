require('dotenv').config();

const { WebClient } = require('@slack/web-api');

const token = process.env.SLACK_BOT_TOKEN;

const slackClient = token
    ? new WebClient(token)
    : null;

module.exports = slackClient;
