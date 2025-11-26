require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debugParcel() {
    try {
        console.log('Testing parcel ID: 28556');

        // First, check if parcel exists
        const checkQuery = 'SELECT id, num_parcel FROM parcels WHERE id = 28556 OR num_parcel = $1';
        const checkResult = await pool.query(checkQuery, ['28556']);
        console.log('\n1. Parcel exists check:', checkResult.rows);

        if (checkResult.rows.length === 0) {
            console.log('ERROR: Parcel not found!');
            pool.end();
            return;
        }

        const parcel = checkResult.rows[0];
        console.log('\n2. Found parcel:', parcel);

        // Test the full query from the endpoint
        const fullQuery = `
      SELECT
        p.id,
        p.num_parcel,
        p.status,
        ST_AsGeoJSON(p.geometry)::json AS geometry,
        json_build_array(
          ST_X(ST_Centroid(p.geometry)),
          ST_Y(ST_Centroid(p.geometry))
        ) AS centroid_coords,
        p.region_senegal,
        p.department_senegal,
        p.arrondissement_senegal,
        p.commune_senegal,
        p.village,
        p.nicad,
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN 'individual'
          WHEN c.num_parcel IS NOT NULL THEN 'collective'
          ELSE 'unknown'
        END AS type,
        COALESCE(i.vocation, c.vocation) AS vocation,
        COALESCE(i.sup_reelle, c.sup_reelle) AS superficie,
        p.numero_deliberation AS n_deliberation,
        p.numero_approbation AS n_approbation,
        p.conflict,
        p.conflict_reason
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE p.num_parcel = $1 OR p.id::text = $1
    `;

        console.log('\n3. Testing simplified query...');
        const result = await pool.query(fullQuery, ['28556']);
        console.log('Success! Row count:', result.rows.length);
        console.log('Data:', JSON.stringify(result.rows[0], null, 2));

    } catch (err) {
        console.error('\nERROR:', err.message);
        console.error('Full error:', err);
    } finally {
        pool.end();
    }
}

debugParcel();
