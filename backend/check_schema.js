require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function main() {
    console.log('Updating parcels.type column...');
    const r = await pool.query(`
        UPDATE parcels p
        SET type = CASE 
          WHEN EXISTS(SELECT 1 FROM individual_surveys i WHERE i.num_parcel = p.num_parcel) THEN 'individual'
          WHEN EXISTS(SELECT 1 FROM collective_surveys c WHERE c.num_parcel = p.num_parcel) THEN 'collective'
          ELSE 'unknown'
        END
        WHERE p.type = 'Unknown' OR p.type IS NULL
    `);
    console.log('Updated', r.rowCount, 'rows');
    const r2 = await pool.query("SELECT type, COUNT(*) as cnt FROM parcels GROUP BY type ORDER BY cnt DESC");
    console.log('New type distribution:', r2.rows);
    await pool.end();
}
main().catch(e => { console.error(e); pool.end(); });
