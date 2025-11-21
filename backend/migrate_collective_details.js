
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function migrate() {
    try {
        console.log('Starting migration for collective details...');

        // Add columns to mandataries
        const mandColumns = [
            'prenom VARCHAR(100)',
            'nom VARCHAR(100)',
            'sexe VARCHAR(20)',
            'date_naiss DATE',
            'lieu_naiss VARCHAR(100)',
            'num_piece VARCHAR(100)',
            'date_deliv DATE',
            'photo_rec_url TEXT',
            'photo_ver_url TEXT'
        ];

        for (const col of mandColumns) {
            const colName = col.split(' ')[0];
            await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mandataries' AND column_name='${colName}') THEN 
            ALTER TABLE mandataries ADD COLUMN ${col}; 
            RAISE NOTICE 'Added ${colName} to mandataries';
          END IF;
        END $$;
      `);
        }

        // Add columns to beneficiaries
        const benColumns = [
            'photo_rec_url TEXT',
            'photo_ver_url TEXT'
        ];

        for (const col of benColumns) {
            const colName = col.split(' ')[0];
            await pool.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='beneficiaries' AND column_name='${colName}') THEN 
            ALTER TABLE beneficiaries ADD COLUMN ${col}; 
            RAISE NOTICE 'Added ${colName} to beneficiaries';
          END IF;
        END $$;
      `);
        }

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}

migrate();
