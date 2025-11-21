require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkTotal() {
    try {
        const res = await pool.query(`
            SELECT COUNT(*) as count FROM parcels
        `);

        console.log('Total Parcels:', res.rows[0].count);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkTotal();
