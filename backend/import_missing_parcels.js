require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function importMissing() {
    try {
        console.log('Starting import of missing parcels...');

        // 1. Insert missing parcels
        const insertQuery = `
            INSERT INTO parcels (num_parcel, nicad, geometry, region_senegal, department_senegal, arrondissement_senegal, commune_senegal, village, status)
            SELECT 
                t.num_parcel, 
                t.nicad, 
                t.geometry,
                CASE 
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%BANDAFASSI%' THEN 'KEDOUGOU'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%FONGO%' THEN 'KEDOUGOU'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%KEDOUGOU%' THEN 'KEDOUGOU'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%BEMBOU%' THEN 'KEDOUGOU'
                    ELSE 'TAMBACOUNDA' 
                END,
                CASE 
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%BANDAFASSI%' THEN 'KEDOUGOU'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%FONGO%' THEN 'KEDOUGOU'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%KEDOUGOU%' THEN 'KEDOUGOU'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%BEMBOU%' THEN 'SARAYA'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%BALA%' THEN 'GOUDIRY'
                    WHEN UPPER(t.arrondissementsenegal) LIKE '%MOUDERY%' THEN 'BAKEL'
                    ELSE 'TAMBACOUNDA'
                END,
                UPPER(TRIM(t.arrondissementsenegal)),
                UPPER(TRIM(t.communesenegal)),
                t.village,
                'Enquête'
            FROM parcels_nicad_temp t
            WHERE t.num_parcel NOT IN (SELECT num_parcel FROM parcels)
            AND t.num_parcel IS NOT NULL;
        `;

        const insertRes = await pool.query(insertQuery);
        console.log(`✅ Inserted ${insertRes.rowCount} new parcels.`);

        // 2. Update existing parcels with missing NICAD
        const updateQuery = `
            UPDATE parcels p
            SET nicad = t.nicad
            FROM parcels_nicad_temp t
            WHERE p.num_parcel = t.num_parcel
            AND p.nicad IS NULL
            AND t.nicad IS NOT NULL;
        `;

        const updateRes = await pool.query(updateQuery);
        console.log(`✅ Updated NICAD for ${updateRes.rowCount} existing parcels.`);

        // 3. Drop temp table
        await pool.query('DROP TABLE parcels_nicad_temp');
        console.log('✅ Dropped temporary table.');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        pool.end();
    }
}

importMissing();
