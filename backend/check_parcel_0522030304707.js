
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkParcelData() {
    const numParcel = '0522030304707';
    try {
        console.log(`Checking data for parcel ${numParcel}...`);

        // Check parcel existence
        const parcel = await pool.query('SELECT * FROM parcels WHERE num_parcel = $1', [numParcel]);
        console.log('Parcel found:', parcel.rows.length > 0);

        // Check collective survey
        const survey = await pool.query('SELECT * FROM collective_surveys WHERE num_parcel = $1', [numParcel]);
        console.log('Collective Survey found:', survey.rows.length > 0);
        if (survey.rows.length > 0) {
            console.log('Survey ID:', survey.rows[0].id);
        }

        // Check mandataries
        const mandataries = await pool.query('SELECT * FROM mandataries WHERE num_parcel = $1', [numParcel]);
        console.log('Mandataries count:', mandataries.rows.length);
        console.log('Mandataries data:', mandataries.rows);

        // Check beneficiaries
        const beneficiaries = await pool.query('SELECT * FROM beneficiaries WHERE num_parcel = $1', [numParcel]);
        console.log('Beneficiaries count:', beneficiaries.rows.length);
        console.log('Beneficiaries data (first 2):', beneficiaries.rows.slice(0, 2));

    } catch (err) {
        console.error('Error checking data:', err);
    } finally {
        pool.end();
    }
}

checkParcelData();
