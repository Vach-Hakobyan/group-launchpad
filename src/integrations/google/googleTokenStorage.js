const pool = require('../../config/db');

const loadGoogleTokens = async (oauth2Client) => {
    const result = await pool.query(
        'SELECT tokens FROM google_oauth_tokens WHERE id = $1',
        [1]
    );

    if (result.rows.length > 0) {
        oauth2Client.setCredentials(result.rows[0].tokens);
        console.log('Google tokens loaded from Neon');
    } else {
        console.log('Google tokens not found in Neon');
    }
};

const saveGoogleTokens = async (tokens) => {
    await pool.query(
        `INSERT INTO google_oauth_tokens (id, tokens)
         VALUES ($1, $2)
         ON CONFLICT (id)
         DO UPDATE SET
             tokens = EXCLUDED.tokens,
             updated_at = CURRENT_TIMESTAMP`,
        [1, tokens]
    );

    console.log('Google tokens saved to Neon');
};

module.exports = {
    loadGoogleTokens,
    saveGoogleTokens
};
