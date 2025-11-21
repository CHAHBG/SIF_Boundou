
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'parcels';
    `);
        console.log('Columns in parcels table:', res.rows);
    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        pool.end();
    }
}

checkColumns();
