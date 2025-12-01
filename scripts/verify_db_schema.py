from dotenv import load_dotenv
from pathlib import Path
import os
from sqlalchemy import create_engine, text

env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)
db = os.getenv('DATABASE_URL')
engine = create_engine(db)

print("=" * 80)
print("DATABASE SCHEMA VERIFICATION")
print("=" * 80)

with engine.connect() as conn:
    # Get parcels table structure
    print("\n1. PARCELS TABLE COLUMNS:")
    cols = conn.execute(text("""
        SELECT column_name, data_type, udt_name 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='parcels'
        ORDER BY ordinal_position
    """)).fetchall()
    for col in cols:
        print(f"   - {col[0]}: {col[1]} ({col[2]})")
    
    # Check row count
    print("\n2. ROW COUNTS:")
    total = conn.execute(text("SELECT COUNT(*) FROM parcels")).scalar()
    print(f"   Total parcels: {total:,}")
    
    # Check for geometry column and its SRID
    print("\n3. GEOMETRY INFO:")
    geom_info = conn.execute(text("""
        SELECT f_geometry_column, coord_dimension, srid, type 
        FROM geometry_columns 
        WHERE f_table_name='parcels'
    """)).fetchall()
    if geom_info:
        for g in geom_info:
            print(f"   Column: {g[0]}, Dimensions: {g[1]}, SRID: {g[2]}, Type: {g[3]}")
    else:
        print("   No geometry_columns entry found (might be using geography or raw geometry)")
    
    # Sample a few rows
    print("\n4. SAMPLE ROWS (first 5):")
    sample = conn.execute(text("""
        SELECT id, num_parcel, nicad, source, 
               ST_AsText(ST_Centroid(geometry)) as centroid,
               ST_GeometryType(geometry) as geom_type,
               ST_SRID(geometry) as srid
        FROM parcels 
        LIMIT 5
    """)).fetchall()
    for row in sample:
        print(f"   ID: {row[0]}, num_parcel: {row[1]}, nicad: {row[2]}, source: {row[3]}")
        print(f"      centroid: {row[4]}, type: {row[5]}, SRID: {row[6]}")
    
    # Check for NULL geometries
    print("\n5. NULL GEOMETRY CHECK:")
    null_geoms = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE geometry IS NULL")).scalar()
    empty_geoms = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE ST_IsEmpty(geometry)")).scalar()
    print(f"   NULL geometries: {null_geoms}")
    print(f"   Empty geometries: {empty_geoms}")
    
    # Check indexes
    print("\n6. INDEXES:")
    indexes = conn.execute(text("""
        SELECT indexname, indexdef 
        FROM pg_indexes 
        WHERE tablename='parcels'
    """)).fetchall()
    for idx in indexes:
        print(f"   - {idx[0]}")
        print(f"     {idx[1]}")

print("\n" + "=" * 80)
