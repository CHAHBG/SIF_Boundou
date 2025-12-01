"""
Merge NICAD/raw geometries with existing parcels table schema.
Strategy:
1. Load merged_parcels.gpkg (NICAD + raw with clean geometries)
2. Match with existing parcels table by num_parcel or nicad
3. Update geometries and keep existing administrative data
4. Add new parcels from NICAD/raw that don't exist in old table
5. Remove parcels not in NICAD/raw data
"""

import geopandas as gpd
import pandas as pd
from sqlalchemy import create_engine, text
from pathlib import Path
from dotenv import load_dotenv
import os
from shapely import force_2d, make_valid

# Load environment
env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)
db = os.getenv('DATABASE_URL')

print("=" * 80)
print("UPDATING PARCELS WITH NICAD/RAW GEOMETRIES")
print("=" * 80)

# 1. Load merged NICAD/raw data
MERGED_GPKG = r'C:\Users\USER\Documents\Boundou_Geoportail\data\merged_parcels.gpkg'
print(f"\n1. Loading merged NICAD/raw data from: {MERGED_GPKG}")
merged_gdf = gpd.read_file(MERGED_GPKG)
print(f"   ✓ Loaded {len(merged_gdf):,} parcels from NICAD/raw")
print(f"   Columns: {list(merged_gdf.columns)}")

# Clean geometries
print("\n2. Cleaning geometries...")
merged_gdf['geometry'] = merged_gdf['geometry'].apply(lambda g: make_valid(force_2d(g)) if g is not None else None)
merged_gdf = merged_gdf[merged_gdf.geometry.notna()]
merged_gdf = merged_gdf[~merged_gdf.geometry.is_empty]
print(f"   ✓ {len(merged_gdf):,} valid geometries")

# 3. Load existing parcels from database
engine = create_engine(db)
print("\n3. Loading existing parcels from database...")
existing_parcels = gpd.read_postgis(
    "SELECT * FROM parcels",
    engine,
    geom_col='geometry'
)
print(f"   ✓ Loaded {len(existing_parcels):,} existing parcels")
print(f"   Columns: {list(existing_parcels.columns)}")

# 4. Create matching keys
print("\n4. Matching NICAD/raw parcels with existing records...")

# Prepare merged data with matching keys
merged_gdf['match_key'] = merged_gdf.apply(
    lambda row: row['nicad'] if pd.notna(row.get('nicad')) and row.get('nicad') else row.get('num_parcel'),
    axis=1
)

# Prepare existing data with matching keys
existing_parcels['match_key'] = existing_parcels.apply(
    lambda row: row['nicad'] if pd.notna(row.get('nicad')) and row['nicad'] else row.get('num_parcel'),
    axis=1
)

# Find matches
print("\n5. Merging data...")
# Create lookup dict from existing parcels (keep all admin columns)
existing_lookup = existing_parcels.set_index('match_key').to_dict('index')

# Build new parcels list
new_parcels = []
matched_count = 0
new_count = 0

for idx, merged_row in merged_gdf.iterrows():
    match_key = merged_row['match_key']
    
    if match_key in existing_lookup:
        # Match found - use existing admin data with new geometry
        existing_data = existing_lookup[match_key]
        new_row = {
            'num_parcel': merged_row.get('num_parcel'),
            'geometry': merged_row['geometry'],
            'status': existing_data.get('status'),
            'type': existing_data.get('type'),
            'grappe_senegal': existing_data.get('grappe_senegal'),
            'region_senegal': existing_data.get('region_senegal'),
            'department_senegal': existing_data.get('department_senegal'),
            'arrondissement_senegal': existing_data.get('arrondissement_senegal'),
            'commune_senegal': existing_data.get('commune_senegal'),
            'village': existing_data.get('village'),
            'nicad': merged_row.get('nicad'),
            'numero_deliberation': existing_data.get('numero_deliberation'),
            'numero_approbation': existing_data.get('numero_approbation'),
            'conflict': existing_data.get('conflict'),
            'conflict_reason': existing_data.get('conflict_reason'),
            'superficie': merged_row.get('superficie') or existing_data.get('superficie')
        }
        matched_count += 1
    else:
        # New parcel - use merged data with defaults
        new_row = {
            'num_parcel': merged_row.get('num_parcel'),
            'geometry': merged_row['geometry'],
            'status': None,
            'type': merged_row.get('type_usa') or merged_row.get('type_usag'),
            'grappe_senegal': None,
            'region_senegal': None,
            'department_senegal': None,
            'arrondissement_senegal': None,
            'commune_senegal': None,
            'village': merged_row.get('Village') or merged_row.get('village'),
            'nicad': merged_row.get('nicad'),
            'numero_deliberation': None,
            'numero_approbation': None,
            'conflict': None,
            'conflict_reason': None,
            'superficie': merged_row.get('superficie')
        }
        new_count += 1
    
    new_parcels.append(new_row)

# Create new GeoDataFrame
print(f"\n6. Building new parcels table...")
print(f"   Matched with existing: {matched_count:,}")
print(f"   New parcels: {new_count:,}")
print(f"   Total: {len(new_parcels):,}")

final_gdf = gpd.GeoDataFrame(new_parcels, crs=merged_gdf.crs)

# Add sequential IDs
final_gdf.insert(0, 'id', range(1, len(final_gdf) + 1))

print(f"\n7. Uploading to database...")
with engine.connect() as conn:
    # Backup current table
    print("   - Creating backup (parcels_backup_before_nicad_update)...")
    conn.execute(text("DROP TABLE IF EXISTS parcels_backup_before_nicad_update CASCADE"))
    conn.execute(text("CREATE TABLE parcels_backup_before_nicad_update AS SELECT * FROM parcels"))
    conn.commit()
    
    # Drop current table
    print("   - Dropping current parcels table...")
    conn.execute(text("DROP TABLE parcels CASCADE"))
    conn.commit()

# Upload new table
print("   - Uploading new parcels table...")
final_gdf.to_postgis(
    'parcels',
    engine,
    if_exists='replace',
    index=False,
    schema='public',
    chunksize=1000
)

# Create indexes
print("\n8. Creating indexes...")
with engine.connect() as conn:
    print("   - Primary key...")
    conn.execute(text("ALTER TABLE parcels ADD PRIMARY KEY (id)"))
    
    print("   - Spatial index...")
    conn.execute(text("CREATE INDEX parcels_geometry_idx ON parcels USING GIST(geometry)"))
    
    print("   - NICAD index...")
    conn.execute(text("CREATE INDEX parcels_nicad_idx ON parcels(nicad) WHERE nicad IS NOT NULL"))
    
    print("   - num_parcel index...")
    conn.execute(text("CREATE INDEX parcels_num_parcel_idx ON parcels(num_parcel)"))
    
    print("   - status index...")
    conn.execute(text("CREATE INDEX parcels_status_idx ON parcels(status) WHERE status IS NOT NULL"))
    
    conn.commit()

# Analyze
print("\n9. Running ANALYZE...")
with engine.connect() as conn:
    conn.execute(text("ANALYZE parcels"))
    conn.commit()

# Final stats
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
with engine.connect() as conn:
    total = conn.execute(text("SELECT COUNT(*) FROM parcels")).scalar()
    with_nicad = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE nicad IS NOT NULL")).scalar()
    with_status = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE status IS NOT NULL")).scalar()
    
    print(f"Total parcels: {total:,}")
    print(f"  - With NICAD codes: {with_nicad:,}")
    print(f"  - With status (matched from old data): {with_status:,}")
    print(f"  - Matched with existing records: {matched_count:,}")
    print(f"  - New parcels added: {new_count:,}")
    print(f"  - Old parcels removed: {len(existing_parcels) - matched_count:,}")

print("\n✓ PARCELS TABLE UPDATED WITH NICAD/RAW GEOMETRIES")
print("=" * 80)
