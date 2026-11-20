const pool = require('../config/db');
const { createGroupFolder } = require('../services/googleDriveService');
const {
    createClassroomCourse
} = require('../services/googleClassroomService');
const {
    createGroupForm,
    getGroupFormResponses
} = require('../services/googleFormsService');
const {
    createSlackChannel,
    findSlackUserByEmail,
    inviteUserToChannel,
    getSlackChannelMembers,
    sendChannelMessage
} = require('../services/slackService');


// Проверяем ID группы
const validateId = (id) => {
    return /^\d+$/.test(id) && Number(id) > 0;
};

// Проверяем название группы
const validateGroupName = (name) => {
    return (
        typeof name === 'string' &&
        name.trim().length > 0 &&
        name.trim().length <= 100
    );
};

// Проверяем дату
const validateDate = (date) => {
    if (typeof date !== 'string') return false;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return false;
    }

    const parsedDate = new Date(`${date}T00:00:00Z`);

    return (
        !Number.isNaN(parsedDate.getTime()) &&
        parsedDate.toISOString().slice(0, 10) === date
    );
};

// Проверяем массив email
const validateEmails = (emails) => {
    if (!Array.isArray(emails)) {
        return false;
    }

    return emails.every((email) =>
        typeof email === 'string' &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    );
};

// Добавляем студентов или преподавателей
const insertMembers = async (client, table, emails, groupId) => {
    for (const email of emails) {
        await client.query(
            `INSERT INTO ${table} (email, group_id) VALUES ($1, $2)`,
            [email.trim(), groupId]
        );
    }
};

// Получаем одну группу вместе со студентами и преподавателями
const getGroupRecord = async (db, id) => {
    const result = await db.query(
        `SELECT
            g.id,
            g.group_name,
            TO_CHAR(g.start_date, 'YYYY-MM-DD') AS start_date,
            COALESCE(
                (
                    SELECT json_agg(s.email ORDER BY s.email)
                    FROM students s
                    WHERE s.group_id = g.id
                ),
                '[]'::json
            ) AS students,
            COALESCE(
                (
                    SELECT json_agg(l.email ORDER BY l.email)
                    FROM lecturers l
                    WHERE l.group_id = g.id
                ),
                '[]'::json
            ) AS lecturers
        FROM groups g
        WHERE g.id = $1`,
        [id]
    );

    return result.rows[0];
};


// POST /api/groups
// Создание группы

const createGroup = async (req, res) => {
    const { groupName, startDate, students, lecturers } = req.body || {};

    if (
        !validateGroupName(groupName) ||
        !validateDate(startDate) ||
        !validateEmails(students) ||
        !validateEmails(lecturers)
    ) {
        return res.status(400).json({
            error: 'Invalid group data'
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        const groupResult = await client.query(
            `INSERT INTO groups (group_name, start_date)
             VALUES ($1, $2)
             RETURNING id`,
            [groupName.trim(), startDate]
        );

        const groupId = groupResult.rows[0].id;

        await insertMembers(client, 'students', students, groupId);
        await insertMembers(client, 'lecturers', lecturers, groupId);

        const group = await getGroupRecord(client, groupId);

        await client.query('COMMIT');
        transactionStarted = false;

        // Создаём Google Drive папку
        let driveFolder;

        try {
            driveFolder = await createGroupFolder(group.group_name);

            await pool.query(
                `UPDATE groups
                 SET drive_folder_id = $1,
                     drive_folder_url = $2
                 WHERE id = $3`,
                [driveFolder.id, driveFolder.link, groupId]
            );

        } catch (error) {
            console.error('Google Drive error:', error.message);

            driveFolder = {
                created: false,
                error: error.message
            };
        }

        // Создаём Google Classroom курс
        let classroomCourse;

        try {
            classroomCourse = await createClassroomCourse(
                group.group_name,
                group.start_date
            );

            await pool.query(
                `UPDATE groups
                 SET classroom_course_id = $1,
                     classroom_course_url = $2
                 WHERE id = $3`,
                [
                    classroomCourse.id,
                    classroomCourse.link,
                    groupId
                ]
            );

        } catch (error) {
            console.error('Google Classroom error:', error.message);

            classroomCourse = {
                created: false,
                error: error.message
            };
        }      
        // Создаём Google Form
        let groupForm;

        try {
            groupForm = await createGroupForm(group.group_name);

            await pool.query(
                `UPDATE groups
                 SET form_id = $1,
                     form_url = $2
                 WHERE id = $3`,
                [
                    groupForm.id,
                    groupForm.link,
                    groupId
                ]
            );

        } catch (error) {
            console.error('Google Forms error:', error.message);

            groupForm = {
                created: false,
                error: error.message
            };
        }    

        // Создаём Slack-канал
        let slack;

        try {
            slack = await createSlackChannel(group.group_name);

            if (slack.created && slack.id) {
                await pool.query(
                    `UPDATE groups
                     SET slack_channel_id = $1,
                         slack_channel_name = $2
                     WHERE id = $3`,
                    [slack.id, slack.name, groupId]
                );

                const members = [...students, ...lecturers];
                const invitationResults = [];

                for (const email of members) {
                    try {
                        const userId = await findSlackUserByEmail(email);

                        await inviteUserToChannel(slack.id, userId);

                        invitationResults.push({
                            email,
                            invited: true
                        });

                    } catch (error) {
                        invitationResults.push({
                            email,
                            invited: false,
                            reason: error.data?.error || error.message
                        });
                    }
                }

                slack.invitations = invitationResults;

// Отправляем приветственное сообщение
try {
    const welcomeMessage =
        `Welcome to ${group.group_name}! 🎉\n\n` +
        `Your group starts on ${group.start_date}.\n` +
        `We are happy to have you here!\n\n` +
        `Please check this channel for announcements and important updates.`;

    slack.welcomeMessage = await sendChannelMessage(
        slack.id,
        welcomeMessage
    );

} catch (error) {
    console.error('Welcome message error:', error.message);

    slack.welcomeMessage = {
        sent: false,
        error: error.data?.error || error.message
    };
}
   
// Представление преподавателей
try {
    const staffMessage = lecturers.length > 0
        ? `👨‍🏫 Staff Introductions\n\nYour group lecturers:\n${lecturers.map((email, index) => `${index + 1}. ${email}`).join('\n')}\n\nWelcome to the team!`
        : '👨‍🏫 Staff Introductions\n\nLecturer information has not been added yet.';

    slack.staffIntroductions = await sendChannelMessage(
        slack.id,
        staffMessage
    );

} catch (error) {
    console.error('Staff introductions error:', error.message);

    slack.staffIntroductions = {
        sent: false,
        error: error.data?.error || error.message
    };
}

// Правила группы
try {
    const rulesMessage =
        `📋 Group Rules\n\n` +
        `1. Be respectful to everyone.\n` +
        `2. Communicate clearly and professionally.\n` +
        `3. Complete assignments on time.\n` +
        `4. Ask questions when you need help.\n` +
        `5. Keep important discussions in this channel.\n\n` +
        `Let's learn and build together! 🚀`;

    slack.groupRules = await sendChannelMessage(
        slack.id,
        rulesMessage
    );

} catch (error) {
    console.error('Group rules error:', error.message);

    slack.groupRules = {
        sent: false,
        error: error.data?.error || error.message
    };
}
         }

        } catch (error) {
            console.error('Slack error:', error.message);

            slack = {
                created: false,
                error: 'Failed to create Slack channel'
            };
        }

        return res.status(201).json({
    message: 'Group created successfully',
    group,
    driveFolder,
    classroomCourse,
    groupForm,
    slack
});

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error);

        return res.status(500).json({
            error: 'Failed to create group'
        });

    } finally {
        if (client) client.release();
    }
};

// GET /api/groups
// Получение всех групп
const getGroups = async (req, res) => {
    try {
        const result = await pool.query(
         `SELECT
    g.id,
    g.group_name,
    TO_CHAR(g.start_date, 'YYYY-MM-DD') AS start_date,
    g.slack_channel_id,
    g.slack_channel_name,
    g.drive_folder_url,
    g.classroom_course_url,
    g.form_url,

    COALESCE(student_data.students, '[]'::json) AS students,
    COALESCE(lecturer_data.lecturers, '[]'::json) AS lecturers

FROM groups g

LEFT JOIN (
    SELECT group_id, json_agg(email ORDER BY email) AS students
    FROM students
    GROUP BY group_id
) AS student_data ON g.id = student_data.group_id

LEFT JOIN (
    SELECT group_id, json_agg(email ORDER BY email) AS lecturers
    FROM lecturers
    GROUP BY group_id
) AS lecturer_data ON g.id = lecturer_data.group_id

ORDER BY g.id`
        );

        return res.status(200).json(result.rows);

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'Failed to get groups'
        });
    }
};


// GET /api/groups/:id
// Получение одной группы
const getGroupById = async (req, res) => {
    const { id } = req.params;

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    try {
        const group = await getGroupRecord(pool, id);

        if (!group) {
            return res.status(404).json({
                error: 'Group not found'
            });
        }

        return res.status(200).json(group);

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'Failed to get group'
        });
    }
};


// PATCH /api/groups/:id
// Частичное обновление группы
const updateGroup = async (req, res) => {
    const { id } = req.params;
    const body = req.body || {};

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    const allowedFields = [
        'groupName',
        'startDate',
        'students',
        'lecturers'
    ];

    if (
        Object.keys(body).length === 0 ||
        Object.keys(body).some((key) => !allowedFields.includes(key))
    ) {
        return res.status(400).json({
            error: 'Invalid or empty update data'
        });
    }

    if (
        body.groupName !== undefined &&
        !validateGroupName(body.groupName)
    ) {
        return res.status(400).json({
            error: 'Invalid group name'
        });
    }

    if (
        body.startDate !== undefined &&
        !validateDate(body.startDate)
    ) {
        return res.status(400).json({
            error: 'Invalid start date'
        });
    }

    if (
        body.students !== undefined &&
        !validateEmails(body.students)
    ) {
        return res.status(400).json({
            error: 'Invalid students list'
        });
    }

    if (
        body.lecturers !== undefined &&
        !validateEmails(body.lecturers)
    ) {
        return res.status(400).json({
            error: 'Invalid lecturers list'
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        const exists = await client.query(
            'SELECT id FROM groups WHERE id = $1',
            [id]
        );

        if (exists.rows.length === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(404).json({
                error: 'Group not found'
            });
        }

        const updates = [];
        const values = [];

        if (body.groupName !== undefined) {
            values.push(body.groupName.trim());
            updates.push(`group_name = $${values.length}`);
        }

        if (body.startDate !== undefined) {
            values.push(body.startDate);
            updates.push(`start_date = $${values.length}`);
        }

        if (updates.length > 0) {
            values.push(id);

            await client.query(
                `UPDATE groups
                 SET ${updates.join(', ')}
                 WHERE id = $${values.length}`,
                values
            );
        }

        if (body.students !== undefined) {
            await client.query(
                'DELETE FROM students WHERE group_id = $1',
                [id]
            );

            await insertMembers(
                client,
                'students',
                body.students,
                id
            );
        }

        if (body.lecturers !== undefined) {
            await client.query(
                'DELETE FROM lecturers WHERE group_id = $1',
                [id]
            );

            await insertMembers(
                client,
                'lecturers',
                body.lecturers,
                id
            );
        }

        const group = await getGroupRecord(client, id);

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(200).json({
            message: 'Group updated successfully',
            group
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error);

        return res.status(500).json({
            error: 'Failed to update group'
        });

    } finally {
        if (client) client.release();
    }
};


// PUT /api/groups/:id
// Полное обновление группы
const replaceGroup = async (req, res) => {
    const { id } = req.params;
    const { groupName, startDate, students, lecturers } = req.body || {};

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    if (
        !validateGroupName(groupName) ||
        !validateDate(startDate) ||
        !validateEmails(students) ||
        !validateEmails(lecturers)
    ) {
        return res.status(400).json({
            error: 'Invalid group data'
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        const result = await client.query(
            `UPDATE groups
             SET group_name = $1, start_date = $2
             WHERE id = $3
             RETURNING id`,
            [groupName.trim(), startDate, id]
        );

        if (result.rows.length === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(404).json({
                error: 'Group not found'
            });
        }

        await client.query(
            'DELETE FROM students WHERE group_id = $1',
            [id]
        );

        await client.query(
            'DELETE FROM lecturers WHERE group_id = $1',
            [id]
        );

        await insertMembers(client, 'students', students, id);
        await insertMembers(client, 'lecturers', lecturers, id);

        const group = await getGroupRecord(client, id);

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(200).json({
            message: 'Group replaced successfully',
            group
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error);

        return res.status(500).json({
            error: 'Failed to replace group'
        });

    } finally {
        if (client) client.release();
    }
};


// DELETE /api/groups/:id
// Удаление группы
const deleteGroup = async (req, res) => {
    const { id } = req.params;

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        const exists = await client.query(
            'SELECT id FROM groups WHERE id = $1',
            [id]
        );

        if (exists.rows.length === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(404).json({
                error: 'Group not found'
            });
        }

        await client.query(
            'DELETE FROM students WHERE group_id = $1',
            [id]
        );

        await client.query(
            'DELETE FROM lecturers WHERE group_id = $1',
            [id]
        );

        await client.query(
            'DELETE FROM groups WHERE id = $1',
            [id]
        );

        await client.query('COMMIT');
        transactionStarted = false;

        return res.status(200).json({
            message: 'Group deleted successfully'
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error);

        return res.status(500).json({
            error: 'Failed to delete group'
        });

    } finally {
        if (client) client.release();
    }
};


// Добавляем новых участников в существующую группу
const addGroupMembers = async (req, res) => {
    const { id } = req.params;
    const { students = [], lecturers = [] } = req.body || {};

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    if (
        !validateEmails(students) ||
        !validateEmails(lecturers) ||
        (students.length === 0 && lecturers.length === 0)
    ) {
        return res.status(400).json({
            error: 'Invalid member data'
        });
    }

    let client;
    let transactionStarted = false;

    try {
        client = await pool.connect();

        await client.query('BEGIN');
        transactionStarted = true;

        const groupResult = await client.query(
            `SELECT id, slack_channel_id
             FROM groups
             WHERE id = $1`,
            [id]
        );
module.exports = {
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    replaceGroup,
    deleteGroup,
    addGroupMembers,
    syncGroupFormResponses,
    auditGroupMembers
};
        if (groupResult.rows.length === 0) {
            await client.query('ROLLBACK');
            transactionStarted = false;

            return res.status(404).json({
                error: 'Group not found'
            });
        }

        const group = groupResult.rows[0];

        const added = {
            students: [],
            lecturers: []
        };

        const existingStudents = await client.query(
            'SELECT email FROM students WHERE group_id = $1',
            [id]
        );

        const existingLecturers = await client.query(
            'SELECT email FROM lecturers WHERE group_id = $1',
            [id]
        );

        const studentEmails = new Set(
            existingStudents.rows.map(row => row.email.toLowerCase())
        );

        const lecturerEmails = new Set(
            existingLecturers.rows.map(row => row.email.toLowerCase())
        );

        for (const email of [...new Set(students.map(e => e.trim()))]) {
            if (!studentEmails.has(email.toLowerCase())) {
                await insertMembers(client, 'students', [email], id);
                added.students.push(email);
            }
        }

        for (const email of [...new Set(lecturers.map(e => e.trim()))]) {
            if (!lecturerEmails.has(email.toLowerCase())) {
                await insertMembers(client, 'lecturers', [email], id);
                added.lecturers.push(email);
            }
        }

        await client.query('COMMIT');
        transactionStarted = false;

        const invitations = [];

        if (group.slack_channel_id) {
            const newMembers = [
                ...added.students,
                ...added.lecturers
            ];

            for (const email of newMembers) {
                try {
                    const userId = await findSlackUserByEmail(email);

                    await inviteUserToChannel(
                        group.slack_channel_id,
                        userId
                    );

                    invitations.push({
                        email,
                        invited: true
                    });
                } catch (error) {
                    invitations.push({
                        email,
                        invited: false,
                        reason: error.data?.error || error.message
                    });
                }
            }
        }

        const updatedGroup = await getGroupRecord(pool, id);

        return res.status(200).json({
            message: 'Group members processed successfully',
            group: updatedGroup,
            added,
            invitations
        });

    } catch (error) {
        if (transactionStarted) {
            await client.query('ROLLBACK');
        }

        console.error(error);

        return res.status(500).json({
            error: 'Failed to add group members'
        });

    } finally {
        if (client) client.release();
    }
};

// POST /api/groups/:id/sync-form-responses
// Синхронизация ответов Google Forms с PostgreSQL
const syncGroupFormResponses = async (req, res) => {
    const { id } = req.params;

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    try {
        // Получаем форму группы
        const result = await pool.query(
            `SELECT id, form_id
             FROM groups
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Group not found'
            });
        }

        const formId = result.rows[0].form_id;

        if (!formId) {
            return res.status(400).json({
                error: 'Google Form not found for this group'
            });
        }

        // Получаем ответы из Google Forms
        const responses = await getGroupFormResponses(formId);

        let inserted = 0;
        let updated = 0;
        let skipped = 0;

        for (const response of responses) {
            const fullName = response.fullName?.trim();
            const email = response.email?.trim().toLowerCase();
            const phone = response.phone?.trim() || null;

            if (!fullName || !email || !response.responseId) {
                skipped++;
                continue;
            }

            // Обновляем студента, если его email уже есть в группе
            const existing = await pool.query(
                `UPDATE students
                 SET full_name = $1,
                     phone = $2,
                     form_response_id = $3
                 WHERE group_id = $4
                   AND LOWER(email) = $5
                   AND form_response_id IS NULL
                 RETURNING id`,
                [
                    fullName,
                    phone,
                    response.responseId,
                    id,
                    email
                ]
            );

            if (existing.rowCount > 0) {
                updated++;
                continue;
            }

            // Если студента ещё нет, добавляем его
            const added = await pool.query(
                `INSERT INTO students
                    (email, group_id, full_name, phone, form_response_id)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (form_response_id) DO NOTHING
                 RETURNING id`,
                [
                    email,
                    id,
                    fullName,
                    phone,
                    response.responseId
                ]
            );

            if (added.rowCount > 0) {
                inserted++;
            } else {
                skipped++;
            }
        }

        return res.status(200).json({
            message: 'Form responses synchronized successfully',
            groupId: Number(id),
            totalResponses: responses.length,
            inserted,
            updated,
            skipped
        });

    } catch (error) {
        console.error('Form synchronization error:', error);

        return res.status(500).json({
            error: 'Failed to synchronize form responses'
        });
    }
};
// POST /api/groups/:id/audit
// Проверяем, кто из студентов присоединился к Slack-каналу
const auditGroupMembers = async (req, res) => {
    const { id } = req.params;

    if (!validateId(id)) {
        return res.status(400).json({
            error: 'Invalid group ID'
        });
    }

    try {
        const result = await pool.query(
            `SELECT
                s.id,
                s.email,
                g.slack_channel_id
             FROM students s
             JOIN groups g ON s.group_id = g.id
             WHERE g.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                error: 'Group not found or no students found'
            });
        }

        const channelId = result.rows[0].slack_channel_id;

        if (!channelId) {
            return res.status(400).json({
                error: 'Slack channel not found'
            });
        }

        const members = await getSlackChannelMembers(channelId);

        const joined = [];
        const missing = [];

        for (const student of result.rows) {
            try {
                const user = await findSlackUserByEmail(student.email);

                if (members.includes(user)) {
                    joined.push(student);
                } else {
                    missing.push(student);
                }
            } catch (error) {
                missing.push({
                    ...student,
                    reason: 'Slack user not found'
                });
            }
        }

        return res.status(200).json({
            message: 'Group audit completed',
            groupId: Number(id),
            totalStudents: result.rows.length,
            joined: joined.length,
            missing: missing.length,
            joinedStudents: joined,
            missingStudents: missing
        });

    } catch (error) {
        console.error('Group audit error:', error);

        return res.status(500).json({
            error: 'Failed to audit group members'
        });
    }
};

module.exports = {
    createGroup,
    getGroups,
    getGroupById,
    updateGroup,
    replaceGroup,
    deleteGroup,
    addGroupMembers,
    syncGroupFormResponses,
    auditGroupMembers
};
