from dotenv import load_dotenv
from pathlib import Path
import os
from sqlalchemy import create_engine, text

env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)
db = os.getenv('DATABASE_URL')
engine = create_engine(db)

print("=" * 80)
print("RESTORING PARCELS TABLE FROM BACKUP")
print("=" * 80)

with engine.connect() as conn:
    # 1. Drop current parcels table
    print("\n1. Dropping current (incomplete) parcels table...")
    conn.execute(text("DROP TABLE IF EXISTS parcels CASCADE"))
    conn.commit()
    print("   ✓ Dropped")
    
    # 2. Restore from backup_old (which has all the required columns)
    print("\n2. Restoring parcels from parcels_backup_old...")
    conn.execute(text("CREATE TABLE parcels AS SELECT * FROM parcels_backup_old"))
    conn.commit()
    print("   ✓ Restored")
    
    # 3. Recreate indexes
    print("\n3. Recreating indexes...")
    
    # Primary key
    print("   - Creating primary key...")
    conn.execute(text("ALTER TABLE parcels ADD PRIMARY KEY (id)"))
    
    # Spatial index
    print("   - Creating spatial index...")
    conn.execute(text("CREATE INDEX parcels_geometry_idx ON parcels USING GIST(geometry)"))
    
    # NICAD index
    print("   - Creating NICAD index...")
    conn.execute(text("CREATE INDEX parcels_nicad_idx ON parcels(nicad) WHERE nicad IS NOT NULL"))
    
    # num_parcel index
    print("   - Creating num_parcel index...")
    conn.execute(text("CREATE INDEX parcels_num_parcel_idx ON parcels(num_parcel)"))
    
    # status index
    print("   - Creating status index...")
    conn.execute(text("CREATE INDEX parcels_status_idx ON parcels(status)"))
    
    conn.commit()
    print("   ✓ Indexes created")
    
    # 4. Analyze table
    print("\n4. Running ANALYZE...")
    conn.execute(text("ANALYZE parcels"))
    conn.commit()
    print("   ✓ Done")
    
    # 5. Verify
    print("\n5. Verification:")
    total = conn.execute(text("SELECT COUNT(*) FROM parcels")).scalar()
    print(f"   Total parcels: {total:,}")
    
    cols = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='parcels'
        ORDER BY ordinal_position
    """)).fetchall()
    print(f"   Columns: {', '.join([c[0] for c in cols])}")

print("\n" + "=" * 80)
print("✓ PARCELS TABLE RESTORED SUCCESSFULLY")
print("=" * 80)
