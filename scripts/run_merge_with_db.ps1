# Example: Run merge with database check

# Set your Neon PostgreSQL connection string
# Replace with your actual credentials
$env:DATABASE_URL = "postgresql://username:password@ep-xxx-xxx.region.aws.neon.tech:5432/dbname?sslmode=require"

# Run the merge script
# This will:
# 1. Load all NICAD geometries (privileged - always kept)
# 2. Connect to PostgreSQL and load existing geometries from 'parcels' table
# 3. Load raw parcels
# 4. Remove raw parcels that overlap with NICAD OR existing DB geometries
# 5. Export the merged result to GeoPackage
& "C:/Users/USER/Documents/Boundou_Geoportail/.venv/Scripts/python.exe" "C:\Users\USER\Documents\Boundou_Geoportail\scripts\merge_nicad_raw.py"

Write-Host "`n✓ Merge complete! Check the output above for statistics."
Write-Host "Output file: C:\Users\USER\Documents\Boundou_Geoportail\data\merged_parcels.gpkg"
