import pandas as pd
import psycopg2
import os
from dotenv import load_dotenv

# Load .env
env_path = os.path.join(os.path.dirname(__file__), '../backend/.env')
load_dotenv(env_path)

db_url = os.getenv('DATABASE_URL')

def import_deliberee():
    files = [
        r"C:\Users\USER\Documents\Deliberation parcelles individuelles.xlsx",
        r"C:\Users\USER\Documents\Deliberation parcelles collectives.xlsx"
    ]
    
    try:
        conn = psycopg2.connect(db_url)
        cur = conn.cursor()
        
        print("Starting Deliberee/Approuvée import...")
        
        for f in files:
            if not os.path.exists(f):
                print(f"Skipping {f} (not found)")
                continue
                
            print(f"Processing {os.path.basename(f)}...")
            df = pd.read_excel(f)
            
            # Normalize column names just in case
            df.columns = [c.strip() for c in df.columns]
            
            # Check required columns
            if 'nicad' not in df.columns or 'Autorité' not in df.columns:
                print(f"Skipping {f}: Missing 'nicad' or 'Autorité' column.")
                continue
            
            # Clean formatting
            df['nicad'] = df['nicad'].astype(str).str.strip()
            df['Autorité'] = df['Autorité'].astype(str).str.strip()
            
            count_delib = 0
            count_appr = 0
            
            for index, row in df.iterrows():
                nicad = row['nicad']
                auth = row['Autorité']
                
                status = 'deliberee' # Default if authority is unknown or low level
                
                if auth.lower() in ['sous préfet', 'sous-préfet', 'maire']:
                    status = 'deliberee'
                elif auth.lower() in ['préfet', 'prefet', 'gouverneur']:
                    status = 'approuvee'
                else:
                    status = 'deliberee' # Default fall back
                
                # Update DB
                # Priority: We overwrite existing status because this file is higher priority than Nicad/Survey
                # But between Deliberee and Approuvee, we should be careful?
                # Actually, if the file lists it, it is at least Deliberee.
                # If a parcel appears twice (e.g. once as deliberee, once as approuvee?), latest wins?
                # Usually one entry per parcel.
                
                cur.execute("""
                    UPDATE parcels 
                    SET status = %s 
                    WHERE nicad = %s
                """, (status, nicad))
                
                if status == 'deliberee':
                    count_delib += 1
                else:
                    count_appr += 1
            
            print(f"  -> Updated {count_delib} as 'deliberee'")
            print(f"  -> Updated {count_appr} as 'approuvee'")
            
        conn.commit()
        cur.close()
        conn.close()
        print("Import completed successfully.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    import_deliberee()
