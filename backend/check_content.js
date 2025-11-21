
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkContent() {
    try {
        const res = await pool.query(`
      SELECT cas_de_personne_001, num_parcel 
      FROM collective_surveys 
      LIMIT 5
    `);
        console.log('Content of cas_de_personne_001:', res.rows);
        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkContent();
