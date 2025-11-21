require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function analyzeGeometry() {
    const client = await pool.connect();
    try {
        console.log('Analyzing overlaps...');
        // Find pairs of parcels that overlap significantly
        // We ignore very small overlaps (e.g. shared boundaries with slight precision errors)
        // Intersection area > 1 sqm
        const overlaps = await client.query(`
        SELECT 
            a.nicad as nicad_a, 
            b.nicad as nicad_b,
            ST_Area(ST_Intersection(a.geometry, b.geometry)::geography) as overlap_area
        FROM parcels a
        JOIN parcels b ON ST_Intersects(a.geometry, b.geometry) AND a.id < b.id
        WHERE ST_Overlaps(a.geometry, b.geometry)
        AND ST_Area(ST_Intersection(a.geometry, b.geometry)::geography) > 1
        ORDER BY overlap_area DESC
        LIMIT 20;
    `);

        console.log(`Found ${overlaps.rowCount} significant overlaps (top 20 shown):`);
        console.table(overlaps.rows);

        console.log('\nAnalyzing invalid geometries...');
        const invalid = await client.query(`
        SELECT nicad, ST_IsValidReason(geometry) as reason
        FROM parcels
        WHERE NOT ST_IsValid(geometry)
        LIMIT 20;
    `);

        if (invalid.rowCount > 0) {
            console.log(`Found ${invalid.rowCount} invalid geometries:`);
            console.table(invalid.rows);
        } else {
            console.log('No invalid geometries found.');
        }

        // Gaps are harder to detect automatically without a reference boundary or topology
        // But we can check for slivers (very small polygons) if they exist as separate parcels
        console.log('\nChecking for potential sliver parcels (area < 10 sqm)...');
        const slivers = await client.query(`
        SELECT nicad, ST_Area(geometry::geography) as area
        FROM parcels
        WHERE ST_Area(geometry::geography) < 10
        ORDER BY area ASC
        LIMIT 20;
    `);
        console.table(slivers.rows);

    } catch (e) {
        console.error('Analysis failed:', e);
    } finally {
        client.release();
        pool.end();
    }
}

analyzeGeometry();
