
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkParcel() {
    const id = '0522030303684';
    try {
        const res = await pool.query('SELECT id, num_parcel, status FROM parcels WHERE num_parcel = $1', [id]);
        console.log(`Found ${res.rows.length} parcels with num_parcel = ${id}`);
        if (res.rows.length > 0) {
            console.log('Parcel data:', res.rows[0]);
        }
        pool.end();
    } catch (err) {
        console.error('Error:', err);
        pool.end();
    }
}

checkParcel();
