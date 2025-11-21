require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkLocationColumns() {
    try {
        console.log('Checking location columns in survey tables...\n');

        // Check individual_surveys
        const indivCols = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'individual_surveys'
            AND (column_name LIKE '%region%' 
                OR column_name LIKE '%department%' 
                OR column_name LIKE '%arrondissement%' 
                OR column_name LIKE '%commune%' 
                OR column_name LIKE '%village%'
                OR column_name LIKE '%grappe%')
            ORDER BY ordinal_position
        `);

        console.log('Individual Surveys location columns:');
        indivCols.rows.forEach(r => console.log('  -', r.column_name));

        // Check collective_surveys
        const collCols = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'collective_surveys'
            AND (column_name LIKE '%region%' 
                OR column_name LIKE '%department%' 
                OR column_name LIKE '%arrondissement%' 
                OR column_name LIKE '%commune%' 
                OR column_name LIKE '%village%'
                OR column_name LIKE '%grappe%')
            ORDER BY ordinal_position
        `);

        console.log('\nCollective Surveys location columns:');
        collCols.rows.forEach(r => console.log('  -', r.column_name));

        // Sample data from individual_surveys
        console.log('\n--- Sample location data from individual_surveys ---');
        const sampleIndiv = await pool.query(`
            SELECT num_parcel, grappe_senegal, region_senegal, department_senegal, 
                   arrondissement_senegal, commune_senegal, village
            FROM individual_surveys 
            WHERE grappe_senegal IS NOT NULL OR region_senegal IS NOT NULL
            LIMIT 3
        `);
        console.log('Found', sampleIndiv.rows.length, 'rows with location data');
        sampleIndiv.rows.forEach(r => {
            console.log(`  Parcel ${r.num_parcel}:`);
            console.log(`    Region: ${r.region_senegal || 'null'}`);
            console.log(`    Department: ${r.department_senegal || 'null'}`);
            console.log(`    Commune: ${r.commune_senegal || 'null'}`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkLocationColumns();
