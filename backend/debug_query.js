require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

const id = '23435'; // The ID that caused the error

const query = `
      SELECT
        p.id,
        p.num_parcel,
        p.status,
        ST_AsGeoJSON(p.geometry)::json AS geometry,
        ST_AsGeoJSON(ST_Centroid(p.geometry))::json AS centroid,
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
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN json_build_object(
            'prenom', i.prenom,
            'nom', i.nom,
            'telephone', i.telephone,
            'sexe', i.sexe,
            'date_naiss', i.date_naiss,
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
            'type_usag', c.type_usag,
            'nom_groupement', 'Groupement',
            'mandataries', (
                SELECT json_agg(json_build_object(
                    'prenom', m.prenom,
                    'nom', m.nom,
                    'telephone', m.telephone,
                    'fonction', m.fonction,
                    'sexe', m.sexe,
                    'date_naiss', m.date_naiss,
                    'cni', m.cni,
                    'date_deliv', m.date_deliv
                ))
                FROM mandataries m
                WHERE m.id_parcel = p.id
            ),
            'beneficiaries', (
                SELECT json_agg(json_build_object(
                    'prenom', b.prenom,
                    'nom', b.nom,
                    'telephone', b.telephone,
                    'sexe', b.sexe,
                    'date_naiss', b.date_naiss,
                    'cni', b.cni,
                    'fonction', b.fonction
                ))
                FROM beneficiaries b
                WHERE b.id_parcel = p.id
            )
          )
          ELSE NULL
        END AS details
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE p.num_parcel = $1 OR p.id::text = $1
    `;

pool.query(query, [id])
  .then(res => {
    console.log('Success:', res.rows[0]);
    pool.end();
  })
  .catch(err => {
    console.error('Error executing query:', err);
    pool.end();
  });
