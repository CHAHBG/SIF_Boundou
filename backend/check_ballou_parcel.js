require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkSpecificParcel() {
    try {
        console.log('Searching for parcel with Commune=BALLOU and Village=aroundou...');

        const res = await pool.query(`
            SELECT num_parcel, region_senegal, department_senegal, arrondissement_senegal, commune_senegal, village
            FROM parcels 
            WHERE commune_senegal ILIKE '%BALLOU%' 
            AND village ILIKE '%aroundou%'
        `);

        if (res.rows.length > 0) {
            console.log('Found parcels:');
            res.rows.forEach(r => {
                console.log('--------------------------------------------------');
                console.log(`Parcel: ${r.num_parcel}`);
                console.log(`Region: ${r.region_senegal}`);
                console.log(`Department: ${r.department_senegal}`);
                console.log(`Arrondissement: ${r.arrondissement_senegal}`);
                console.log(`Commune: ${r.commune_senegal}`);
                console.log(`Village: ${r.village}`);
            });
        } else {
            console.log('No matching parcels found.');
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkSpecificParcel();
