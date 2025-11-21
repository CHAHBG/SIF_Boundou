
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function getValidParcels() {
    try {
        const res = await pool.query('SELECT num_parcel FROM parcels LIMIT 5');
        console.log('Valid Parcels:', res.rows.map(r => r.num_parcel));
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

getValidParcels();
