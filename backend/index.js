
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const compression = require('compression');

const app = express();
const port = process.env.PORT || 4000;

// CORS Configuration - Permissive for debugging
const corsOptions = {
  origin: '*', // Allow all origins for now
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false, // Set to false when using origin: '*'
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(compression()); // Enable gzip compression
app.use(express.json());

// PostgreSQL connection pool with optimized settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
  ssl: {
    rejectUnauthorized: false
  },
  // Connection pool optimization
  max: 20, // Maximum pool size
  min: 2, // Minimum pool size
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Connection timeout: 10 seconds
  // Performance tuning
  statement_timeout: 30000, // Query timeout: 30 seconds
  query_timeout: 30000
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('Database connected successfully at:', res.rows[0].now);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ---------------------------------------------------------
// 1. VECTOR TILES ENDPOINT (MVT) - High Performance Map
// ---------------------------------------------------------
app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  const { z, x, y } = req.params;

  try {
    // Explicitly set CORS headers for tile endpoint (backup to global CORS)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    
    // Add cache headers for faster tile loading
    res.setHeader('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400'); // Cache for 1 hour, serve stale for 24h
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.setHeader('Access-Control-Max-Age', '86400'); // CORS preflight cache

    // Optimized query with spatial indexing and simplification at lower zoom levels
    const simplification = z < 14 ? 10 : z < 16 ? 5 : 0; // Simplify geometries at lower zoom
    
    const query = `
      WITH bounds AS (
        SELECT ST_TileEnvelope($1::integer, $2::integer, $3::integer) AS geom
      ),
      mvtgeom AS (
        SELECT 
          p.id,
          p.num_parcel,
          p.status,
          COALESCE(i.type_usag, c.type_usag, 'Inconnu') AS type_usag,
          CASE 
            WHEN i.num_parcel IS NOT NULL THEN 'individual'
            WHEN c.num_parcel IS NOT NULL THEN 'collective'
            ELSE 'unknown'
          END AS type,
          ST_AsMVTGeom(
            ${simplification > 0 
              ? `ST_Simplify(ST_Transform(p.geometry, 3857), ${simplification})`
              : 'ST_Transform(p.geometry, 3857)'
            },
            bounds.geom,
            4096,
            64,
            true
          ) AS geom
        FROM parcels p
        LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
        LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
        CROSS JOIN bounds
        WHERE ST_Intersects(ST_Transform(p.geometry, 3857), bounds.geom)
          AND ST_Transform(p.geometry, 3857) && bounds.geom
      )
      SELECT ST_AsMVT(mvtgeom.*, 'parcels', 4096, 'geom') AS mvt FROM mvtgeom;
    `;

    const result = await pool.query(query, [z, x, y]);
    const mvt = result.rows[0]?.mvt;

    // Always return binary response, even if empty
    if (!mvt || mvt.length === 0) {
      // Return empty MVT tile instead of 204
      res.send(Buffer.alloc(0));
      return;
    }

    res.send(mvt);

  } catch (err) {
    console.error('Error generating MVT:', err);
    console.error('Tile params:', { z, x, y });
    // Return empty tile on error instead of JSON error
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.send(Buffer.alloc(0));
  }
});

// ---------------------------------------------------------
// 2. SEARCH ENDPOINT - Optimized for Autocomplete
// ---------------------------------------------------------
app.get('/api/search', async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.json([]);
  }

  try {
    const query = `
      SELECT 
        p.id, 
        p.num_parcel, 
        p.nicad, 
        p.status,
        COALESCE(i.prenom || ' ' || i.nom, 'Groupement', 'Inconnu') as owner_name
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE 
        p.num_parcel ILIKE $1 OR 
        p.nicad ILIKE $1 OR
        i.nom ILIKE $1
      LIMIT 10
    `;

    const result = await pool.query(query, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ---------------------------------------------------------
// 3. PARCEL DETAIL ENDPOINT - Fetch single parcel by ID/Num
// ---------------------------------------------------------
app.get('/api/parcels/:id', async (req, res) => {
  const { id } = req.params;

  try {
    // Add cache headers for faster repeated access
    res.setHeader('Cache-Control', 'public, max-age=300'); // Cache for 5 minutes
    res.setHeader('Content-Type', 'application/json');

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
        p.numero_deliberation AS n_deliberation,
        p.numero_approbation AS n_approbation,
        p.conflict,
        p.conflict_reason,
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
                    'sexe', m.sexe,
                    'telephone', m.contact,
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
            ),
            'beneficiaries', (
                SELECT json_agg(json_build_object(
                    'prenom', b.prenom,
                    'nom', b.nom,
                    'sexe', b.sexe,
                    'date_naiss', b.date_naiss,
                    'type_piece', b.type_piece,
                    'num_piece', b.num_piece,
                    'photo_rec_url', b.photo_rec_url,
                    'photo_ver_url', b.photo_ver_url,
                    'signature', b.signature
                ))
                FROM beneficiaries b
                WHERE b.num_parcel = p.num_parcel
            )
          )
          ELSE NULL
        END AS details
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE p.num_parcel = $1 OR p.id::text = $1
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Parcel not found' });
    }

    const row = result.rows[0];

    // Construct GeoJSON Feature
    const feature = {
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        num_parcel: row.num_parcel,
        status: row.status,
        type: row.type,
        nicad: row.nicad,
        region: row.region_senegal,
        department: row.department_senegal,
        arrondissement: row.arrondissement_senegal,
        commune: row.commune_senegal,
        village: row.village,
        vocation: row.vocation,
        surface: row.superficie,
        centroid: row.centroid,
        n_deliberation: row.n_deliberation,
        n_approbation: row.n_approbation,
        conflict: row.conflict,
        conflict_reason: row.conflict_reason,
        ...row.details // Spread specific details
      }
    };

    res.json(feature);

  } catch (err) {
    console.error('Error fetching parcel details:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Get unique filter options
app.get('/api/filters', async (req, res) => {
  try {
    res.json({
      types: ['individual', 'collective', 'unknown'],
      vocations: [],
    });
  } catch (err) {
    console.error('Error fetching filters:', err);
    res.status(500).json({ error: 'Internal server error', details: err.message });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;
