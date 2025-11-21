
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function migrate() {
    try {
        console.log('Starting migration to add location columns to parcels table...');

        // Add location columns to parcels table
        const columns = [
            'grappe_senegal VARCHAR(100)',
            'region_senegal VARCHAR(100)',
            'department_senegal VARCHAR(100)',
            'arrondissement_senegal VARCHAR(100)',
            'commune_senegal VARCHAR(100)',
            'village VARCHAR(100)'
        ];

        for (const col of columns) {
            const colName = col.split(' ')[0];
            await pool.query(`
                DO $$ 
                BEGIN 
                    IF NOT EXISTS (
                        SELECT 1 FROM information_schema.columns 
                        WHERE table_name='parcels' AND column_name='${colName}'
                    ) THEN 
                        ALTER TABLE parcels ADD COLUMN ${col}; 
                        RAISE NOTICE 'Added ${colName} to parcels';
                    ELSE
                        RAISE NOTICE '${colName} already exists in parcels';
                    END IF;
                END $$;
            `);
        }

        console.log('Migration completed successfully.');
        console.log('Location columns added to parcels table.');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        pool.end();
    }
}

migrate();
