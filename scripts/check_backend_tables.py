from dotenv import load_dotenv
from pathlib import Path
import os
from sqlalchemy import create_engine, text

env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)
db = os.getenv('DATABASE_URL')
engine = create_engine(db)

print("=" * 80)
print("CHECKING REQUIRED TABLES FOR BACKEND")
print("=" * 80)

with engine.connect() as conn:
    # Check what tables exist
    print("\n1. ALL TABLES IN DATABASE:")
    tables = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public' 
        ORDER BY table_name
    """)).fetchall()
    for t in tables:
        count = conn.execute(text(f"SELECT COUNT(*) FROM {t[0]}")).scalar()
        print(f"   - {t[0]}: {count:,} rows")
    
    # Check if individual_surveys exists
    print("\n2. CHECKING REQUIRED TABLES:")
    required = ['parcels', 'individual_surveys', 'collective_surveys']
    for table in required:
        exists = conn.execute(text(f"""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema='public' AND table_name='{table}'
            )
        """)).scalar()
        print(f"   {table}: {'✓ EXISTS' if exists else '✗ MISSING'}")
    
    # Check parcels columns that backend needs
    print("\n3. CHECKING PARCELS COLUMNS BACKEND NEEDS:")
    needed_cols = ['id', 'num_parcel', 'geometry', 'status', 'nicad', 'region_senegal', 
                   'department_senegal', 'arrondissement_senegal', 'commune_senegal', 'village']
    parcels_cols = [c[0] for c in conn.execute(text("""
        SELECT column_name FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='parcels'
    """)).fetchall()]
    
    for col in needed_cols:
        if col in parcels_cols:
            print(f"   {col}: ✓")
        else:
            print(f"   {col}: ✗ MISSING")

print("\n" + "=" * 80)
