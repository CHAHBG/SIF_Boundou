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
        cols = [r[0] for r in conn.execute(text("SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='parcels'")).fetchall()]
        print('parcels table columns:', cols)
        total = conn.execute(text('SELECT COUNT(*) FROM parcels')).scalar()
        print('parcels_total_count:', total)
        # Try a few likely columns for nicad/id/source
        if 'nicad' in cols:
            nicad_count = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE nicad IS NOT NULL")).scalar()
            print('parcels_with_nicad:', nicad_count)
        if 'num_parcel' in cols:
            numparcel_count = conn.execute(text("SELECT COUNT(*) FROM parcels WHERE num_parcel IS NOT NULL")).scalar()
            print('parcels_with_num_parcel:', numparcel_count)
        if 'source' in cols:
            s_counts = conn.execute(text("SELECT source, COUNT(*) FROM parcels GROUP BY source ORDER BY COUNT(*) DESC LIMIT 10")).fetchall()
            print('top sources (sample):', s_counts)
        # geometry column(s)
        geom_cols = [c for c in cols if c.lower() in ('geom','geometry','the_geom')]
        print('geometry_columns_found:', geom_cols)
