
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkMandatary() {
    const numParcel = '0522030304707';
    try {
        const res = await pool.query('SELECT id, mandatary_number, prenom, nom FROM mandataries WHERE num_parcel = $1', [numParcel]);
        console.log('Mandataries:', res.rows);
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkMandatary();
