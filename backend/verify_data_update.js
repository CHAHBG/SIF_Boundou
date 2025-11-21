require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function verify() {
    const client = await pool.connect();
    try {
        console.log('Checking for deliberee parcels...');
        const deliberee = await client.query(`
        SELECT nicad, status, numero_deliberation, numero_approbation 
        FROM parcels WHERE status = 'deliberee' LIMIT 5
    `);
        console.table(deliberee.rows);

        console.log('\nChecking for approuvee parcels...');
        const approuvee = await client.query(`
        SELECT nicad, status, numero_deliberation, numero_approbation 
        FROM parcels WHERE status = 'approuvee' LIMIT 5
    `);
        console.table(approuvee.rows);

        console.log('\nChecking counts...');
        const counts = await client.query(`
        SELECT status, COUNT(*) 
        FROM parcels GROUP BY status
    `);
        console.table(counts.rows);

    } catch (e) {
        console.error('Verification failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

verify();
