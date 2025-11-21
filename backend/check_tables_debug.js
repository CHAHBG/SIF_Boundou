
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkTables() {
    try {
        const res = await pool.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        `);
        console.log('Tables in public schema:', res.rows.map(r => r.table_name));

        try {
            await pool.query('SELECT count(*) FROM mandataries');
            console.log('mandataries table exists and is accessible.');
        } catch (e) {
            console.error('mandataries table error:', e.message);
        }

        try {
            await pool.query('SELECT count(*) FROM beneficiaries');
            console.log('beneficiaries table exists and is accessible.');
        } catch (e) {
            console.error('beneficiaries table error:', e.message);
        }

    } catch (err) {
        console.error('Error:', err);
    } finally {
        pool.end();
    }
}

checkTables();
