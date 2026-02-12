
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const compression = require('compression');
const { initScheduler } = require('./scheduler');

const app = express();
const port = process.env.PORT || 4000;

app.disable('x-powered-by');

// Initialize Scheduler
initScheduler();

const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: false,
  optionsSuccessStatus: 200,
  maxAge: 86400 // 24 hours
};

// Middleware
app.use(cors(corsOptions));
app.use(compression()); // Enable gzip compression
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

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

const tableColumnsCache = new Map();

async function getTableColumns(tableName) {
  if (tableColumnsCache.has(tableName)) {
    return tableColumnsCache.get(tableName);
  }

  const promise = pool
    .query(
      `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = $1
      `,
      [tableName]
    )
    .then((result) => new Set(result.rows.map((row) => row.column_name)))
    .catch((error) => {
      tableColumnsCache.delete(tableName);
      throw error;
    });

  tableColumnsCache.set(tableName, promise);
  return promise;
}

function selectColumnOrNull(columnSet, expression, alias, cast = 'text') {
  return columnSet.has(expression) ? `p.${expression} AS ${alias}` : `NULL::${cast} AS ${alias}`;
}

function getVillageSelect(columnSet) {
  if (columnSet.has('village')) {
    return 'p.village AS village';
  }
  if (columnSet.has('Village')) {
    return 'p."Village" AS village';
  }
  return 'NULL::text AS village';
}

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

    // Add aggressive cache headers for faster tile loading
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800'); // Cache for 24h, serve stale for 7d
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.setHeader('Access-Control-Max-Age', '86400'); // CORS preflight cache
    res.setHeader('Vary', 'Accept-Encoding');

    // Optimized query with spatial indexing and simplification at lower zoom levels
    const simplification = z < 10 ? 100 : z < 12 ? 50 : z < 14 ? 20 : z < 16 ? 10 : 0; // More aggressive simplification

    const query = `
      WITH bounds AS (
        SELECT ST_TileEnvelope($1::integer, $2::integer, $3::integer) AS geom
      ),
      mvtgeom AS (
        SELECT 
          p.id,
          p.num_parcel,
          p.status,
          p.type,
          p.type_usag,
          ST_AsMVTGeom(
            ${simplification > 0
        ? `ST_Simplify(ST_Transform(p.geometry, 3857), ${simplification})`
        : 'ST_Transform(p.geometry, 3857)'
      },
            bounds.geom,
            4096,
            256,
            true
          ) AS geom
        FROM parcels p
        CROSS JOIN bounds
        WHERE p.geometry && ST_Transform(bounds.geom, 32628)
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

  if (!id || String(id).length > 128) {
    return res.status(400).json({ error: 'Invalid parcel identifier' });
  }

  try {
    // Add cache headers for faster repeated access
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Vary', 'Accept-Encoding');

    const [parcelColumns] = await Promise.all([
      getTableColumns('parcels')
    ]);

    const query = `
      SELECT
        p.id,
        p.num_parcel,
        p.status,
        CASE WHEN p.geometry IS NOT NULL THEN ST_AsGeoJSON(p.geometry)::json ELSE NULL END AS geometry,
        CASE WHEN p.geometry IS NOT NULL THEN json_build_object(
          'type', 'Point',
          'coordinates', json_build_array(
            ST_X(ST_Transform(ST_Centroid(p.geometry), 4326)),
            ST_Y(ST_Transform(ST_Centroid(p.geometry), 4326))
          )
        ) ELSE NULL END AS centroid,
        ${selectColumnOrNull(parcelColumns, 'region_senegal', 'region_senegal')},
        ${selectColumnOrNull(parcelColumns, 'department_senegal', 'department_senegal')},
        ${selectColumnOrNull(parcelColumns, 'arrondissement_senegal', 'arrondissement_senegal')},
        ${selectColumnOrNull(parcelColumns, 'commune_senegal', 'commune_senegal')},
        ${getVillageSelect(parcelColumns)},
        p.nicad,
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN 'individual'
          WHEN c.num_parcel IS NOT NULL THEN 'collective'
          ELSE 'unknown'
        END AS type,
        COALESCE(i.vocation, c.vocation) AS vocation,
        COALESCE(i.sup_reelle, c.sup_reelle) AS superficie,
        p.superficie AS superficie_parcelle,
        ${selectColumnOrNull(parcelColumns, 'numero_deliberation', 'n_deliberation')},
        ${selectColumnOrNull(parcelColumns, 'numero_approbation', 'n_approbation')},
        ${selectColumnOrNull(parcelColumns, 'conflict', 'conflict')},
        ${selectColumnOrNull(parcelColumns, 'conflict_reason', 'conflict_reason')},
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN json_build_object(
            'prenom', i.prenom,
            'nom', i.nom,
            'telephone', i.telephone,
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
            'mandataries', COALESCE((
              SELECT json_agg(to_jsonb(m) - 'id' - 'collective_survey_id' - 'created_at')
              FROM mandataries m
              WHERE m.num_parcel = p.num_parcel
            ), '[]'::json),
            'beneficiaries', COALESCE((
              SELECT json_agg(to_jsonb(b) - 'id' - 'collective_survey_id' - 'created_at')
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
        // Always provide vocation and superficie fields at top level
        vocation: row.vocation || (row.details && row.details.vocation) || '',
        superficie_reelle: (row.details && row.details.superficie_reelle) || row.superficie || row.superficie_parcelle || '',
        surface: row.superficie || row.superficie_parcelle || (row.details && row.details.superficie_reelle) || '',
        centroid: row.centroid,
        n_deliberation: row.n_deliberation,
        n_approbation: row.n_approbation,
        conflict: row.conflict,
        conflict_reason: row.conflict_reason,
        ...(row.details || {}) // Spread specific details, handling null
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
