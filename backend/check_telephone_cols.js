require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function checkColumns() {
    try {
        console.log('Checking telephone columns in individual_surveys:');
        const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'individual_surveys' 
      AND column_name LIKE '%teleph%'
      ORDER BY column_name
    `);

        result.rows.forEach(row => {
            console.log(`  - ${row.column_name} (${row.data_type})`);
        });

        console.log('\nChecking telephone columns in collective_surveys:');
        const result2 = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'collective_surveys' 
      AND column_name LIKE '%teleph%'
      ORDER BY column_name
    `);

        result2.rows.forEach(row => {
            console.log(`  - ${row.column_name} (${row.data_type})`);
        });

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkColumns();
