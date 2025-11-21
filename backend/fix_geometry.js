require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function fixGeometry() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Add conflict column if not exists
        console.log('Adding conflict column...');
        await client.query(`
      ALTER TABLE parcels 
      ADD COLUMN IF NOT EXISTS conflict BOOLEAN DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS conflict_reason TEXT;
    `);

        // 2. Fix invalid geometries
        console.log('Fixing invalid geometries...');
        const fixedInvalid = await client.query(`
        UPDATE parcels
        SET geometry = ST_MakeValid(geometry)
        WHERE NOT ST_IsValid(geometry)
        RETURNING nicad;
    `);
        console.log(`Fixed ${fixedInvalid.rowCount} invalid geometries.`);

        // 3. Remove tiny slivers (< 1 sqm)
        console.log('Removing tiny slivers (< 1 sqm)...');
        const deletedSlivers = await client.query(`
        DELETE FROM parcels
        WHERE ST_Area(geometry::geography) < 1
        RETURNING id;
    `);
        console.log(`Deleted ${deletedSlivers.rowCount} slivers.`);

        // 4. Handle overlaps
        console.log('Handling overlaps...');

        // 4a. Identify overlaps
        // We'll flag parcels involved in significant overlaps as conflicts
        // unless we can resolve them (e.g. one has NICAD, one doesn't)

        const overlaps = await client.query(`
        SELECT 
            a.id as id_a, a.nicad as nicad_a, a.status as status_a, ST_Area(a.geometry::geography) as area_a,
            b.id as id_b, b.nicad as nicad_b, b.status as status_b, ST_Area(b.geometry::geography) as area_b,
            ST_Area(ST_Intersection(a.geometry, b.geometry)::geography) as overlap_area
        FROM parcels a
        JOIN parcels b ON ST_Intersects(a.geometry, b.geometry) AND a.id < b.id
        WHERE ST_Overlaps(a.geometry, b.geometry)
        AND ST_Area(ST_Intersection(a.geometry, b.geometry)::geography) > 10
    `);

        console.log(`Found ${overlaps.rowCount} overlaps to process.`);

        let resolvedCount = 0;
        let flaggedCount = 0;

        for (const row of overlaps.rows) {
            const { id_a, nicad_a, area_a, id_b, nicad_b, area_b, overlap_area } = row;

            // Check if overlap is significant (e.g. > 10% of smaller parcel)
            const minArea = Math.min(area_a, area_b);
            if (overlap_area / minArea < 0.1) continue; // Skip minor overlaps

            // Strategy:
            // If one has NICAD and other doesn't -> Delete the one without NICAD (if it's mostly covered?)
            // Actually, deleting is risky. Let's just flag for now, or maybe delete if it's a "ghost" parcel.

            // Safe strategy: Flag both as conflict
            await client.query(`
            UPDATE parcels SET conflict = TRUE, conflict_reason = 'Overlap with ' || $2
            WHERE id = $1
        `, [id_a, nicad_b || id_b]);

            await client.query(`
            UPDATE parcels SET conflict = TRUE, conflict_reason = 'Overlap with ' || $2
            WHERE id = $1
        `, [id_b, nicad_a || id_a]);

            flaggedCount++;
        }

        console.log(`Flagged ${flaggedCount} pairs as conflicts.`);

        await client.query('COMMIT');
        console.log('Geometry fixes completed.');

    } catch (e) {
        await client.query('ROLLBACK');
        console.error('Fix failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

fixGeometry();
