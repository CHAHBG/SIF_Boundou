require('dotenv').config();
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

const files = [
    '../data/Final Status/Formalise_collective.xlsx',
    '../data/Final Status/Formalise_indiviuelle.xlsx'
];

async function updateParcels() {
    const client = await pool.connect();
    try {
        for (const file of files) {
            const filePath = path.join(__dirname, file);
            if (!fs.existsSync(filePath)) {
                console.log(`File not found: ${filePath}`);
                continue;
            }

            console.log(`Processing ${file}...`);
            const workbook = XLSX.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(sheet);

            let updatedCount = 0;
            let notFoundCount = 0;

            for (const row of data) {
                const nicad = row['nicad'];
                const n_deliberation = row['N°_deliberation'];
                const n_approbation = row['N°_approbation'];

                if (!nicad) continue;

                // Determine new status
                let newStatus = null;
                if (n_approbation) {
                    newStatus = 'approuvee';
                } else if (n_deliberation) {
                    newStatus = 'deliberee';
                }

                // Prepare update query
                // We update status only if we have a new status derived from these columns
                // We always update the numbers if they exist

                let query = `
                    UPDATE parcels 
                    SET 
                        numero_deliberation = COALESCE($2, numero_deliberation),
                        numero_approbation = COALESCE($3, numero_approbation)
                `;

                const params = [nicad, n_deliberation, n_approbation];
                let paramIdx = 4;

                if (newStatus) {
                    query += `, status = $${paramIdx}`;
                    params.push(newStatus);
                    paramIdx++;
                }

                query += ` WHERE nicad = $1 RETURNING id`;

                const res = await client.query(query, params);

                if (res.rowCount > 0) {
                    updatedCount++;
                } else {
                    // Try to find if it exists but maybe nicad format is slightly different?
                    // For now just log
                    // console.log(`NICAD not found: ${nicad}`);
                    notFoundCount++;
                }
            }
            console.log(`Finished ${file}: Updated ${updatedCount}, Not Found ${notFoundCount}`);
        }
    } catch (e) {
        console.error('Error updating parcels:', e);
    } finally {
        client.release();
        pool.end();
    }
}

updateParcels();
