
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function checkColumns() {
    try {
        const tables = ['parcelles_individuelles', 'parcelles_collectives'];
        for (const table of tables) {
            const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = '${table}' 
        AND column_name IN ('type_usag', 'type_usa', 'vocation');
      `);
            console.log(`Found columns in ${table}:`, res.rows.map(r => r.column_name));
        }
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkColumns();
