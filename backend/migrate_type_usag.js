require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        console.log('Adding type_usag column to parcels table...');

        // Add type_usag column if it doesn't exist
        await pool.query(`
            ALTER TABLE parcels 
            ADD COLUMN IF NOT EXISTS type_usag VARCHAR(100)
        `);
        console.log('Column added or already exists.');

        // Update parcels with type_usag from individual_surveys
        console.log('Updating type_usag from individual_surveys...');
        const indResult = await pool.query(`
            UPDATE parcels p
            SET type_usag = i.type_usag
            FROM individual_surveys i
            WHERE p.num_parcel = i.num_parcel
            AND i.type_usag IS NOT NULL
        `);
        console.log(`Updated ${indResult.rowCount} rows from individual_surveys`);

        // Update parcels with type_usag from collective_surveys (where not already set)
        console.log('Updating type_usag from collective_surveys...');
        const collResult = await pool.query(`
            UPDATE parcels p
            SET type_usag = c.type_usag
            FROM collective_surveys c
            WHERE p.num_parcel = c.num_parcel
            AND c.type_usag IS NOT NULL
            AND p.type_usag IS NULL
        `);
        console.log(`Updated ${collResult.rowCount} rows from collective_surveys`);

        // Verify
        console.log('\n=== Verification ===');
        const verify = await pool.query(`
            SELECT type_usag, COUNT(*) as count 
            FROM parcels 
            WHERE type_usag IS NOT NULL 
            GROUP BY type_usag 
            ORDER BY count DESC
        `);
        verify.rows.forEach(row => console.log(`${row.type_usag}: ${row.count}`));

        console.log('\nMigration complete!');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
