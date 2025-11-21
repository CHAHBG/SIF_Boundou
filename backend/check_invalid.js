
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkInvalidParcels() {
    try {
        const res = await pool.query(`
      SELECT num_parcel, status, type, st_astext(geom) as geom_text
      FROM parcels 
      WHERE num_parcel = '0' OR num_parcel IS NULL OR num_parcel = '';
    `);
        console.log('Invalid parcels found:', res.rows.length);
        console.log(res.rows);
    } catch (err) {
        console.error('Error checking parcels:', err);
    } finally {
        pool.end();
    }
}

checkInvalidParcels();
