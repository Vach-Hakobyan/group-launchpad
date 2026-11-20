
const cron = require('node-cron');
const pool = require('../config/db');

const {
    sendChannelMessage,
    getSlackChannelMembers,
    findSlackUserByEmail
} = require('./slackService');

// Текущая дата по времени Армении
const getYerevanDate = (daysToAdd = 0) => {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Yerevan',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(new Date());

    const values = {};
    parts.forEach(part => {
        values[part.type] = part.value;
    });

    const date = new Date(Date.UTC(
        Number(values.year),
        Number(values.month) - 1,
        Number(values.day) + daysToAdd
    ));

    return date.toISOString().slice(0, 10);
};

// Создаём таблицу логов
const ensureLogTable = async () => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS announcement_logs (
            id SERIAL PRIMARY KEY,
            group_id INTEGER NOT NULL REFERENCES groups(id),
            announcement_type VARCHAR(100) NOT NULL,
            sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE (group_id, announcement_type)
        )
    `);
};

// Объявления о начале группы
const runScheduledAnnouncements = async () => {
    try {
        await ensureLogTable();

        const today = getYerevanDate();
        const threeDaysLater = getYerevanDate(3);

        const result = await pool.query(
            `SELECT id, group_name, start_date, slack_channel_id
             FROM groups
             WHERE start_date IN ($1::date, $2::date)
               AND slack_channel_id IS NOT NULL`,
            [today, threeDaysLater]
        );

        for (const group of result.rows) {
            const startDate = String(group.start_date).slice(0, 10);
            const type = startDate === today
                ? 'start_day'
                : 'three_days_before';

            const alreadySent = await pool.query(
                `SELECT id FROM announcement_logs
                 WHERE group_id = $1 AND announcement_type = $2`,
                [group.id, type]
            );

            if (alreadySent.rows.length > 0) continue;

            const message = type === 'start_day'
                ? `🎉 Today is the first day of ${group.group_name}! Welcome everyone. Let's get started!`
                : `📢 Reminder: ${group.group_name} starts in 3 days! Please get ready.`;

            try {
                await sendChannelMessage(group.slack_channel_id, message);

                await pool.query(
                    `INSERT INTO announcement_logs
                     (group_id, announcement_type)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [group.id, type]
                );

                console.log(`Announcement sent: ${group.group_name}`);
            } catch (error) {
                console.error('Announcement failed:', error.message);
            }
        }
    } catch (error) {
        console.error('Announcement scheduler error:', error.message);
    }
};

// Ежедневная проверка участников Slack
const runDailyAudit = async () => {
    try {
        await ensureLogTable();

        const today = getYerevanDate();

        const groups = await pool.query(`
            SELECT g.id, g.group_name, g.slack_channel_id
            FROM groups g
            WHERE g.slack_channel_id IS NOT NULL
              AND EXISTS (
                  SELECT 1 FROM students s
                  WHERE s.group_id = g.id
              )
        `);

        for (const group of groups.rows) {
            const logType = `daily_audit_${today}`;

            const alreadyChecked = await pool.query(
                `SELECT id FROM announcement_logs
                 WHERE group_id = $1 AND announcement_type = $2`,
                [group.id, logType]
            );

            if (alreadyChecked.rows.length > 0) continue;

            try {
                const students = await pool.query(
                    `SELECT id, email FROM students
                     WHERE group_id = $1`,
                    [group.id]
                );

                const members = await getSlackChannelMembers(
                    group.slack_channel_id
                );

                const missing = [];

                for (const student of students.rows) {
                    try {
                        const userId = await findSlackUserByEmail(
                            student.email
                        );

                        if (!members.includes(userId)) {
                            missing.push(student.email);
                        }
                    } catch (error) {
                        missing.push(student.email);
                    }
                }

                if (missing.length > 0) {
                    const message =
                        `⚠️ Daily Group Audit: ${group.group_name}\n\n` +
                        `The following students have not joined the Slack channel:\n` +
                        missing.map(email => `• ${email}`).join('\n') +
                        `\n\nPlease join the group channel.`;

                    await sendChannelMessage(
                        group.slack_channel_id,
                        message
                    );

                    console.log(
                        `Audit reminder sent: ${group.group_name}, missing: ${missing.length}`
                    );
                } else {
                    console.log(`Daily audit passed: ${group.group_name}`);
                }

                await pool.query(
                    `INSERT INTO announcement_logs
                     (group_id, announcement_type)
                     VALUES ($1, $2)
                     ON CONFLICT DO NOTHING`,
                    [group.id, logType]
                );

            } catch (error) {
                console.error(
                    `Daily audit failed for ${group.group_name}:`,
                    error.message
                );
            }
        }
    } catch (error) {
        console.error('Daily audit error:', error.message);
    }
};

// Запускаем оба задания ежедневно в 09:00
const startAnnouncementScheduler = () => {
    cron.schedule('0 9 * * *', async () => {
        await runScheduledAnnouncements();
        await runDailyAudit();
    }, {
        timezone: 'Asia/Yerevan'
    });

    console.log('Announcement scheduler started');
};

module.exports = {
    startAnnouncementScheduler,
    runScheduledAnnouncements,
    runDailyAudit
};
