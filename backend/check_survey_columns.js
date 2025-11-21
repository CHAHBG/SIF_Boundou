
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkColumns() {
    try {
        const tables = ['individual_surveys'];

        for (const table of tables) {
            const res = await pool.query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY column_name;
      `, [table]);

            console.log(`\nColumns in ${table}:`);
            res.rows.forEach(r => console.log(`- ${r.column_name} (${r.data_type})`));
        }

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkColumns();
