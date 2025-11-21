require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function updateStatus() {
    try {
        console.log('Updating status for NICAD parcels...');

        // Update status to 'NICAD' if nicad is present and status is not 'Approved' (assuming 'Approved' is higher)
        // For now, just update 'Enquête' or NULL to 'NICAD'
        const res = await pool.query(`
            UPDATE parcels
            SET status = 'NICAD'
            WHERE nicad IS NOT NULL 
            AND (status = 'Enquête' OR status IS NULL OR status = 'Survey');
        `);

        console.log(`✅ Updated status to 'NICAD' for ${res.rowCount} parcels.`);

        // Verify counts
        const counts = await pool.query(`
            SELECT status, COUNT(*) 
            FROM parcels 
            GROUP BY status
        `);
        console.log('Status Counts:', counts.rows);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

updateStatus();
