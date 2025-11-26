require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function debugFullQuery() {
    try {
        console.log('Testing FULL query for parcel ID: 28556');

        // This is the exact query from index.js
        const query = `
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
        p.conflict_reason,
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN json_build_object(
            'prenom', i.prenom,
            'nom', i.nom,
            'telephone', i.telephone,
            'telephon2', i.telephon2,
            'sexe', i.sexe,
            'date_naiss', i.date_naiss,
            'num_piece', i.num_piece,
            'lieu_naiss', i.lieu_naiss,
            'photo_rec_url', i.photo_rec_url,
            'photo_ver_url', i.photo_ver_url,
            'vocation', i.vocation,
            'superficie_declaree', i.sup_declar,
            'superficie_reelle', i.sup_reelle,
            'type_usag', i.type_usag,
            'syst_cultu', i.syst_cultu
          )
          WHEN c.num_parcel IS NOT NULL THEN json_build_object(
            'nombre_affectata', c.nombre_affectata,
            'vocation', c.vocation,
            'superficie_declaree', c.sup_declar,
            'superficie_reelle', c.sup_reelle,
            'type_usag', c.type_usag,
            'nom_groupement', 'Groupement',
            'telephon2', c.telephon2,
            'mandataries', COALESCE((
              SELECT json_agg(json_build_object(
                'prenom', m.prenom,
                'nom', m.nom,
                'sexe', m.sexe,
                'telephone', m.contact,
                'telephon2', m.telephon2,
                'typ_per', m.typ_per,
                'date_naiss', m.date_naiss,
                'lieu_naiss', m.lieu_naiss,
                'num_piece', m.num_piece,
                'date_deliv', m.date_deliv,
                'photo_rec_url', m.photo_rec_url,
                'photo_ver_url', m.photo_ver_url,
                'situ_mat', m.situ_mat,
                'nbr_epse', m.nbr_epse,
                'chef_fam', m.chef_fam,
                'chef_mena', m.chef_mena,
                'nat_001', m.nat_001
              ))
              FROM mandataries m
              WHERE m.num_parcel = p.num_parcel
            ), '[]'::json),
            'beneficiaries', COALESCE((
              SELECT json_agg(json_build_object(
                'prenom', b.prenom,
                'nom', b.nom,
                'sexe', b.sexe,
                'date_naiss', b.date_naiss,
                'type_piece', b.type_piece,
                'num_piece', b.num_piece,
                'telephon2', b.telephon2,
                'photo_rec_url', b.photo_rec_url,
                'photo_ver_url', b.photo_ver_url,
                'signature', b.signature
              ))
              FROM beneficiaries b
              WHERE b.num_parcel = p.num_parcel
            ), '[]'::json)
          )
          ELSE NULL
        END AS details
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE p.num_parcel = $1 OR p.id::text = $1
    `;

        console.log('Executing query...\n');
        const result = await pool.query(query, ['28556']);

        console.log('✓ SUCCESS! Row count:', result.rows.length);
        console.log('\nParcel data:');
        console.log(JSON.stringify(result.rows[0], null, 2));

    } catch (err) {
        console.error('\n✗ ERROR:', err.message);
        console.error('\nFull error details:');
        console.error(err);
    } finally {
        pool.end();
    }
}

debugFullQuery();
