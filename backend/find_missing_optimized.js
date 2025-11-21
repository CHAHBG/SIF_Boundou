require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function findMissingOptimized() {
    try {
        console.log('Finding missing parcel using optimized query...');

        const findQuery = `
            SELECT r.* 
            FROM parcels_nicad_ref r
            LEFT JOIN parcels p 
            ON p.num_parcel IS NOT DISTINCT FROM r.num_parcel 
            AND p.nicad IS NOT DISTINCT FROM r.nicad
            WHERE p.id IS NULL
        `;

        const res = await pool.query(findQuery);
        console.log(`Found ${res.rowCount} missing parcels.`);

        if (res.rowCount > 0) {
            const insertQuery = `
                INSERT INTO parcels (num_parcel, nicad, geometry, region_senegal, department_senegal, arrondissement_senegal, commune_senegal, village, status)
                SELECT 
                    r.num_parcel, 
                    r.nicad, 
                    r.geometry,
                    CASE 
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%BANDAFASSI%' THEN 'KEDOUGOU'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%FONGO%' THEN 'KEDOUGOU'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%KEDOUGOU%' THEN 'KEDOUGOU'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%BEMBOU%' THEN 'KEDOUGOU'
                        ELSE 'TAMBACOUNDA' 
                    END,
                    CASE 
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%BANDAFASSI%' THEN 'KEDOUGOU'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%FONGO%' THEN 'KEDOUGOU'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%KEDOUGOU%' THEN 'KEDOUGOU'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%BEMBOU%' THEN 'SARAYA'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%BALA%' THEN 'GOUDIRY'
                        WHEN UPPER(r.arrondissementsenegal) LIKE '%MOUDERY%' THEN 'BAKEL'
                        ELSE 'BAKEL'
                    END,
                    UPPER(TRIM(r.arrondissementsenegal)),
                    UPPER(TRIM(r.communesenegal)),
                    r.village,
                    'NICAD'
                FROM parcels_nicad_ref r
                WHERE r.fid = $1
            `;

            for (const row of res.rows) {
                await pool.query(insertQuery, [row.fid]);
                console.log(`Inserted missing parcel FID: ${row.fid}, Num: ${row.num_parcel}, Nicad: ${row.nicad}`);
            }
        }

        // Final Count
        const countRes = await pool.query('SELECT COUNT(*) FROM parcels WHERE nicad IS NOT NULL');
        const finalCount = parseInt(countRes.rows[0].count);
        console.log(`Final NICAD Count: ${finalCount}`);

        if (finalCount === 47544) {
            console.log('🎉 SUCCESS: Count matches GPKG exactly!');
        } else {
            console.error(`❌ Still mismatch: Got ${finalCount}, expected 47544`);
        }

        // Cleanup
        await pool.query('DROP TABLE parcels_nicad_ref');
        console.log('Dropped reference table.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

findMissingOptimized();
