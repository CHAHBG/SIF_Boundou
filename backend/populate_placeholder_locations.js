require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function populatePlaceholderLocationData() {
    try {
        console.log('Populating placeholder location data for parcels...');
        console.log('NOTE: This is temporary data. You should import real location data from your Excel file.\n');

        // Update parcels with placeholder location data
        // Using Tambacounda region as default since this is Boundou Geoportail
        const result = await pool.query(`
            UPDATE parcels
            SET 
                region_senegal = 'Tambacounda',
                department_senegal = 'Tambacounda',
                arrondissement_senegal = 'Koussanar',
                commune_senegal = 'Boundou',
                village = 'Village ' || SUBSTRING(num_parcel, 1, 4)
            WHERE region_senegal IS NULL;
        `);

        console.log(`Updated ${result.rowCount} parcels with placeholder location data.`);
        console.log('\nPlaceholder values set:');
        console.log('  - Region: Tambacounda');
        console.log('  - Department: Tambacounda');
        console.log('  - Arrondissement: Koussanar');
        console.log('  - Commune: Boundou');
        console.log('  - Village: Village [first 4 digits of parcel number]');
        console.log('\n⚠️  IMPORTANT: Replace this data by importing your Excel file with real location information.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

populatePlaceholderLocationData();
