
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function populateAll() {
    try {
        console.log('Starting bulk population...');

        // 1. Insert missing Mandataries
        const insertMandataries = `
            INSERT INTO mandataries (
                collective_survey_id, num_parcel, mandatary_number, 
                prenom, nom, sexe, date_naiss, lieu_naiss, 
                num_piece, date_deliv, contact, typ_per
            )
            SELECT 
                id, num_parcel, 1,
                'Mandataire', 'TEST', 'Homme', '1980-01-01', 'Localité',
                '1000000000000', '2020-01-01', '+221 77 000 00 00', 'Physique'
            FROM collective_surveys cs
            WHERE NOT EXISTS (
                SELECT 1 FROM mandataries m WHERE m.collective_survey_id = cs.id
            );
        `;
        const resMand = await pool.query(insertMandataries);
        console.log(`Inserted ${resMand.rowCount} missing mandataries.`);

        // 2. Update existing Mandataries with NULL names
        const updateMandataries = `
            UPDATE mandataries
            SET 
                prenom = 'Mandataire', nom = 'TEST', sexe = 'Homme',
                date_naiss = '1980-01-01', lieu_naiss = 'Localité',
                num_piece = '1000000000000', date_deliv = '2020-01-01',
                contact = '+221 77 000 00 00'
            WHERE prenom IS NULL OR nom IS NULL;
        `;
        const resMandUpd = await pool.query(updateMandataries);
        console.log(`Updated ${resMandUpd.rowCount} mandataries with missing info.`);

        // 3. Insert Beneficiaries (removed lieu_naiss)
        const insertBeneficiaries = `
            INSERT INTO beneficiaries (
                collective_survey_id, num_parcel, beneficiary_number,
                prenom, nom, sexe, date_naiss, num_piece
            )
            SELECT 
                cs.id, cs.num_parcel, g.n,
                'Bénéficiaire ' || g.n, 'TEST', 
                CASE WHEN g.n % 2 = 0 THEN 'Femme' ELSE 'Homme' END,
                '1990-01-01',
                '200000000000' || g.n
            FROM collective_surveys cs
            CROSS JOIN generate_series(1, 4) AS g(n)
            WHERE NOT EXISTS (
                SELECT 1 FROM beneficiaries b WHERE b.collective_survey_id = cs.id
            );
        `;
        const resBen = await pool.query(insertBeneficiaries);
        console.log(`Inserted ${resBen.rowCount} beneficiaries.`);

        console.log('Bulk population completed.');

    } catch (err) {
        console.error('Error populating data:', err.message);
        if (err.detail) console.error('Detail:', err.detail);
        if (err.table) console.error('Table:', err.table);
    } finally {
        pool.end();
    }
}

populateAll();
