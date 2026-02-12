
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const compression = require('compression');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { initScheduler } = require('./scheduler');

const app = express();
const port = process.env.PORT || 4000;

app.disable('x-powered-by');

// Initialize Scheduler
initScheduler();

// --- Admin credentials from env ---
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD_RAW = process.env.ADMIN_PASSWORD || process.env.ADMIN_PASS || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || bcrypt.hashSync(ADMIN_PASSWORD_RAW, 10);
const JWT_SECRET = process.env.JWT_SECRET || 'default_jwt_secret_change_me';

const allowedOrigins = [
  process.env.CORS_ORIGINS || '',
  process.env.CORS_ORIGIN || ''
]
  .flatMap((value) => value.split(','))
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowNullOrigin = (process.env.CORS_ALLOW_NULL_ORIGIN || '').toLowerCase() === 'true';

function isOriginAllowed(origin) {
  if (allowedOrigins.length === 0) return true;
  if (allowedOrigins.includes('*')) return true;
  if (allowedOrigins.includes(origin)) return true;
  if (origin === 'null' && (allowNullOrigin || allowedOrigins.includes('null'))) return true;
  return false;
}

// CORS Configuration
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) { callback(null, true); return; }
    if (isOriginAllowed(origin)) { callback(null, true); return; }
    callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  credentials: true,
  optionsSuccessStatus: 200,
  maxAge: 86400
};

// Middleware
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
  ssl: { rejectUnauthorized: false },
  max: 20,
  min: 2,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  statement_timeout: 30000,
  query_timeout: 30000
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) console.error('Database connection error:', err);
  else console.log('Database connected successfully at:', res.rows[0].now);
});

// --- Column introspection cache ---
const tableColumnsCache = new Map();

async function getTableColumns(tableName) {
  if (tableColumnsCache.has(tableName)) return tableColumnsCache.get(tableName);
  const promise = pool
    .query('SELECT column_name FROM information_schema.columns WHERE table_name = $1', [tableName])
    .then((result) => new Set(result.rows.map((row) => row.column_name)))
    .catch((error) => { tableColumnsCache.delete(tableName); throw error; });
  tableColumnsCache.set(tableName, promise);
  return promise;
}

function selectColumnOrNull(columnSet, expression, alias, cast = 'text') {
  return columnSet.has(expression) ? `p.${expression} AS ${alias}` : `NULL::${cast} AS ${alias}`;
}

function getVillageSelect(columnSet) {
  if (columnSet.has('village')) return 'p.village AS village';
  if (columnSet.has('Village')) return 'p."Village" AS village';
  return 'NULL::text AS village';
}

// --- JWT Auth Middleware ---
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requis' });
  }
  try {
    const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
}

// ==========================================================
// AUTH ENDPOINTS
// ==========================================================
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Identifiants requis' });
  if (username !== ADMIN_USERNAME || !bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '8h' });
  res.json({ token, username, role: 'admin', expiresIn: '8h' });
});

app.get('/api/auth/verify', authMiddleware, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// ==========================================================
// STATS ENDPOINT
// ==========================================================
app.get('/api/stats', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) AS total,
        COUNT(*) FILTER (WHERE status = 'Survey') AS survey,
        COUNT(*) FILTER (WHERE status = 'NICAD') AS nicad,
        COUNT(*) FILTER (WHERE status = 'deliberee') AS deliberee,
        COUNT(*) FILTER (WHERE status = 'approuvee' OR status = 'Approved') AS approuvee,
        COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM individual_surveys i WHERE i.num_parcel = parcels.num_parcel)) AS individual,
        COUNT(*) FILTER (WHERE EXISTS(SELECT 1 FROM collective_surveys c WHERE c.num_parcel = parcels.num_parcel)) AS collective
      FROM parcels
    `);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ error: 'Stats failed' });
  }
});

// ==========================================================
// VECTOR TILES (MVT)
// ==========================================================
app.get('/api/tiles/:z/:x/:y', async (req, res) => {
  const { z, x, y } = req.params;
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    res.setHeader('Content-Type', 'application/x-protobuf');

    const simplification = z < 10 ? 100 : z < 12 ? 50 : z < 14 ? 20 : z < 16 ? 10 : 0;

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
            bounds.geom, 4096, 256, true
          ) AS geom
        FROM parcels p
        CROSS JOIN bounds
        WHERE p.geometry && ST_Transform(bounds.geom, 32628)
      )
      SELECT ST_AsMVT(mvtgeom.*, 'parcels', 4096, 'geom') AS mvt FROM mvtgeom;
    `;

    const result = await pool.query(query, [z, x, y]);
    const mvt = result.rows[0]?.mvt;
    if (!mvt || mvt.length === 0) { res.send(Buffer.alloc(0)); return; }
    res.send(mvt);
  } catch (err) {
    console.error('Error generating MVT:', err);
    res.setHeader('Content-Type', 'application/x-protobuf');
    res.send(Buffer.alloc(0));
  }
});

// ==========================================================
// SEARCH
// ==========================================================
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  if (!q || q.length < 2) return res.json([]);
  try {
    const query = `
      SELECT 
        p.id, p.num_parcel, p.nicad, p.status,
        COALESCE(i.prenom || ' ' || i.nom, 'Groupement', 'Inconnu') as owner_name
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE p.num_parcel ILIKE $1 OR p.nicad ILIKE $1 OR i.nom ILIKE $1
      LIMIT 10
    `;
    const result = await pool.query(query, [`%${q}%`]);
    res.json(result.rows);
  } catch (err) {
    console.error('Search error:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ==========================================================
// PARCEL DETAIL
// ==========================================================
app.get('/api/parcels/:id', async (req, res) => {
  const { id } = req.params;
  if (!id || String(id).length > 128) return res.status(400).json({ error: 'Invalid parcel identifier' });

  try {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'application/json');

    const parcelColumns = await getTableColumns('parcels');

    const query = `
      SELECT
        p.id, p.num_parcel, p.status,
        CASE WHEN p.geometry IS NOT NULL THEN ST_AsGeoJSON(ST_Transform(p.geometry, 4326))::json ELSE NULL END AS geometry,
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
        COALESCE(i.num_decise, c.num_decise) AS num_decise_survey,
        COALESCE(i.vocation, c.vocation) AS vocation,
        COALESCE(i.sup_reelle, c.sup_reelle) AS superficie,
        p.superficie AS superficie_parcelle,
        ${selectColumnOrNull(parcelColumns, 'numero_deliberation', 'n_deliberation')},
        ${selectColumnOrNull(parcelColumns, 'numero_approbation', 'n_approbation')},
        ${selectColumnOrNull(parcelColumns, 'conflict', 'conflict')},
        ${selectColumnOrNull(parcelColumns, 'conflict_reason', 'conflict_reason')},
        CASE 
          WHEN i.num_parcel IS NOT NULL THEN json_build_object(
            'prenom', i.prenom, 'nom', i.nom, 'telephone', i.telephone,
            'sexe', i.sexe, 'date_naiss', i.date_naiss, 'num_piece', i.num_piece,
            'lieu_naiss', i.lieu_naiss, 'photo_rec_url', i.photo_rec_url,
            'photo_ver_url', i.photo_ver_url, 'vocation', i.vocation,
            'superficie_declaree', i.sup_declar, 'superficie_reelle', i.sup_reelle,
            'type_usag', i.type_usag, 'syst_cultu', i.syst_cultu
          )
          WHEN c.num_parcel IS NOT NULL THEN json_build_object(
            'nombre_affectata', c.nombre_affectata, 'vocation', c.vocation,
            'superficie_declaree', c.sup_declar, 'superficie_reelle', c.sup_reelle,
            'type_usag', c.type_usag, 'nom_groupement', 'Groupement',
            'mandataries', COALESCE((
              SELECT json_agg(to_jsonb(m) - 'id' - 'collective_survey_id' - 'created_at')
              FROM mandataries m WHERE m.num_parcel = p.num_parcel
            ), '[]'::json),
            'beneficiaries', COALESCE((
              SELECT json_agg(to_jsonb(b) - 'id' - 'collective_survey_id' - 'created_at')
              FROM beneficiaries b WHERE b.num_parcel = p.num_parcel
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
    if (result.rows.length === 0) return res.status(404).json({ error: 'Parcel not found' });

    const row = result.rows[0];
    const fallbackRegion = process.env.DEFAULT_REGION || 'Tambacounda';
    const fallbackDepartment = process.env.DEFAULT_DEPARTMENT || 'Tambacounda';
    const fallbackArrondissement = process.env.DEFAULT_ARRONDISSEMENT || 'Koussanar';
    const fallbackCommune = process.env.DEFAULT_COMMUNE || 'Boundou';
    const fallbackValue = 'Non renseigné';

    const feature = {
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        id: row.id,
        num_parcel: row.num_parcel,
        status: row.status,
        type: row.type,
        nicad: row.nicad,
        region: row.region_senegal || fallbackRegion,
        department: row.department_senegal || fallbackDepartment,
        arrondissement: row.arrondissement_senegal || fallbackArrondissement,
        commune: row.commune_senegal || fallbackCommune,
        village: row.village || fallbackValue,
        vocation: row.vocation || (row.details && row.details.vocation) || '',
        superficie_reelle: (row.details && row.details.superficie_reelle) || row.superficie || row.superficie_parcelle || '',
        surface: row.superficie || row.superficie_parcelle || (row.details && row.details.superficie_reelle) || '',
        centroid: row.centroid,
        n_deliberation: row.n_deliberation || row.num_decise_survey || fallbackValue,
        n_approbation: row.n_approbation || row.num_decise_survey || fallbackValue,
        conflict: row.conflict,
        conflict_reason: row.conflict_reason,
        ...(row.details || {})
      }
    };

    res.json(feature);
  } catch (err) {
    console.error('Error fetching parcel details:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// ==========================================================
// GEOMETRY UPDATE (Admin only)
// ==========================================================
app.put('/api/parcels/:id/geometry', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { geometry } = req.body;

  if (!geometry || !geometry.type || !geometry.coordinates) {
    return res.status(400).json({ error: 'GeoJSON geometry requise' });
  }

  try {
    const geojsonStr = JSON.stringify(geometry);
    const result = await pool.query(
      `UPDATE parcels 
       SET geometry = ST_Transform(ST_SetSRID(ST_GeomFromGeoJSON($2), 4326), 32628)
       WHERE id = $1
       RETURNING id, num_parcel,
         ST_AsGeoJSON(ST_Transform(geometry, 4326))::json AS geometry,
         json_build_object(
           'type', 'Point',
           'coordinates', json_build_array(
             ST_X(ST_Transform(ST_Centroid(geometry), 4326)),
             ST_Y(ST_Transform(ST_Centroid(geometry), 4326))
           )
         ) AS centroid`,
      [parseInt(id, 10), geojsonStr]
    );

    if (result.rows.length === 0) return res.status(404).json({ error: 'Parcelle introuvable' });

    // Clear tile cache by incrementing version
    tableColumnsCache.delete('parcels');

    res.json({
      success: true,
      message: 'Géométrie mise à jour avec succès',
      parcel: result.rows[0]
    });
  } catch (err) {
    console.error('Geometry update error:', err);
    res.status(500).json({ error: 'Erreur lors de la mise à jour de la géométrie' });
  }
});

// ==========================================================
// EXPORT PARCELS (GeoJSON)
// ==========================================================
app.get('/api/export', async (req, res) => {
  const { format, status, type } = req.query;

  try {
    let whereConditions = [];
    let params = [];
    let paramIdx = 1;

    if (status) {
      const statuses = status.split(',');
      whereConditions.push(`p.status IN (${statuses.map(s => `$${paramIdx++}`).join(',')})`);
      params.push(...statuses);
    }

    if (type) {
      if (type === 'individual') {
        whereConditions.push('i.num_parcel IS NOT NULL');
      } else if (type === 'collective') {
        whereConditions.push('c.num_parcel IS NOT NULL');
      }
    }

    const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';

    const query = `
      SELECT 
        p.id, p.num_parcel, p.nicad, p.status, p.type, p.type_usag,
        p.superficie,
        ST_AsGeoJSON(ST_Transform(p.geometry, 4326))::json AS geometry,
        COALESCE(i.prenom || ' ' || i.nom, 'Groupement') AS owner_name,
        CASE WHEN i.num_parcel IS NOT NULL THEN 'individual'
             WHEN c.num_parcel IS NOT NULL THEN 'collective'
             ELSE 'unknown' END AS parcel_type
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      ${whereClause}
      ORDER BY p.id
    `;

    const result = await pool.query(query, params);

    // Build GeoJSON FeatureCollection
    const geojson = {
      type: 'FeatureCollection',
      name: `parcels_export_${status || 'all'}`,
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' } },
      features: result.rows.map(row => ({
        type: 'Feature',
        geometry: row.geometry,
        properties: {
          id: row.id,
          num_parcel: row.num_parcel,
          nicad: row.nicad,
          status: row.status,
          type: row.parcel_type,
          type_usag: row.type_usag,
          superficie: row.superficie,
          owner_name: row.owner_name
        }
      }))
    };

    const filename = `parcels_${status || 'all'}_${new Date().toISOString().split('T')[0]}`;

    if (format === 'gpkg') {
      // For GPKG we return GeoJSON with a note — true GPKG requires ogr2ogr
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.geojson"`);
      res.json(geojson);
    } else {
      // Default: GeoJSON
      res.setHeader('Content-Type', 'application/geo+json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.geojson"`);
      res.json(geojson);
    }
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Export failed' });
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
    res.status(500).json({ error: 'Internal server error' });
  }
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

module.exports = app;

