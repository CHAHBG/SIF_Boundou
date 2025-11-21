# Import GeoPackage parcels into PostgreSQL
# This script uses ogr2ogr to import spatial data

# Step 1: Import from GeoPackage to a temporary table
Write-Host "=" * 60
Write-Host "Importing parcel geometries from GeoPackage..."
Write-Host "=" * 60

$gpkgPath = "C:\Users\USER\Documents\Boundou_Geoportail\data\Raw parcels\Parcelles Brutes.gpkg"
$connString = "PG:dbname=geoportail user=postgres password=Sensei00 host=localhost port=5432"

# Check if ogr2ogr is available
$ogrInstalled = Get-Command ogr2ogr -ErrorAction SilentlyContinue

if (-not $ogrInstalled) {
    Write-Host ""
    Write-Host "⚠️  ogr2ogr not found. Installing via OSGeo4W or using alternative method..."
    Write-Host ""
    Write-Host "Alternative: We'll use Python with geopandas instead."
    Write-Host "Run: pip install geopandas psycopg2 sqlalchemy geoalchemy2"
    Write-Host ""
    
    # Create Python import script as fallback
    $pythonScript = @"
import geopandas as gpd
from sqlalchemy import create_engine
import os

print('=' * 60)
print('📦 Importing parcels from GeoPackage using Python...')
print('=' * 60)

gpkg_path = r'C:\Users\USER\Documents\Boundou_Geoportail\data\Raw parcels\Parcelles Brutes.gpkg'
engine = create_engine('postgresql://postgres:Sensei00@localhost:5432/geoportail')

try:
    # Read GeoPackage
    print(f'\n📂 Reading: {gpkg_path}')
    gdf = gpd.read_file(gpkg_path)
    print(f'   Found {len(gdf)} parcels')
    
    # Show columns
    print(f'\n📋 Columns in GeoPackage:')
    print(gdf.columns.tolist())
    
    # Ensure CRS is EPSG:4326 (WGS84)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f'\n🔄 Converting from {gdf.crs} to EPSG:4326')
        gdf = gdf.to_crs(epsg=4326)
    
    # Rename geometry column if needed
    if gdf.geometry.name != 'geom':
        gdf = gdf.rename_geometry('geom')
    
    # Import to temporary table first
    print(f'\n📥 Importing to parcels_import table...')
    gdf.to_postgis('parcels_import', engine, if_exists='replace', index=False)
    
    print('\n✅ Import to temporary table successful!')
    print('\nNext steps:')
    print('1. Review the imported data in parcels_import table')
    print('2. Run the SQL script to copy data to parcels table with proper mapping')
    
except Exception as e:
    print(f'\n❌ Error: {e}')
    exit(1)
"@
    
    $pythonScript | Out-File -FilePath "C:\Users\USER\Documents\Boundou_Geoportail\scripts\import_gpkg.py" -Encoding UTF8
    
    Write-Host "✅ Created Python import script: scripts\import_gpkg.py"
    Write-Host ""
    Write-Host "To run it:"
    Write-Host "  1. Install dependencies: pip install geopandas psycopg2 sqlalchemy geoalchemy2"
    Write-Host "  2. Run: python scripts\import_gpkg.py"
    Write-Host ""
    
} else {
    # Use ogr2ogr if available
    Write-Host "✅ ogr2ogr found, importing..."
    
    ogr2ogr -f "PostgreSQL" $connString `
        -nln parcels_import `
        -lco GEOMETRY_NAME=geom `
        -lco FID=gid `
        -t_srs EPSG:4326 `
        "$gpkgPath"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ GeoPackage imported to parcels_import table"
    } else {
        Write-Host "❌ ogr2ogr import failed"
        exit 1
    }
}

Write-Host ""
Write-Host "=" * 60
Write-Host "Next: Run the SQL mapping script to copy to parcels table"
Write-Host "=" * 60
