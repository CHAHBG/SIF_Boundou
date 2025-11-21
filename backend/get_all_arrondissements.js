require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function getAllArrondissements() {
    try {
        const res = await pool.query(`
            SELECT DISTINCT UPPER(arrondissementsenegal) as arr
            FROM parcels_nicad_temp
            ORDER BY arr
        `);

        console.log('Arrondissements:', res.rows.map(r => r.arr));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

getAllArrondissements();
