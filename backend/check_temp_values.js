require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkValues() {
    try {
        const res = await pool.query(`
            SELECT 
                DISTINCT grappesenegal, arrondissementsenegal, communesenegal 
            FROM parcels_nicad_temp
            LIMIT 10
        `);

        console.log('Distinct Values:', res.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkValues();
