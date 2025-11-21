
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function migrate() {
    try {
        console.log('Starting migration...');

        // Add status column to parcels
        await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='status') THEN 
          ALTER TABLE parcels ADD COLUMN status VARCHAR(50) DEFAULT 'Survey'; 
          RAISE NOTICE 'Added status column to parcels';
        END IF;
      END $$;
    `);

        // Add type column to parcels
        await pool.query(`
      DO $$ 
      BEGIN 
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='parcels' AND column_name='type') THEN 
          ALTER TABLE parcels ADD COLUMN type VARCHAR(50) DEFAULT 'Individual'; 
          RAISE NOTICE 'Added type column to parcels';
        END IF;
      END $$;
    `);

        console.log('Migration completed successfully.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}

migrate();
