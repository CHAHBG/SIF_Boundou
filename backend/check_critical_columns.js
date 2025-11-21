
require('dotenv').config();
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/geoportail',
});

const fs = require('fs');

async function checkCriticalColumns() {
    try {
        const checks = [
            { table: 'individual_surveys', col: 'prenom' },
            { table: 'individual_surveys', col: 'nom' },
            { table: 'collective_surveys', col: 'nom_groupement' },
            { table: 'collective_surveys', col: 'nom' } // Check if maybe it's just 'nom' for collectives too
        ];

        let report = '--- Column Check Report ---\n';
        for (const check of checks) {
            const res = await pool.query(`
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = $1 AND column_name = $2
      `, [check.table, check.col]);

            const exists = res.rows.length > 0;
            report += `${check.table}.${check.col}: ${exists ? 'EXISTS' : 'MISSING'}\n`;
        }
        report += '---------------------------\n';

        fs.writeFileSync('report.txt', report);
        console.log('Report written to report.txt');

        pool.end();
    } catch (err) {
        console.error(err);
        pool.end();
    }
}

checkCriticalColumns();
