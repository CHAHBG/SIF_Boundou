from dotenv import load_dotenv
from pathlib import Path
import os
from sqlalchemy import create_engine, text

env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)
db = os.getenv('DATABASE_URL')
engine = create_engine(db)

print("Checking backup tables...")
with engine.connect() as conn:
    # List all tables with 'parcels' in the name
    tables = conn.execute(text("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema='public' 
        AND table_name LIKE '%parcel%'
        ORDER BY table_name
    """)).fetchall()
    
    print("\nTables with 'parcel' in name:")
    for t in tables:
        count = conn.execute(text(f"SELECT COUNT(*) FROM {t[0]}")).scalar()
        print(f"  - {t[0]}: {count:,} rows")
