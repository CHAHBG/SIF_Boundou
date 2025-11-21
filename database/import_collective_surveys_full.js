require('dotenv').config({ path: '../backend/.env' });
const { Pool } = require('pg');
const XLSX = require('xlsx');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function importCollectiveSurveys() {
  const filePath = path.join(__dirname, '../data/Survey/Enquete_Foncière-Parcelles_Collectives_17112025.xlsx');
  
  console.log('Reading Excel file:', filePath);
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Found ${data.length} collective survey records`);
  
  let imported = 0;
  let updated = 0;
  let mandatairesImported = 0;
  let beneficiariesImported = 0;
  
  for (const row of data) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      // Check if collective survey exists
      const existingCheck = await client.query(
        'SELECT id FROM collective_surveys WHERE num_parcel = $1',
        [row.Num_parcel]
      );
      
      let collectiveSurveyId;
      
      if (existingCheck.rows.length > 0) {
        // Update existing
        collectiveSurveyId = existingCheck.rows[0].id;
        await client.query(`
          UPDATE collective_surveys SET
            nombre_affectata = $1,
            vocation = $2,
            sup_declar = $3,
            sup_reelle = $4,
            type_usag = $5
          WHERE id = $6
        `, [
          row.Quel_est_le_nombre_d_affectata,
          row.Vocation,
          row.Sup_declar,
          row.Sup_reelle,
          row.type_usag,
          collectiveSurveyId
        ]);
        updated++;
      } else {
        // Insert new
        const result = await client.query(`
          INSERT INTO collective_surveys (
            num_parcel, nombre_affectata, vocation, sup_declar, sup_reelle, type_usag
          ) VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [
          row.Num_parcel,
          row.Quel_est_le_nombre_d_affectata,
          row.Vocation,
          row.Sup_declar,
          row.Sup_reelle,
          row.type_usag
        ]);
        collectiveSurveyId = result.rows[0].id;
        imported++;
      }
      
      // Delete existing mandataires and beneficiaries for this parcel
      await client.query('DELETE FROM mandataries WHERE num_parcel = $1', [row.Num_parcel]);
      await client.query('DELETE FROM beneficiaries WHERE num_parcel = $1', [row.Num_parcel]);
      
      // Import Mandataire (single record per collective parcel)
      if (row.Prenom_M || row.Nom_M) {
        await client.query(`
          INSERT INTO mandataries (
            collective_survey_id, num_parcel, mandatary_number,
            prenom, nom, sexe, date_naiss, lieu_naiss, num_piece, date_deliv,
            typ_per, contact, photo_rec_url, photo_ver_url,
            situ_mat, nbr_epse, chef_fam, chef_mena, nat_001
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        `, [
          collectiveSurveyId,
          row.Num_parcel,
          1, // mandatary_number
          row.Prenom_M,
          row.Nom_M,
          row.Sexe_Mndt,
          row.Date_nai || null,
          row.Lieu_nais,
          row.Num_piec,
          row.Date_deliv || null,
          row.Cas_de_Personne_001, // typ_per
          row.Telephon2,
          row.Photo_Rec_URL,
          row.Photo_Ver_URL,
          row.Situ_mat,
          row.Nbr_epse,
          row.Chef_fam,
          row.Chef_mena,
          row.Nat_001
        ]);
        mandatairesImported++;
      }
      
      // Import Beneficiaries (up to 27)
      for (let i = 1; i <= 27; i++) {
        const numStr = i.toString().padStart(3, '0');
        const prenom = row[`Prenom_${numStr}`];
        const nom = row[`Nom_${numStr}`];
        
        if (prenom || nom) {
          await client.query(`
            INSERT INTO beneficiaries (
              collective_survey_id, num_parcel, beneficiary_number,
              prenom, nom, sexe, date_naiss, type_piece, num_piece,
              photo_rec_url, photo_ver_url, signature
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          `, [
            collectiveSurveyId,
            row.Num_parcel,
            i,
            prenom,
            nom,
            row[`Sexe_${numStr}`],
            row[`Date_nais${i}`] || null,
            row[`Nature_ID${i}`],
            row[`Num_piece${i === 1 ? '_001' : i}`],
            row[`Recto_AF${i}_URL`],
            row[`Verso_AF${i}_URL`],
            row[`Signature${i}_URL`]
          ]);
          beneficiariesImported++;
        }
      }
      
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Error importing parcel ${row.Num_parcel}:`, err.message);
    } finally {
      client.release();
    }
  }
  
  console.log(`\nImport complete:`);
  console.log(`- Collective surveys imported: ${imported}`);
  console.log(`- Collective surveys updated: ${updated}`);
  console.log(`- Mandataires imported: ${mandatairesImported}`);
  console.log(`- Beneficiaries imported: ${beneficiariesImported}`);
  
  await pool.end();
}

importCollectiveSurveys().catch(console.error);
