require('dotenv').config({ path: '../backend/.env' });
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:Sensei00@localhost:5432/geoportail',
});

function cleanValue(value) {
    if (value === null || value === undefined || value === '' || (typeof value === 'number' && isNaN(value))) {
        return null;
    }
    return value;
}

async function updateParcelLocation(numParcel, row) {
    try {
        // Try to extract location data from various possible column names
        const region = cleanValue(row['regionSenegal'] || row['region_senegal'] || row['Region'] || row['REGION']);
        const department = cleanValue(row['departmentSenegal'] || row['department_senegal'] || row['Department'] || row['Departement'] || row['DEPARTEMENT']);
        const arrondissement = cleanValue(row['arrondissementSenegal'] || row['arrondissement_senegal'] || row['Arrondissement'] || row['ARRONDISSEMENT']);
        const commune = cleanValue(row['communeSenegal'] || row['commune_senegal'] || row['Commune'] || row['COMMUNE']);
        const village = cleanValue(row['Village'] || row['village'] || row['VILLAGE']);
        const grappe = cleanValue(row['grappeSenegal'] || row['grappe_senegal'] || row['Grappe'] || row['GRAPPE']);

        // Only update if we have at least one location field
        if (region || department || arrondissement || commune || village || grappe) {
            await pool.query(`
        UPDATE parcels
        SET 
          region_senegal = COALESCE($2, region_senegal),
          department_senegal = COALESCE($3, department_senegal),
          arrondissement_senegal = COALESCE($4, arrondissement_senegal),
          commune_senegal = COALESCE($5, commune_senegal),
          village = COALESCE($6, village),
          grappe_senegal = COALESCE($7, grappe_senegal)
        WHERE num_parcel = $1
      `, [numParcel, region, department, arrondissement, commune, village, grappe]);

            return true;
        }
        return false;
    } catch (err) {
        console.error(`   ⚠️  Error updating location for ${numParcel}: ${err.message}`);
        return false;
    }
}

async function checkExcelColumns(filepath) {
    console.log(`\\n🔍 Checking columns in: ${path.basename(filepath)}`);
    try {
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length > 0) {
            const headers = data[0];
            const locationColumns = headers.filter(h =>
                h && (h.toLowerCase().includes('region') ||
                    h.toLowerCase().includes('department') ||
                    h.toLowerCase().includes('arrondissement') ||
                    h.toLowerCase().includes('commune') ||
                    h.toLowerCase().includes('village') ||
                    h.toLowerCase().includes('grappe'))
            );

            if (locationColumns.length > 0) {
                console.log(`   📍 Found location columns:`, locationColumns);
                return locationColumns;
            } else {
                console.log(`   ⚠️  No location columns found in this file`);
                return [];
            }
        }
    } catch (err) {
        console.error(`   ❌ Error checking columns: ${err.message}`);
    }
    return [];
}

async function importWithLocationData(filepath, isCollective = false) {
    const fileType = isCollective ? 'collective' : 'individual';
    console.log(`\\n📋 Importing ${fileType} surveys with location data from: ${path.basename(filepath)}`);

    try {
        // First check what location columns exist
        await checkExcelColumns(filepath);

        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`   Found ${data.length} records`);

        let locationsUpdated = 0;

        for (const row of data) {
            const numParcel = cleanValue(row['Num_parcel']);

            if (numParcel) {
                const updated = await updateParcelLocation(numParcel, row);
                if (updated) locationsUpdated++;
            }
        }

        console.log(`   ✅ Updated location data for ${locationsUpdated} parcels`);
        return locationsUpdated;

    } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
        return 0;
    }
}

async function main() {
    console.log('='.repeat(70));
    console.log('📍 Updating Parcel Location Data from Excel Files');
    console.log('='.repeat(70));

    const individualFile = path.join(__dirname, '../data/Survey/Enquete_Foncière-Parcelles_Individuelles_17112025.xlsx');
    const collectiveFile = path.join(__dirname, '../data/Survey/Enquete_Foncière-Parcelles_Collectives_17112025.xlsx');

    let total = 0;

    total += await importWithLocationData(individualFile, false);
    total += await importWithLocationData(collectiveFile, true);

    console.log('\\n' + '='.repeat(70));
    console.log(`✅ Location update completed! Total parcels updated: ${total}`);
    console.log('='.repeat(70));
    console.log('\\n💡 TIP: If no location columns were found, check your Excel file');
    console.log('   column names. Expected names: regionSenegal, departmentSenegal,');
    console.log('   arrondissementSenegal, communeSenegal, village, grappeSenegal');

    await pool.end();
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
