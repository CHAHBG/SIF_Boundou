from dotenv import load_dotenv
from pathlib import Path
import os
from sqlalchemy import create_engine, text

env_path = Path(__file__).parent.parent / 'backend' / '.env'
load_dotenv(env_path)
db = os.getenv('DATABASE_URL')
engine = create_engine(db)

with engine.connect() as conn:
    print("COLUMNS IN parcels_backup_old (original table):")
    cols = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='parcels_backup_old'
        ORDER BY ordinal_position
    """)).fetchall()
    for c in cols:
        print(f"  - {c[0]}")
    
    print("\nCOLUMNS IN parcels (new table):")
    cols = conn.execute(text("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='parcels'
        ORDER BY ordinal_position
    """)).fetchall()
    for c in cols:
        print(f"  - {c[0]}")
