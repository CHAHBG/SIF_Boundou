
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'parcels' 
      AND column_name IN ('type_usag', 'type_usa', 'vocation');
    `);

        console.log('Found columns:', res.rows.map(r => r.column_name));
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkColumns();
