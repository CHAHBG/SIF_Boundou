
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkColumns() {
    try {
        const tables = ['collective_surveys', 'mandataries', 'beneficiaries'];
        for (const table of tables) {
            const res = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1;
      `, [table]);
            console.log(`Columns in ${table}:`, res.rows.map(r => r.column_name).join(', '));
        }
    } catch (err) {
        console.error('Error checking columns:', err);
    } finally {
        pool.end();
    }
}

checkColumns();
