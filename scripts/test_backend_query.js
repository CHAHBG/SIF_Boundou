const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function testParcel(id) {
    console.log(`\nTesting Parcel ID: ${id}`);
    const query = `
      SELECT
        p.id,
        p.num_parcel,
        p.status,
        ST_AsGeoJSON(p.geometry)::json AS geometry,
        json_build_object(
          'type', 'Point',
          'coordinates', json_build_array(
            ST_X(ST_Transform(ST_Centroid(p.geometry), 4326)),
            ST_Y(ST_Transform(ST_Centroid(p.geometry), 4326))
          )
        ) AS centroid,
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
        p.superficie AS superficie_parcelle,
        p.numero_deliberation AS n_deliberation,
        p.numero_approbation AS n_approbation,
        p.conflict,
        p.conflict_reason,
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN json_build_object(
            'prenom', i.prenom,
            'nom', i.nom,
            'telephone', i.telephone,
            'vocation', i.vocation
          )
          WHEN c.num_parcel IS NOT NULL THEN json_build_object(
            'nombre_affectata', c.nombre_affectata,
            'vocation', c.vocation
          )
          ELSE NULL
        END AS details
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE p.num_parcel = $1 OR p.id::text = $1
    `;

    try {
        const result = await pool.query(query, [id]);
        if (result.rows.length === 0) {
            console.log("Not found");
            return;
        }
        const row = result.rows[0];
        console.log("Row details:", row.details);

        // Simulating the spread that caused the error
        try {
            const properties = {
                id: row.id,
                ... (row.details || {})
            };
            console.log("✅ Spread successful");
        } catch (e) {
            console.error("❌ Spread FAILED:", e.message);
        }

    } catch (err) {
        console.error("Query Error:", err);
    }
}

async function run() {
    await testParcel('48748');
    await testParcel('5531');
    await testParcel('17241');
    await pool.end();
}

run();
