require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function finalCleanup() {
    try {
        // Drop ref table
        await pool.query('DROP TABLE IF EXISTS parcels_nicad_ref');
        console.log('Dropped reference table.');

        // Final count
        const res = await pool.query('SELECT COUNT(*) FROM parcels WHERE nicad IS NOT NULL');
        console.log(`Final NICAD Count: ${res.rows[0].count}`);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

finalCleanup();
