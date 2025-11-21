
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function updateTypes() {
    try {
        console.log('Updating parcel types...');

        const query = `
            UPDATE parcels p
            SET type = 'collective'
            FROM collective_surveys cs
            WHERE p.num_parcel = cs.num_parcel
            AND p.type != 'collective';
        `;

        const res = await pool.query(query);
        console.log(`Updated ${res.rowCount} parcels to type 'collective'.`);

    } catch (err) {
        console.error('Error updating types:', err);
    } finally {
        pool.end();
    }
}

updateTypes();
