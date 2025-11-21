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
            ORDER BY ordinal_position
        `);
        console.log('ALL columns in parcels table:');
        res.rows.forEach(r => console.log(' -', r.column_name));
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

checkColumns();
