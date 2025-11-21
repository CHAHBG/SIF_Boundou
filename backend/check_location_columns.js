require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkColumns() {
    try {
        const res = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'parcels' 
            AND (column_name LIKE '%region%' 
                OR column_name LIKE '%department%' 
                OR column_name LIKE '%arrondissement%' 
                OR column_name LIKE '%commune%' 
                OR column_name LIKE '%village%')
            ORDER BY ordinal_position
        `);
        console.log('Location columns in parcels table:');
        res.rows.forEach(r => console.log(' -', r.column_name));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkColumns();
