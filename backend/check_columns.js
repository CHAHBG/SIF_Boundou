require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const query = `
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'beneficiaries';
`;

pool.query(query)
  .then(res => {
    console.log('Columns in mandataries:', res.rows.map(r => r.column_name));
    pool.end();
  })
  .catch(err => {
    console.error(err);
    pool.end();
  });
