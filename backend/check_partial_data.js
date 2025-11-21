require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkPartialLocationData() {
    try {
        const res = await pool.query(`
            SELECT count(*) 
            FROM parcels 
            WHERE region_senegal IS NOT NULL 
            AND (department_senegal IS NULL OR arrondissement_senegal IS NULL)
        `);
        console.log(`Parcels with Region but missing Department/Arrondissement: ${res.rows[0].count}`);

        if (parseInt(res.rows[0].count) > 0) {
            const sample = await pool.query(`
                SELECT num_parcel, region_senegal, department_senegal, arrondissement_senegal
                FROM parcels 
                WHERE region_senegal IS NOT NULL 
                AND (department_senegal IS NULL OR arrondissement_senegal IS NULL)
                LIMIT 5
            `);
            console.log('Sample parcels:');
            sample.rows.forEach(r => console.log(r));
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkPartialLocationData();
