
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function testInsert() {
    try {
        // Get a collective survey id
        const res = await pool.query('SELECT id, num_parcel FROM collective_surveys LIMIT 1');
        const survey = res.rows[0];
        console.log('Testing with survey:', survey);

        const insertQuery = `
            INSERT INTO beneficiaries (
                collective_survey_id, num_parcel, beneficiary_number,
                prenom, nom, sexe, date_naiss, lieu_naiss, num_piece
            ) VALUES (
                $1, $2, 1,
                'BenTest', 'TEST', 'Homme', '1990-01-01', 'Loc', '123'
            )
        `;
        await pool.query(insertQuery, [survey.id, survey.num_parcel]);
        console.log('Insert successful');

    } catch (err) {
        console.error('Insert failed:', err);
    } finally {
        pool.end();
    }
}

testInsert();
