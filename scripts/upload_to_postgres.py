"""
Upload merged parcels to PostgreSQL/PostGIS database.
This will replace the existing parcels table with the clean merged data.
"""

import geopandas as gpd
from sqlalchemy import create_engine, text
import os
from urllib.parse import quote_plus
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables from backend/.env
env_path = Path(__file__).parent.parent / 'backend' / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ Loaded environment variables from {env_path}\n")

# Database connection
DB_CONNECTION_STRING = os.getenv('DATABASE_URL')
if not DB_CONNECTION_STRING or DB_CONNECTION_STRING == 'postgresql://username:password@host:port/database':
    raise SystemExit("ERROR: No valid DATABASE_URL found in environment or .env file")

# Input file
MERGED_GPKG = r'C:\Users\USER\Documents\Boundou_Geoportail\data\merged_parcels.gpkg'

print("=" * 80)
print("UPLOADING MERGED PARCELS TO POSTGRESQL")
print("=" * 80)

# Load the merged data
print(f"\n1. Loading merged parcels from: {MERGED_GPKG}")
gdf = gpd.read_file(MERGED_GPKG)
print(f"   ✓ Loaded {len(gdf):,} parcels")
print(f"   Columns: {list(gdf.columns)}")
print(f"   CRS: {gdf.crs}")

# Ensure geometry is valid and 2D
print("\n2. Final geometry validation...")
from shapely import force_2d, make_valid
gdf['geometry'] = gdf['geometry'].apply(lambda g: make_valid(force_2d(g)) if g is not None else None)
gdf = gdf[gdf.geometry.notna()]
gdf = gdf[~gdf.geometry.is_empty]
print(f"   ✓ {len(gdf):,} valid geometries")

# Keep geometry column as 'geometry' (don't rename to 'geom')
# PostGIS/GeoDataFrame expects 'geometry' by default

# Connect to database
print(f"\n3. Connecting to PostgreSQL database...")
try:
    engine = create_engine(DB_CONNECTION_STRING)
    with engine.connect() as conn:
        # Test connection
        result = conn.execute(text("SELECT version()"))
        version = result.fetchone()[0]
        print(f"   ✓ Connected: {version[:50]}...")
except Exception as e:
    print(f"   ✗ Connection failed: {e}")
    print("\n   Please set the DATABASE_URL environment variable or edit the script")
    print("   Example: postgresql://user:password@host:5432/database")
    exit(1)

# Backup existing table if it exists
print("\n4. Checking for existing 'parcels' table...")
with engine.connect() as conn:
    result = conn.execute(text(
        "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parcels')"
    ))
    table_exists = result.fetchone()[0]
    
    if table_exists:
        print("   Table 'parcels' exists - creating backup...")
        conn.execute(text("DROP TABLE IF EXISTS parcels_backup_old CASCADE"))
        conn.execute(text("ALTER TABLE IF EXISTS parcels_backup RENAME TO parcels_backup_old"))
        conn.execute(text("CREATE TABLE parcels_backup AS SELECT * FROM parcels"))
        conn.commit()
        print("   ✓ Backup created: parcels_backup")
        
        # Drop old table
        print("   Dropping old parcels table...")
        conn.execute(text("DROP TABLE parcels CASCADE"))
        conn.commit()
        print("   ✓ Old table dropped")
    else:
        print("   No existing 'parcels' table found")

# Upload to PostgreSQL
print(f"\n5. Uploading {len(gdf):,} parcels to PostgreSQL...")
gdf.to_postgis(
    'parcels',
    engine,
    if_exists='replace',
    index=False,
    schema='public',
    chunksize=1000
)
print("   ✓ Upload complete")

# Create indexes
print("\n6. Creating indexes...")
with engine.connect() as conn:
    # Primary key
    print("   - Creating primary key on 'id'...")
    conn.execute(text("ALTER TABLE parcels ADD PRIMARY KEY (id)"))
    
    # Spatial index (use 'geometry' column name)
    print("   - Creating spatial index on 'geometry'...")
    conn.execute(text("CREATE INDEX parcels_geometry_idx ON parcels USING GIST(geometry)"))
    
    # NICAD index
    print("   - Creating index on 'nicad'...")
    conn.execute(text("CREATE INDEX parcels_nicad_idx ON parcels(nicad) WHERE nicad IS NOT NULL"))
    
    # Source index
    print("   - Creating index on 'source'...")
    conn.execute(text("CREATE INDEX parcels_source_idx ON parcels(source)"))
    
    conn.commit()
    print("   ✓ Indexes created")

# Analyze table
print("\n7. Running ANALYZE...")
with engine.connect() as conn:
    conn.execute(text("ANALYZE parcels"))
    conn.commit()
    print("   ✓ Table analyzed")

# Summary
print("\n8. Getting table statistics...")
with engine.connect() as conn:
    result = conn.execute(text("SELECT COUNT(*) FROM parcels"))
    total_count = result.fetchone()[0]
    
    result = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE source = 'NICAD'"))
    nicad_count = result.fetchone()[0]
    
    result = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE source = 'RAW'"))
    raw_count = result.fetchone()[0]
    
    result = conn.execute(text("SELECT pg_size_pretty(pg_total_relation_size('parcels'))"))
    table_size = result.fetchone()[0]

print("\n" + "=" * 80)
print("UPLOAD COMPLETE")
print("=" * 80)
print(f"Total parcels in database: {total_count:,}")
print(f"  - NICAD (privileged): {nicad_count:,}")
print(f"  - Raw (non-overlapping): {raw_count:,}")
print(f"Table size: {table_size}")
print(f"\n✓ Table 'parcels' is ready for use in QGIS!")
print("=" * 80)

# Sample query
print("\nSample of uploaded data:")
with engine.connect() as conn:
    result = conn.execute(text("SELECT id, num_parcel, nicad, source FROM parcels LIMIT 10"))
    for row in result:
        print(f"  {row}")
