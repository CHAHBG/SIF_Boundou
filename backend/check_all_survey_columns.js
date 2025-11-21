require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkColumns() {
    try {
        // Check all columns in individual_surveys
        const indivCols = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'individual_surveys'
            ORDER BY ordinal_position
        `);

        console.log('ALL columns in individual_surveys:');
        indivCols.rows.forEach(r => console.log('  -', r.column_name));

        // Sample one row to see what data exists
        console.log('\n--- Sample row from individual_surveys ---');
        const sample = await pool.query('SELECT * FROM individual_surveys LIMIT 1');
        if (sample.rows.length > 0) {
            const row = sample.rows[0];
            console.log('Columns with data:');
            Object.keys(row).forEach(key => {
                if (row[key] !== null) {
                    console.log(`  ${key}: ${row[key]}`);
                }
            });
        }

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkColumns();
