
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function debugSearch() {
    const q = '%DKR%';
    try {
        const query = `
      SELECT 
        p.id, 
        p.num_parcel, 
        p.nicad, 
        p.status,
        COALESCE(i.prenom || ' ' || i.nom, 'Groupement', 'Inconnu') as owner_name
      FROM parcels p
      LEFT JOIN individual_surveys i ON p.num_parcel = i.num_parcel
      LEFT JOIN collective_surveys c ON p.num_parcel = c.num_parcel
      WHERE 
        p.num_parcel ILIKE $1 OR 
        p.nicad ILIKE $1 OR
        i.nom ILIKE $1
      LIMIT 10
    `;

        console.log('Running query...');
        const result = await pool.query(query, [q]);
        console.log('Result:', result.rows);
        pool.end();
    } catch (err) {
        console.error('SQL Error:', err);
        pool.end();
    }
}

debugSearch();
