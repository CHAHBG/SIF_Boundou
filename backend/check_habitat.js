require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    try {
        // Check all distinct status values
        console.log('=== Distinct status values in parcels ===');
        const statusResult = await pool.query(`
            SELECT status, COUNT(*) as count 
            FROM parcels 
            GROUP BY status 
            ORDER BY count DESC
        `);
        statusResult.rows.forEach(row => console.log(`${row.status || 'NULL'}: ${row.count}`));

        // Check habitat parcels with null/unknown status
        console.log('\n=== Habitat parcels by status ===');
        const habitatStatus = await pool.query(`
            SELECT p.status, COUNT(*) as count 
            FROM parcels p
            LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
            WHERE LOWER(i.type_usag) LIKE '%habitat%'
            GROUP BY p.status 
            ORDER BY count DESC
        `);
        habitatStatus.rows.forEach(row => console.log(`${row.status || 'NULL'}: ${row.count}`));

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await pool.end();
    }
}

main();
