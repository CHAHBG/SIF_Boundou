require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function inspectTemp() {
    try {
        const res = await pool.query(`
            SELECT * FROM parcels_nicad_temp LIMIT 3
        `);

        console.log('Temp Table Columns:', Object.keys(res.rows[0]));
        console.log('Sample Data:', res.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

inspectTemp();
