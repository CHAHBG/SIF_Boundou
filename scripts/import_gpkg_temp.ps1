$env:PGCLIENTENCODING = "UTF8"
$env:PROJ_LIB = "C:\Program Files\QGIS 3.40.10\share\proj"
$env:GDAL_DATA = "C:\Program Files\QGIS 3.40.10\share\gdal"

$gpkgPath = "C:\Users\USER\Documents\Boundou_Geoportail\data\Nicads\NICAD_TOUT_COMMUNE.gpkg"
$ogr2ogrPath = "C:\Program Files\QGIS 3.40.10\bin\ogr2ogr.exe"
$connectionString = "PG:host=localhost port=5432 dbname=geoportail user=postgres password=Sensei00"

Write-Host "Importing GPKG to temporary table parcels_nicad_ref..."

& $ogr2ogrPath -f "PostgreSQL" $connectionString $gpkgPath -nln parcels_nicad_ref -overwrite -t_srs EPSG:4326 -lco GEOMETRY_NAME=geometry -lco FID=fid

if ($LASTEXITCODE -eq 0) {
    Write-Host "Import successful!"
}
else {
    Write-Host "Import failed with exit code $LASTEXITCODE"
}
