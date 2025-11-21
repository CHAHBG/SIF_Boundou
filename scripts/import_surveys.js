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

// Convert Excel date serial number to PostgreSQL date
function excelDateToPostgres(excelDate) {
  if (!excelDate) return null;
  
  // If it's already a string date, return it
  if (typeof excelDate === 'string' && excelDate.includes('-')) return excelDate;
  
  // If it's a number, convert from Excel serial date
  if (typeof excelDate === 'number') {
    const date = new Date((excelDate - 25569) * 86400 * 1000);
    return date.toISOString().split('T')[0]; // Return YYYY-MM-DD format
  }
  
  return null;
}

async function importIndividualSurveys(filepath) {
  console.log(`\n📋 Reading individual surveys from: ${filepath}`);
  
  try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`   Found ${data.length} individual survey records`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const row of data) {
      try {
        const numParcel = cleanValue(row['Num_parcel']);
        
        if (!numParcel) {
          skipped++;
          continue;
        }
        
        await pool.query(`
          INSERT INTO individual_surveys (
            num_parcel, prenom, nom, sexe, date_naiss, lieu_naiss,
            telephone, email, type_piece, num_piece,
            photo_rec_url, photo_ver_url, vocation,
            occup_nord, occup_sud, occup_est, occup_ouest, type_usag,
            syst_cultu, type_cult_001, source_ali, irrigation,
            sup_declar, sup_exploi, sup_reelle, sup_affect,
            coord_x, coord_y, mode_acces, type_doc,
            conflit_f, cause_conf, comnt_conf
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33
          )
          ON CONFLICT (num_parcel) DO UPDATE SET
            prenom = EXCLUDED.prenom,
            nom = EXCLUDED.nom,
            telephone = EXCLUDED.telephone,
            sexe = EXCLUDED.sexe,
            vocation = EXCLUDED.vocation,
            sup_declar = EXCLUDED.sup_declar,
            sup_reelle = EXCLUDED.sup_reelle,
            photo_rec_url = EXCLUDED.photo_rec_url,
            photo_ver_url = EXCLUDED.photo_ver_url,
            updated_at = CURRENT_TIMESTAMP
        `, [
          numParcel,
          cleanValue(row['Prenom']),
          cleanValue(row['Nom']),
          cleanValue(row['Sexe']),
          excelDateToPostgres(row['Date_naiss']),
          cleanValue(row['Lieu_naiss']),
          cleanValue(row['Telephone']),
          cleanValue(row['Email']),
          cleanValue(row['Type_piece']),
          cleanValue(row['Num_piece']),
          cleanValue(row['Photo_rec_URL']),
          cleanValue(row['Photo_ver_URL']),
          cleanValue(row['Vocation']),
          cleanValue(row['Occup_nord']),
          cleanValue(row['Occup_sud']),
          cleanValue(row['Occup_est']),
          cleanValue(row['Occup_ouest']),
          cleanValue(row['type_usag']),
          cleanValue(row['Syst_cultu']),
          cleanValue(row['Type_cult_001']),
          cleanValue(row['Source_ali']),
          cleanValue(row['Irrigation']),
          cleanValue(row['Sup_declar']),
          cleanValue(row['Sup_exploi']),
          cleanValue(row['Sup_reelle']),
          cleanValue(row['Sup_affect']),
          cleanValue(row['Coord_X']),
          cleanValue(row['Coord_Y']),
          cleanValue(row['Mode_acces']),
          cleanValue(row['Type_doc']),
          cleanValue(row['Conflit_f']),
          cleanValue(row['Cause_conf']),
          cleanValue(row['Comnt_Conf'])
        ]);
        
        imported++;
        
      } catch (err) {
        console.error(`   ⚠️  Error importing ${row['Num_parcel']}: ${err.message}`);
        skipped++;
      }
    }
    
    console.log(`   ✅ Imported ${imported} individual surveys, skipped ${skipped}`);
    return imported;
    
  } catch (err) {
    console.error(`   ❌ Error reading file: ${err.message}`);
    return 0;
  }
}

async function importCollectiveSurveys(filepath) {
  console.log(`\n📋 Reading collective surveys from: ${filepath}`);
  
  try {
    const workbook = XLSX.readFile(filepath);
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`   Found ${data.length} collective survey records`);
    
    let imported = 0;
    let skipped = 0;
    
    for (const row of data) {
      try {
        const numParcel = cleanValue(row['Num_parcel']);
        
        if (!numParcel) {
          skipped++;
          continue;
        }
        
        await pool.query(`
          INSERT INTO collective_surveys (
            num_parcel, cas_de_personne_001, nombre_affectata,
            vocation, occup_nord, occup_sud, occup_est, occup_ouest, type_usag,
            syst_cultu, type_cult_001, source_ali, irrigation,
            sup_declar, sup_exploi, sup_reelle, sup_affect,
            coord_x, coord_y, mode_acces, type_doc,
            conflit_f, cause_conf, comnt_conf
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24
          )
          ON CONFLICT (num_parcel) DO UPDATE SET
            nombre_affectata = EXCLUDED.nombre_affectata,
            vocation = EXCLUDED.vocation,
            sup_declar = EXCLUDED.sup_declar,
            sup_reelle = EXCLUDED.sup_reelle,
            updated_at = CURRENT_TIMESTAMP
        `, [
          numParcel,
          cleanValue(row['Cas_de_Personne_001']),
          cleanValue(row['Quel_est_le_nombre_d_affectata']),
          cleanValue(row['Vocation']),
          cleanValue(row['Occup_nord']),
          cleanValue(row['Occup_sud']),
          cleanValue(row['Occup_est']),
          cleanValue(row['Occup_ouest']),
          cleanValue(row['type_usag']),
          cleanValue(row['Syst_cultu']),
          cleanValue(row['Type_cult_001']),
          cleanValue(row['Source_ali']),
          cleanValue(row['Irrigation']),
          cleanValue(row['Sup_declar']),
          cleanValue(row['Sup_exploi']),
          cleanValue(row['Sup_reelle']),
          cleanValue(row['Sup_affect']),
          cleanValue(row['Coord_X']),
          cleanValue(row['Coord_Y']),
          cleanValue(row['Mode_acces']),
          cleanValue(row['Type_doc']),
          cleanValue(row['Conflit_f']),
          cleanValue(row['Cause_conf']),
          cleanValue(row['Comnt_Conf'])
        ]);
        
        // Import beneficiaries (Prenom_001 to Prenom_027)
        for (let i = 1; i <= 27; i++) {
          const prenomKey = `Prenom_${String(i).padStart(3, '0')}`;
          const nomKey = `Nom_${String(i).padStart(3, '0')}`;
          const sexeKey = `Sexe_${String(i).padStart(3, '0')}`;
          const dateKey = `Date_naiss_${String(i).padStart(3, '0')}`;
          
          const prenom = cleanValue(row[prenomKey]);
          
          if (prenom) {
            await pool.query(`
              INSERT INTO beneficiaries (
                num_parcel, beneficiary_number, prenom, nom, sexe, date_naiss
              ) VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT DO NOTHING
            `, [
              numParcel,
              i,
              prenom,
              cleanValue(row[nomKey]),
              cleanValue(row[sexeKey]),
              excelDateToPostgres(row[dateKey])
            ]);
          }
        }
        
        imported++;
        
      } catch (err) {
        console.error(`   ⚠️  Error importing ${row['Num_parcel']}: ${err.message}`);
        skipped++;
      }
    }
    
    console.log(`   ✅ Imported ${imported} collective surveys, skipped ${skipped}`);
    return imported;
    
  } catch (err) {
    console.error(`   ❌ Error reading file: ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 Starting Survey Data Import');
  console.log('='.repeat(60));
  
  const individualFile = path.join(__dirname, '../data/Survey/Enquete_Foncière-Parcelles_Individuelles_17112025.xlsx');
  const collectiveFile = path.join(__dirname, '../data/Survey/Enquete_Foncière-Parcelles_Collectives_17112025.xlsx');
  
  let total = 0;
  
  total += await importIndividualSurveys(individualFile);
  total += await importCollectiveSurveys(collectiveFile);
  
  console.log('\n' + '='.repeat(60));
  console.log(`✅ Import completed! Total records: ${total}`);
  console.log('='.repeat(60));
  
  await pool.end();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
