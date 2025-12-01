# Merge and Upload Script Usage

## Step 1: Set Database Connection (Optional but Recommended)

To check for existing geometries in your PostgreSQL database, set the DATABASE_URL environment variable:

```powershell
# In PowerShell, set your Neon connection string:
$env:DATABASE_URL = "postgresql://username:password@host:5432/database"

# Example:
# $env:DATABASE_URL = "postgresql://myuser:mypass@ep-cool-darkness-123456.us-east-2.aws.neon.tech:5432/neondb?sslmode=require"
```

## Step 2: Run the Merge Script

This will:
- Load NICAD geometries (privileged source)
- Load existing geometries from your PostgreSQL database (if connected)
- Load raw parcels
- Exclude raw parcels that overlap with NICAD OR existing DB geometries
- Export merged data to GeoPackage

```powershell
& "C:/Users/USER/Documents/Boundou_Geoportail/.venv/Scripts/python.exe" "C:\Users\USER\Documents\Boundou_Geoportail\scripts\merge_nicad_raw.py"
```

## Step 3: Upload to PostgreSQL (Optional)

After merging, you can upload the cleaned data to your database:

```powershell
& "C:/Users/USER/Documents/Boundou_Geoportail/.venv/Scripts/python.exe" "C:\Users\USER\Documents\Boundou_Geoportail\scripts\upload_to_postgres.py"
```

## What Gets Excluded:

1. **Raw parcels overlapping with NICAD** (NICAD is privileged)
2. **Raw parcels overlapping with existing DB geometries** (DB is already loaded)
3. **Invalid or empty geometries**

## Output:

- **GeoPackage**: `data/merged_parcels.gpkg`
- **PostgreSQL**: `parcels` table (if uploaded)

## Notes:

- The script uses a 10% overlap threshold (configurable in the script)
- All geometries are forced to 2D for consistency
- NICAD geometries are ALWAYS kept (they are privileged)
- Raw parcels are only added if they don't overlap with NICAD or existing DB data
