require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkProgress() {
    try {
        const res = await pool.query(`
            SELECT COUNT(*) as count 
            FROM parcels 
            WHERE nicad IS NOT NULL
        `);

        console.log('--- PROGRESS REPORT ---');
        console.log(`Parcels with NICAD: ${res.rows[0].count}`);
        console.log('-----------------------');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkProgress();
