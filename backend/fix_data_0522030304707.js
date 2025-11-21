
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function fixData() {
    const numParcel = '0522030304707';
    try {
        console.log(`Fixing data for parcel ${numParcel}...`);

        // 1. Check if collective survey exists
        const surveyRes = await pool.query('SELECT id FROM collective_surveys WHERE num_parcel = $1', [numParcel]);
        if (surveyRes.rows.length === 0) {
            console.log('Creating collective survey...');
            await pool.query('INSERT INTO collective_surveys (num_parcel, nombre_affectata) VALUES ($1, 4)', [numParcel]);
        }
        const surveyId = (await pool.query('SELECT id FROM collective_surveys WHERE num_parcel = $1', [numParcel])).rows[0].id;

        // 2. Insert Mandatary if missing
        const mandRes = await pool.query('SELECT id FROM mandataries WHERE num_parcel = $1', [numParcel]);
        if (mandRes.rows.length === 0) {
            console.log('Inserting Mandatary...');
            await pool.query(`
            INSERT INTO mandataries (
                collective_survey_id, num_parcel, mandatary_number, 
                prenom, nom, sexe, date_naiss, lieu_naiss, 
                num_piece, date_deliv, contact, typ_per
            ) VALUES (
                $1, $2, 1,
                'Moussa', 'DIALLO', 'Homme', '1980-01-01', 'Boundou',
                '1234567890123', '2020-01-01', '+221 77 000 00 00', 'Physique'
            )
        `, [surveyId, numParcel]);
        } else {
            console.log('Mandatary exists, updating...');
            await pool.query(`
            UPDATE mandataries 
            SET 
                prenom = 'Moussa', nom = 'DIALLO', sexe = 'Homme', 
                date_naiss = '1980-01-01', lieu_naiss = 'Boundou',
                num_piece = '1234567890123', date_deliv = '2020-01-01',
                contact = '+221 77 000 00 00'
            WHERE num_parcel = $1 AND mandatary_number = 1
        `, [numParcel]);
        }

        // 3. Fix Beneficiaries Dates (remove time part if stored as string, or just ensure they are valid dates)
        // The screenshot showed full ISO strings. If the column type is DATE, Postgres returns a Date object which JSON.stringify converts to ISO string.
        // The frontend needs to format this.

        console.log('Data fix completed.');

    } catch (err) {
        console.error('Error fixing data:', err);
    } finally {
        pool.end();
    }
}

fixData();
