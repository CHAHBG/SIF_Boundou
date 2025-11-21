require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function migrate() {
    try {
        console.log('Adding nicad column to parcels table...');

        await pool.query(`
            ALTER TABLE parcels 
            ADD COLUMN IF NOT EXISTS nicad VARCHAR(100);
        `);

        console.log('✅ nicad column added successfully');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

migrate();
