
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkMissingData() {
    try {
        // Get all collective parcels
        const collectives = await pool.query('SELECT id, num_parcel FROM collective_surveys');
        console.log(`Total collective surveys: ${collectives.rows.length}`);

        let missingMandataries = 0;
        let missingBeneficiaries = 0;

        for (const survey of collectives.rows) {
            const mand = await pool.query('SELECT id FROM mandataries WHERE collective_survey_id = $1', [survey.id]);
            if (mand.rows.length === 0) missingMandataries++;

            const ben = await pool.query('SELECT id FROM beneficiaries WHERE collective_survey_id = $1', [survey.id]);
            if (ben.rows.length === 0) missingBeneficiaries++;
        }

        console.log(`Collectives missing mandataries: ${missingMandataries}`);
        console.log(`Collectives missing beneficiaries: ${missingBeneficiaries}`);

    } catch (err) {
        console.error('Error checking data:', err);
    } finally {
        pool.end();
    }
}

checkMissingData();
