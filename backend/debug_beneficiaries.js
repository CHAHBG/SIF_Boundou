
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function debug() {
    try {
        const count = await pool.query('SELECT count(*) FROM beneficiaries');
        console.log('Beneficiaries count:', count.rows[0].count);

        // Try insert again with full error logging
        const res = await pool.query('SELECT id, num_parcel FROM collective_surveys LIMIT 1');
        const survey = res.rows[0];

        await pool.query(`
            INSERT INTO beneficiaries (
                collective_survey_id, num_parcel, beneficiary_number,
                prenom, nom, sexe, date_naiss, lieu_naiss, num_piece
            ) VALUES (
                $1, $2, 99,
                'Debug', 'TEST', 'Homme', '1990-01-01', 'Loc', '999'
            )
        `, [survey.id, survey.num_parcel]);
        console.log('Insert success');

    } catch (err) {
        console.error('Full Error:', err);
        console.error('Message:', err.message);
        console.error('Detail:', err.detail);
        console.error('Code:', err.code);
    } finally {
        pool.end();
    }
}

debug();
