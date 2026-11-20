const { Pool } = require('pg');

const pool = new Pool({
    user: 'launchpad_user',
    host: 'localhost',
    database: 'group_launchpad',
    password: 'launchpad123',
    port: 5432
});

module.exports = pool;
