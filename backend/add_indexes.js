require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function addIndexes() {
    try {
        console.log('Adding indexes...');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_parcels_nicad ON parcels(nicad)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_ref_nicad ON parcels_nicad_ref(nicad)');
        await pool.query('CREATE INDEX IF NOT EXISTS idx_ref_num_parcel ON parcels_nicad_ref(num_parcel)');
        console.log('✅ Indexes added.');
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

addIndexes();
