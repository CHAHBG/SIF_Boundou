
-- Geometry Update Script
-- Generated: 2025-11-21T23:46:25.231Z

-- Step 1: Create temporary table for new geometries
-- (Import GeoPackage data here using ogr2ogr or QGIS)

-- Step 2: Add centroid columns for matching
ALTER TABLE parcels_new_temp ADD COLUMN IF NOT EXISTS centroid geometry(Point, 4326);
UPDATE parcels_new_temp SET centroid = ST_Centroid(ST_Transform(geom, 4326));

-- Add centroid to existing parcels if not exists
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS centroid_cache geometry(Point, 4326);
UPDATE parcels SET centroid_cache = ST_Centroid(geometry);

-- Step 3: Create matching table using nearest neighbor
DROP TABLE IF EXISTS geometry_matches;
CREATE TABLE geometry_matches AS
WITH old_parcels AS (
  SELECT 
    id,
    num_parcel,
    geometry,
    centroid_cache as old_centroid
  FROM parcels
),
new_parcels AS (
  SELECT 
    ogc_fid,
    geom as new_geometry,
    centroid as new_centroid
  FROM parcels_new_temp
)
SELECT DISTINCT ON (op.id)
  op.id as parcel_id,
  op.num_parcel,
  np.ogc_fid as new_id,
  ST_Distance(op.old_centroid, np.new_centroid) as distance,
  np.new_geometry
FROM old_parcels op
CROSS JOIN LATERAL (
  SELECT ogc_fid, geom, centroid
  FROM parcels_new_temp
  ORDER BY centroid <-> op.old_centroid
  LIMIT 1
) np;

-- Step 4: Review matches (distances should be small)
SELECT 
  parcel_id,
  num_parcel,
  distance,
  CASE 
    WHEN distance < 0.0001 THEN 'Excellent match'
    WHEN distance < 0.001 THEN 'Good match'
    WHEN distance < 0.01 THEN 'Acceptable match'
    ELSE 'Review needed'
  END as match_quality
FROM geometry_matches
ORDER BY distance DESC
LIMIT 20;

-- Step 5: Backup original geometries
CREATE TABLE IF NOT EXISTS parcels_geometry_backup AS
SELECT id, num_parcel, geometry, NOW() as backup_date
FROM parcels;

-- Step 6: Update geometries (only for good matches)
UPDATE parcels p
SET geometry = ST_Transform(gm.new_geometry, ST_SRID(p.geometry))
FROM geometry_matches gm
WHERE p.id = gm.parcel_id
  AND gm.distance < 0.01; -- Only update if distance is reasonable

-- Step 7: Update centroid cache
UPDATE parcels SET centroid_cache = ST_Centroid(geometry);

-- Step 8: Get statistics
SELECT 
  COUNT(*) as total_parcels,
  COUNT(CASE WHEN distance < 0.0001 THEN 1 END) as excellent_matches,
  COUNT(CASE WHEN distance >= 0.0001 AND distance < 0.001 THEN 1 END) as good_matches,
  COUNT(CASE WHEN distance >= 0.001 AND distance < 0.01 THEN 1 END) as acceptable_matches,
  COUNT(CASE WHEN distance >= 0.01 THEN 1 END) as needs_review
FROM geometry_matches;

-- Cleanup
-- DROP TABLE parcels_new_temp;
-- DROP TABLE geometry_matches;
