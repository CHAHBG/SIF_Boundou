"""
Merge NICAD and Raw Parcels data, privileging NICAD geometries.
Strategy:
1. Load NICAD data (privileged source - keep all)
2. Load existing geometries from PostgreSQL database (if available)
3. Load Raw parcels data
4. Remove raw parcels that overlap with NICAD or existing DB geometries
5. Merge the remaining raw parcels with NICAD
6. Export to PostGIS and/or GeoPackage
"""

import geopandas as gpd
import pandas as pd
from shapely.ops import unary_union
from pathlib import Path
import warnings
import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
warnings.filterwarnings('ignore')

# Load environment variables from backend/.env
env_path = Path(__file__).parent.parent / 'backend' / '.env'
if env_path.exists():
    load_dotenv(env_path)
    print(f"✓ Loaded environment variables from {env_path}")
else:
    print(f"⚠ No .env file found at {env_path}")

# File paths
NICAD_PATH = r'C:\Users\USER\Documents\Boundou_Geoportail\data\Nicads\NICAD_TOUT_COMMUNE.gpkg'
RAW_PATH = r'C:\Users\USER\Documents\Boundou_Geoportail\data\Raw parcels\Parcelles Brutes.gpkg'
OUTPUT_GPKG = r'C:\Users\USER\Documents\Boundou_Geoportail\data\merged_parcels.gpkg'

# Database connection (optional - set DATABASE_URL environment variable)
DB_CONNECTION_STRING = os.getenv('DATABASE_URL', None)

print("=" * 80)
print("MERGING NICAD (PRIVILEGED) + RAW PARCELS DATA")
print("=" * 80)

# Load NICAD data (privileged)
print("\n1. Loading NICAD data (privileged source)...")
nicad_gdf = gpd.read_file(NICAD_PATH)
print(f"   ✓ Loaded {len(nicad_gdf):,} NICAD parcels")
print(f"   CRS: {nicad_gdf.crs}")
print(f"   Columns: {list(nicad_gdf.columns)}")

# Force to 2D and ensure valid geometries
print("\n2. Cleaning NICAD geometries...")
from shapely import force_2d, make_valid
nicad_gdf['geometry'] = nicad_gdf['geometry'].apply(lambda g: make_valid(force_2d(g)) if g is not None else None)
nicad_gdf = nicad_gdf[nicad_gdf.geometry.notna()]
nicad_gdf = nicad_gdf[~nicad_gdf.geometry.is_empty]
print(f"   ✓ {len(nicad_gdf):,} valid NICAD geometries")

# Load existing geometries from database (if available)
db_gdf = None
if DB_CONNECTION_STRING:
    print("\n3. Loading existing geometries from PostgreSQL database...")
    try:
        engine = create_engine(DB_CONNECTION_STRING)
        with engine.connect() as conn:
            # Check if parcels table exists
            result = conn.execute(text(
                "SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'parcels')"
            ))
            table_exists = result.fetchone()[0]
            
            if table_exists:
                # Load only geometry column for comparison (to save memory)
                # Try common geometry column names
                for geom_col in ['geometry', 'geom', 'the_geom']:
                    try:
                        db_gdf = gpd.read_postgis(
                            f"SELECT id, ST_Force2D({geom_col}) as geometry FROM parcels WHERE {geom_col} IS NOT NULL",
                            engine,
                            geom_col='geometry'
                        )
                        print(f"   ✓ Loaded {len(db_gdf):,} existing geometries from database (column: {geom_col})")
                        break
                    except Exception as e:
                        if 'does not exist' in str(e):
                            continue
                        else:
                            raise
                
                if db_gdf is None:
                    print("   ⚠ Could not find geometry column in parcels table")
                elif db_gdf is not None:
                    # Ensure same CRS
                    if db_gdf.crs != nicad_gdf.crs:
                        db_gdf = db_gdf.to_crs(nicad_gdf.crs)
                        print(f"   ✓ Reprojected DB geometries to {nicad_gdf.crs}")
            else:
                print("   No 'parcels' table found in database")
    except Exception as e:
        print(f"   ⚠ Could not connect to database: {e}")
        print("   Continuing without DB geometry check...")
else:
    print("\n3. No database connection configured (set DATABASE_URL to check existing geometries)")

# Load Raw parcels
print("\n4. Loading Raw parcels data...")
raw_gdf = gpd.read_file(RAW_PATH)
print(f"   ✓ Loaded {len(raw_gdf):,} raw parcels")
print(f"   CRS: {raw_gdf.crs}")
print(f"   Columns: {list(raw_gdf.columns)}")

# Clean raw geometries
print("\n4. Cleaning raw geometries...")
raw_gdf['geometry'] = raw_gdf['geometry'].apply(lambda g: make_valid(force_2d(g)) if g is not None else None)
raw_gdf = raw_gdf[raw_gdf.geometry.notna()]
raw_gdf = raw_gdf[~raw_gdf.geometry.is_empty]
print(f"   ✓ {len(raw_gdf):,} valid raw geometries")

# Ensure same CRS
if nicad_gdf.crs != raw_gdf.crs:
    print(f"\n5. Reprojecting raw parcels to {nicad_gdf.crs}...")
    raw_gdf = raw_gdf.to_crs(nicad_gdf.crs)
else:
    print(f"\n5. CRS already matches: {nicad_gdf.crs}")

# Combine NICAD and DB geometries for overlap checking
print("\n6. Preparing reference geometries (NICAD + existing DB geometries)...")
reference_gdfs = [nicad_gdf]
if db_gdf is not None and len(db_gdf) > 0:
    reference_gdfs.append(db_gdf)
    print(f"   Including {len(db_gdf):,} geometries from database")

# If we have DB geometries, combine them with NICAD for checking
if len(reference_gdfs) > 1:
    combined_ref_gdf = pd.concat(reference_gdfs, ignore_index=True)
    print(f"   ✓ Total reference geometries: {len(combined_ref_gdf):,}")
else:
    combined_ref_gdf = nicad_gdf
    print(f"   ✓ Using only NICAD geometries: {len(combined_ref_gdf):,}")

# Create spatial index for efficient overlap detection
print("\n7. Creating spatial index for reference geometries...")
ref_sindex = combined_ref_gdf.sindex

# Find raw parcels that DON'T significantly overlap with reference geometries
print("\n8. Filtering raw parcels that don't overlap with reference geometries...")
OVERLAP_THRESHOLD = 0.1  # 10% overlap tolerance

non_overlapping_raw = []
overlapping_count = 0

for idx, raw_parcel in raw_gdf.iterrows():
    raw_geom = raw_parcel.geometry
    
    # Find potential matches using spatial index
    possible_matches_idx = list(ref_sindex.intersection(raw_geom.bounds))
    
    if not possible_matches_idx:
        # No spatial overlap at all
        non_overlapping_raw.append(idx)
        continue
    
    # Check actual overlap
    overlaps_significantly = False
    for ref_idx in possible_matches_idx:
        ref_geom = combined_ref_gdf.iloc[ref_idx].geometry
        
        if raw_geom.intersects(ref_geom):
            intersection_area = raw_geom.intersection(ref_geom).area
            overlap_ratio = intersection_area / raw_geom.area if raw_geom.area > 0 else 0
            
            if overlap_ratio > OVERLAP_THRESHOLD:
                overlaps_significantly = True
                overlapping_count += 1
                break
    
    if not overlaps_significantly:
        non_overlapping_raw.append(idx)

raw_to_add = raw_gdf.loc[non_overlapping_raw]
print(f"   ✓ Found {len(raw_to_add):,} raw parcels that don't overlap with reference geometries")
print(f"   ✗ Excluded {overlapping_count:,} raw parcels that overlap with NICAD/DB geometries")

# Harmonize columns before merging
print("\n9. Harmonizing columns...")

# Prepare NICAD data with standardized columns
nicad_standard = nicad_gdf.copy()
nicad_standard['source'] = 'NICAD'
nicad_standard['num_parcel'] = nicad_standard.get('Num_parcel', nicad_standard.get('nicad'))

# Prepare raw data with standardized columns
raw_standard = raw_to_add.copy()
raw_standard['source'] = 'RAW'
raw_standard['num_parcel'] = raw_standard.get('Num_parcel', None)
raw_standard['nicad'] = None  # Raw parcels don't have NICAD codes yet
raw_standard['type_usa'] = None
raw_standard['type_usag'] = None
raw_standard['Village'] = None
raw_standard['source_file'] = raw_standard.get('source_file', None)

# Common columns to keep
common_cols = ['num_parcel', 'nicad', 'source', 'geometry']
optional_cols = ['type_usa', 'type_usag', 'Village', 'source_file', 'superficie', 'x_centroid', 'y_centroid']

# Build column list
final_cols = common_cols.copy()
for col in optional_cols:
    if col in nicad_standard.columns or col in raw_standard.columns:
        final_cols.append(col)
        # Ensure both have the column
        if col not in nicad_standard.columns:
            nicad_standard[col] = None
        if col not in raw_standard.columns:
            raw_standard[col] = None

# Select only the columns we want
nicad_final = nicad_standard[final_cols]
raw_final = raw_standard[final_cols]

# Merge
print("\n10. Merging datasets...")
merged_gdf = pd.concat([nicad_final, raw_final], ignore_index=True)
print(f"   ✓ Total merged parcels: {len(merged_gdf):,}")
print(f"     - NICAD (privileged): {len(nicad_final):,}")
print(f"     - Raw (non-overlapping): {len(raw_final):,}")

# Add unique ID
merged_gdf.insert(0, 'id', range(1, len(merged_gdf) + 1))

# Export to GeoPackage
print(f"\n11. Exporting to GeoPackage: {OUTPUT_GPKG}")
merged_gdf.to_file(OUTPUT_GPKG, driver='GPKG', layer='parcels')
print(f"   ✓ Exported successfully")

# Summary statistics
print("\n" + "=" * 80)
print("SUMMARY")
print("=" * 80)
print(f"Total parcels: {len(merged_gdf):,}")
print(f"  - From NICAD (privileged): {len(merged_gdf[merged_gdf['source'] == 'NICAD']):,}")
print(f"  - From Raw (non-overlapping): {len(merged_gdf[merged_gdf['source'] == 'RAW']):,}")
print(f"\nOutput file: {OUTPUT_GPKG}")
print(f"CRS: {merged_gdf.crs}")
print(f"\nColumns: {list(merged_gdf.columns)}")
print("\n✓ Merge complete!")
print("=" * 80)

# Display sample
print("\nSample of merged data:")
print(merged_gdf.head(10))
