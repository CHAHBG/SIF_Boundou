from dotenv import load_dotenv
from pathlib import Path
import os
from sqlalchemy import create_engine, text

env_path = Path(__file__).parent.parent / 'backend' / '.env'
if not env_path.exists():
    raise SystemExit(f".env not found at {env_path}")

load_dotenv(env_path)
db = os.getenv('DATABASE_URL')
if not db:
    raise SystemExit('No DATABASE_URL in .env')

print('Using DATABASE_URL from .env')
engine = create_engine(db)
with engine.connect() as conn:
    # Check if parcels table exists
    exists = conn.execute(text("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema='public' AND table_name='parcels')")).scalar()
    if not exists:
        print('Table parcels does not exist in DB')
    else:
        total = conn.execute(text('SELECT COUNT(*) FROM parcels')).scalar()
        nicad = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE lower(source)='nicad' OR source='NICAD' OR source='nicad'")).scalar()
        raw = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE lower(source)='raw' OR source='RAW' OR source='raw'")).scalar()
        cols = [r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='parcels' AND column_name IN ('geom','geometry','the_geom')")).fetchall()]
        print('parcels_total_count:', total)
        print('parcels_nicad_count:', nicad)
        print('parcels_raw_count:', raw)
        print('geometry_columns_found:', cols)
