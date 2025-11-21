const { Pool } = require('pg');

const connectionString = 'postgresql://neondb_owner:npg_jE36dGYAocfv@ep-wild-base-ab7csm1o-pooler.eu-west-2.aws.neon.tech/BoundouGeoportal?sslmode=require';

const pool = new Pool({
    connectionString,
    ssl: {
        rejectUnauthorized: false // Neon requires SSL
    }
});

async function checkConnection() {
    try {
        const client = await pool.connect();
        console.log('Connected to Neon DB successfully!');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0].now);

        // Check if tables exist
        const tables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public'
    `);
        console.log('Existing tables:', tables.rows.map(r => r.table_name));

        client.release();
    } catch (err) {
        console.error('Connection failed:', err);
    } finally {
        pool.end();
    }
}

checkConnection();
