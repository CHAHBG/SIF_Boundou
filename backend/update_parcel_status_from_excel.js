require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 60000,
    connectionTimeoutMillis: 30000,
    statement_timeout: 60000
});

const files = [
    '../data/Final Status/Formalise_collective.xlsx',
    '../data/Final Status/Formalise_indiviuelle.xlsx'
];

async function ensureColumns(client) {
    console.log('--- Ensuring required columns exist ---');
    const columnsToAdd = [
        { name: 'region_senegal', type: 'TEXT' },
        { name: 'department_senegal', type: 'TEXT' },
        { name: 'arrondissement_senegal', type: 'TEXT' },
        { name: 'commune_senegal', type: 'TEXT' },
        { name: 'numero_deliberation', type: 'TEXT' },
        { name: 'numero_approbation', type: 'TEXT' }
    ];

    for (const col of columnsToAdd) {
        try {
            await client.query(`ALTER TABLE parcels ADD COLUMN IF NOT EXISTS ${col.name} ${col.type}`);
            console.log(`  ✅ Column "${col.name}" ready`);
        } catch (e) {
            console.log(`  ⚠️ Column "${col.name}": ${e.message}`);
        }
    }
    console.log('');
}

async function updateParcels() {
    // Add column migrations first
    const client = await pool.connect();
    try {
        await ensureColumns(client);
    } finally {
        client.release();
    }

    let totalUpdated = 0;
    let totalNotFound = 0;

    for (const file of files) {
        const filePath = path.join(__dirname, file);
        if (!fs.existsSync(filePath)) {
            console.log(`File not found: ${filePath}`);
            continue;
        }

        console.log(`📂 Processing ${file}...`);
        const workbook = XLSX.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet);
        console.log(`   Rows: ${data.length}`);

        let updatedCount = 0;
        let notFoundCount = 0;
        let errorCount = 0;

        console.log(`   Starting processing...`);
        for (let i = 0; i < data.length; i++) {
            const row = data[i];
            const nicad = row['nicad'] ? String(row['nicad']).trim() : null;
            const numParcel = row['Num_parcel'] ? String(row['Num_parcel']).trim() : null;
            const region = row['regionSenegal'] ? String(row['regionSenegal']).trim() : null;
            const department = row['departmentSenegal'] ? String(row['departmentSenegal']).trim() : null;
            const arrondissement = row['arrondissementSenegal'] ? String(row['arrondissementSenegal']).trim() : null;
            const commune = row['communeSenegal'] ? String(row['communeSenegal']).trim() : null;
            const village = row['Village'] ? String(row['Village']).trim() : null;
            const n_deliberation = row['N°_deliberation'] ? String(row['N°_deliberation']).trim() : null;
            const n_approbation = row['N°_approbation'] ? String(row['N°_approbation']).trim() : null;

            if (!nicad && !numParcel) continue;

            let newStatus = null;
            if (n_approbation) newStatus = 'approuvee';
            else if (n_deliberation) newStatus = 'deliberee';

            const params = [
                nicad || '', numParcel || '',
                region || '', department || '', arrondissement || '', commune || '', village || '',
                n_deliberation || '', n_approbation || '',
                newStatus || ''
            ];

            const query = `
                UPDATE parcels SET
                    nicad = CASE WHEN $1 != '' THEN $1 ELSE nicad END,
                    region_senegal = CASE WHEN $3 != '' THEN $3 ELSE region_senegal END,
                    department_senegal = CASE WHEN $4 != '' THEN $4 ELSE department_senegal END,
                    arrondissement_senegal = CASE WHEN $5 != '' THEN $5 ELSE arrondissement_senegal END,
                    commune_senegal = CASE WHEN $6 != '' THEN $6 ELSE commune_senegal END,
                    "Village" = CASE WHEN $7 != '' THEN $7 ELSE "Village" END,
                    numero_deliberation = CASE WHEN $8 != '' THEN $8 ELSE numero_deliberation END,
                    numero_approbation = CASE WHEN $9 != '' THEN $9 ELSE numero_approbation END,
                    status = CASE WHEN $10 != '' THEN $10 ELSE status END
                WHERE ($1 != '' AND nicad = $1)
                   OR ($2 != '' AND num_parcel = $2)
                RETURNING id
            `;

            try {
                const res = await pool.query(query, params);
                if (res.rowCount > 0) updatedCount++;
                else notFoundCount++;
            } catch (e) {
                errorCount++;
                if (errorCount <= 3) console.error(`   Row ${i} error:`, e.message);
            }

            if ((i + 1) % 5000 === 0) {
                console.log(`   Progress: ${i + 1}/${data.length} (updated: ${updatedCount})`);
            }
        }

        console.log(`   ✅ Updated: ${updatedCount}`);
        console.log(`   ❌ Not Found: ${notFoundCount}`);
        if (errorCount > 0) console.log(`   ⚠️ Errors: ${errorCount}`);
        console.log('');

        totalUpdated += updatedCount;
        totalNotFound += notFoundCount;
    }

    console.log('=== SUMMARY ===');
    console.log(`Total Updated: ${totalUpdated}`);
    console.log(`Total Not Found: ${totalNotFound}`);
    await pool.end();
}

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled rejection:', reason);
    process.exit(1);
});

updateParcels().catch(e => {
    console.error('Fatal error:', e);
    pool.end().then(() => process.exit(1));
});
