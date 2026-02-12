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

const { findLatestNicadFile } = require('./find_latest_data');

async function importNicad() {
    // Usage: node import_nicad.js [nicad_file]
    let filepath = process.argv[2];

    if (!filepath) {
        console.log("ℹ️  No file path provided, searching for latest Nicad file...");
        filepath = findLatestNicadFile(); // Returns just the path string
    }

    if (!filepath) {
        console.error("❌ Could not determine Nicad input file.");
        process.exit(1);
    }

    console.log(`\n📋 Importing NICAD data from: ${path.basename(filepath)}`);

    try {
        const workbook = XLSX.readFile(filepath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet);

        console.log(`   Found ${data.length} records`);

        let updated = 0;
        let skipped = 0;

        for (const row of data) {
            try {
                const numParcel = cleanValue(row['Num_parcel']);
                const nicad = cleanValue(row['nicad']);

                if (!numParcel || !nicad) {
                    skipped++;
                    continue;
                }

                const res = await pool.query(`
          UPDATE parcels
          SET nicad = $2
          WHERE num_parcel = $1
        `, [numParcel, nicad]);

                if (res.rowCount > 0) {
                    updated++;
                } else {
                    // Parcel not found in DB
                    skipped++;
                }

            } catch (err) {
                console.error(`   ⚠️  Error updating ${row['Num_parcel']}: ${err.message}`);
                skipped++;
            }
        }

        console.log(`   ✅ Updated NICAD for ${updated} parcels`);
        console.log(`   ⚠️  Skipped ${skipped} records (missing data or parcel not found)`);

    } catch (err) {
        console.error(`   ❌ Error: ${err.message}`);
    } finally {
        pool.end();
    }
}

importNicad();
