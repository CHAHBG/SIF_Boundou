// Script to optimize database by adding indexes
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function optimizeDatabase() {
  console.log('🚀 Starting database optimization...\n');

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'optimize-db.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split by semicolons and execute each statement
    const statements = sql.split(';').filter(s => s.trim().length > 0);

    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.substring(0, 60).trim() + '...');
        await pool.query(statement);
      }
    }

    console.log('\n✅ Database optimization completed successfully!');
    console.log('📊 Indexes have been created for faster queries.');
    console.log('⚡ Parcel detail fetching should now be significantly faster.');

  } catch (err) {
    console.error('❌ Error during optimization:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

optimizeDatabase();
