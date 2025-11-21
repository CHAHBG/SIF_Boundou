
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkMandataries() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'mandataries';
    `);
        console.log('Columns:', res.rows.map(r => r.column_name).join(', '));
    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkMandataries();
