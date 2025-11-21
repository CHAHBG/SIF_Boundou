require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function migrate() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        console.log('Adding numero_deliberation column...');
        await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS numero_deliberation TEXT;
    `);

        console.log('Adding numero_approbation column...');
        await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS numero_approbation TEXT;
    `);

        await client.query('COMMIT');
        console.log('Migration completed successfully.');
    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
