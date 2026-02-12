import os
import re
import glob
from pathlib import Path

# Base directory
DOCUMENTS_DIR = Path(os.environ.get('USERPROFILE', r'C:\Users\USER')) / 'Documents'

# Paths
NICAD_FILE = DOCUMENTS_DIR / 'Nicads' / '3.a Validation par URM' / 'TousLesNicads.gpkg'
SURVEY_BASE_DIR = DOCUMENTS_DIR / 'Process Data'
GEOMETRY_FILE = DOCUMENTS_DIR / 'Lots par communes' / 'parcelle post traités totaux.gpkg'

def find_latest_nicad():
    if NICAD_FILE.exists():
        return str(NICAD_FILE)
    return None
    
    if not files:
        # Try parent directory
        parent_dir = NICAD_BASE_DIR.parent
        if parent_dir.exists():
             files = list(parent_dir.glob('Parcelles_individuelles_Lot1_*.gpkg'))
    
    if not files:
        return None

    # Parse Lot numbers
    latest_file = None
    max_lot = -1
    
    for f in files:
        match = re.search(r'Lot1_(\d+)', f.name, re.IGNORECASE)
        if match:
            lot_num = int(match.group(1))
            if lot_num > max_lot:
                max_lot = lot_num
                latest_file = f
                
    return str(latest_file) if latest_file else None

def get_geometry_file():
    if GEOMETRY_FILE.exists():
        return str(GEOMETRY_FILE)
    return None

if __name__ == '__main__':
    print(f"NICAD: {find_latest_nicad()}")
    print(f"GEOM: {get_geometry_file()}")
