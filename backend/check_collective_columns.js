
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

async function checkCollectiveColumns() {
    try {
        const res = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'collective_surveys'
      ORDER BY column_name;
    `);

        let report = '--- Collective Surveys Columns ---\n';
        res.rows.forEach(r => {
            report += `${r.column_name} (${r.data_type})\n`;
        });
        report += '----------------------------------\n';

        fs.writeFileSync('collective_columns.txt', report);
        console.log('Report written to collective_columns.txt');

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkCollectiveColumns();
