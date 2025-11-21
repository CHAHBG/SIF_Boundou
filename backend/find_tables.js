
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function findTables() {
    try {
        const res = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      AND (
        table_name ILIKE '%indiv%' OR 
        table_name ILIKE '%collect%' OR 
        table_name ILIKE '%survey%' OR 
        table_name ILIKE '%parcelle%'
      )
      ORDER BY table_name;
    `);
        console.log('Matching Tables:', res.rows.map(r => r.table_name));
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

findTables();
