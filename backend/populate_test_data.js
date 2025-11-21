
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function populateTestData() {
    const numParcel = '0522030304707';
    try {
        console.log(`Populating test data for parcel ${numParcel}...`);

        // Update Mandatary
        await pool.query(`
      UPDATE mandataries 
      SET 
        prenom = 'Moussa', 
        nom = 'DIALLO', 
        sexe = 'Homme', 
        date_naiss = '1980-01-01', 
        lieu_naiss = 'Boundou',
        num_piece = '1234567890123',
        date_deliv = '2020-01-01',
        contact = '+221 77 000 00 00'
      WHERE num_parcel = $1 AND mandatary_number = 1;
    `, [numParcel]);
        console.log('Updated Mandatary 1');

        // Update Beneficiaries (just the first few)
        await pool.query(`
      UPDATE beneficiaries 
      SET 
        date_naiss = '1990-05-15', 
        num_piece = '2345678901234'
      WHERE num_parcel = $1 AND beneficiary_number = 1;
    `, [numParcel]);

        await pool.query(`
      UPDATE beneficiaries 
      SET 
        date_naiss = '1992-08-20', 
        num_piece = '3456789012345'
      WHERE num_parcel = $1 AND beneficiary_number = 2;
    `, [numParcel]);

        console.log('Updated Beneficiaries');

    } catch (err) {
        console.error('Error populating data:', err);
    } finally {
        pool.end();
    }
}

populateTestData();
