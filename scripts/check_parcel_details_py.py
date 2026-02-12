import os
import psycopg2
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '../backend/.env')
load_dotenv(env_path)

db_url = os.getenv('DATABASE_URL')

def check_parcel(id):
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print(f"\nChecking Parcel {id}...")
        
        query = """
          SELECT
            p.id,
            ST_IsValid(p.geometry) as is_valid,
            ST_AsGeoJSON(p.geometry) as geojson
          FROM parcels p
          WHERE p.id = %s
        """
        
        cur.execute(query, (id,))
        row = cur.fetchone()
        
        if row:
            print(f"Parcel {id}: Valid Geometry? {row[1]}")
            if row[2] is None:
                 print("❌ GeoJSON is None")
            else:
                 print("✅ GeoJSON ok")
        else:
            print("❌ Parcel not found in DB")
            
        cur.close()
        conn.close()

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_parcel(5531)
    check_parcel(17241)
