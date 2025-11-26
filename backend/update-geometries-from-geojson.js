// Script to update parcel geometries from GeoJSON file
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function updateGeometries() {
  console.log('🚀 Starting geometry update from GeoJSON file...\n');

  try {
    // Read GeoJSON file
    const geojsonPath = 'C:\\Users\\USER\\Documents\\Boundou_Geoportail\\data\\Update Geometries\\Parcelles_Post_Traitees.GEOJSON';
    console.log('📂 Reading GeoJSON file:', geojsonPath);
    
    const geojsonData = JSON.parse(fs.readFileSync(geojsonPath, 'utf8'));
    const features = geojsonData.features;
    
    console.log(`✅ Loaded ${features.length} parcels from GeoJSON\n`);

    let updated = 0;
    let notFound = 0;
    let errors = 0;

    // Process each feature
    for (let i = 0; i < features.length; i++) {
      const feature = features[i];
      const numParcel = feature.properties.Num_parcel;
      
      if (!numParcel) {
        console.log(`⚠️  Skipping feature ${i}: No Num_parcel`);
        errors++;
        continue;
      }

      try {
        // Convert GeoJSON geometry to WKT for PostGIS
        // Note: The coordinates are in EPSG:32628 (UTM Zone 28N)
        const geometryJson = JSON.stringify(feature.geometry);
        
        // Update query - transform from EPSG:32628 to EPSG:4326 (WGS84)
        const updateQuery = `
          UPDATE parcels
          SET geometry = ST_Transform(
            ST_SetSRID(
              ST_GeomFromGeoJSON($1),
              32628
            ),
            4326
          )
          WHERE num_parcel = $2
          RETURNING num_parcel
        `;

        const result = await pool.query(updateQuery, [geometryJson, numParcel]);

        if (result.rowCount > 0) {
          updated++;
          if ((updated % 100) === 0) {
            console.log(`✅ Updated ${updated} parcels...`);
          }
        } else {
          notFound++;
          console.log(`⚠️  Parcel ${numParcel} not found in database`);
        }

      } catch (err) {
        errors++;
        console.error(`❌ Error updating parcel ${numParcel}:`, err.message);
      }
    }

    console.log('\n📊 Update Summary:');
    console.log(`   ✅ Successfully updated: ${updated}`);
    console.log(`   ⚠️  Not found in database: ${notFound}`);
    console.log(`   ❌ Errors: ${errors}`);
    console.log(`   📦 Total processed: ${features.length}`);

    if (updated > 0) {
      console.log('\n🎉 Geometry update completed successfully!');
      console.log('💡 Tip: Run VACUUM ANALYZE parcels; to optimize the database after bulk updates.');
    }

  } catch (err) {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

updateGeometries();
