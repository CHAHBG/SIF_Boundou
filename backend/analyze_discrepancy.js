require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function analyzeDiscrepancy() {
    try {
        // 1. Check ref count
        const refCount = await pool.query('SELECT COUNT(*) FROM parcels_nicad_ref');
        console.log(`Reference table count: ${refCount.rows[0].count}`);

        // 2. Check parcels count
        const parcelCount = await pool.query('SELECT COUNT(*) FROM parcels WHERE nicad IS NOT NULL');
        console.log(`Parcels with NICAD count: ${parcelCount.rows[0].count}`);

        // 3. Check for parcels NOT in ref (extra in parcels)
        const extraInParcels = await pool.query(`
            SELECT p.id, p.num_parcel, p.nicad
            FROM parcels p
            LEFT JOIN parcels_nicad_ref r 
            ON p.num_parcel IS NOT DISTINCT FROM r.num_parcel 
            AND p.nicad IS NOT DISTINCT FROM r.nicad
            WHERE p.nicad IS NOT NULL
            AND r.fid IS NULL
        `);
        console.log(`Parcels with NICAD NOT in reference: ${extraInParcels.rowCount}`);
        if (extraInParcels.rowCount > 0) {
            console.log('Sample:', extraInParcels.rows.slice(0, 5));
        }

        // 4. Check for duplicates in ref by (num_parcel, nicad)
        const refDups = await pool.query(`
            SELECT num_parcel, nicad, COUNT(*) as cnt
            FROM parcels_nicad_ref
            GROUP BY num_parcel, nicad
            HAVING COUNT(*) > 1
        `);
        console.log(`Duplicate (num_parcel, nicad) pairs in ref: ${refDups.rowCount}`);

        // 5. Check unique (num_parcel, nicad) count in ref
        const uniqueRef = await pool.query(`
            SELECT COUNT(DISTINCT (num_parcel, nicad)) FROM parcels_nicad_ref
        `);
        console.log(`Unique (num_parcel, nicad) in ref: ${uniqueRef.rows[0].count}`);

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

analyzeDiscrepancy();
