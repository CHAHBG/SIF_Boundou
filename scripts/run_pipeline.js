const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { findLatestSurveyFiles, findLatestNicadFile, findGeometryFile } = require('./find_latest_data');

// Configuration
const PYTHON_PATH = path.join(__dirname, '../.venv/Scripts/python.exe'); // Adjust if needed
const LOG_DIR = path.join(__dirname, '../backend/logs');

if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

function log(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(path.join(LOG_DIR, 'pipeline.log'), logMessage + '\n');
}

function runCommand(command, args, description) {
    return new Promise((resolve, reject) => {
        log(`Create Process: ${description}`);
        log(`Command: ${command} ${args.join(' ')}`);

        const p = spawn(command, args, { shell: true }); // shell: true for better Windows compatibility

        p.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) log(`[${description}] ${line.trim()}`);
            });
        });

        p.stderr.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                if (line.trim()) log(`[${description} ERROR] ${line.trim()}`);
            });
        });

        p.on('close', (code) => {
            if (code === 0) {
                log(`${description} completed successfully.`);
                resolve();
            } else {
                log(`${description} failed with code ${code}.`);
                reject(new Error(`${description} failed with code ${code}`));
            }
        });
    });
}

async function runPipeline() {
    log('='.repeat(80));
    log('🚀 AUTOMATED DATA UPDATE PIPELINE STARTED');
    log('='.repeat(80));

    try {
        // 1. Identification
        log('🔍 Step 1: Identifying latest data files...');
        const surveys = findLatestSurveyFiles();
        const nicadPath = findLatestNicadFile();
        const geometryPath = findGeometryFile();

        if (!surveys || !nicadPath || !geometryPath) {
            throw new Error("Missing required data files. Aborting pipeline.");
        }

        log(`   Survey (Indiv): ${surveys.individual}`);
        log(`   Survey (Coll):  ${surveys.collective}`);
        log(`   Nicad:          ${nicadPath}`);
        log(`   Geometry:       ${geometryPath}`);

        // 2. Merge Geometries (Python)
        // merge_nicad_raw.py --nicad "..." --geometry "..."
        log('\n🔄 Step 2: Merging Geometries...');
        await runCommand(PYTHON_PATH, [
            path.join(__dirname, 'merge_nicad_raw.py'),
            '--nicad', `"${nicadPath}"`,
            '--geometry', `"${geometryPath}"`
        ], 'Merge_Script');

        // 3. Upload to Postgres (Python)
        log('\n📤 Step 3: Uploading to PostgreSQL...');
        await runCommand(PYTHON_PATH, [
            path.join(__dirname, 'upload_to_postgres.py')
            // upload_to_postgres.py currently hardcodes the input file to data/merged_parcels.gpkg
            // which is whre merge_nicad_raw.py outputs to.
        ], 'Upload_Script');

        // 4. Import Surveys (Node)
        log('\nblob Step 4: Importing Survey Data...');
        await runCommand('node', [
            path.join(__dirname, 'import_surveys.js'),
            `"${surveys.individual}"`,
            `"${surveys.collective}"`
        ], 'Import_Surveys');

        // 5. Import Nicad Attributes (Node)
        log('\n🏷️ Step 5: Importing Nicad Attributes...');
        await runCommand('node', [
            path.join(__dirname, 'import_nicad.js'),
            `"${nicadPath}"`
        ], 'Import_Nicad');

        log('\n✅ PIPELINE COMPLETED SUCCESSFULLY');

    } catch (error) {
        log(`\n❌ PIPELINE FAILED: ${error.message}`);
        process.exit(1);
    }
}

if (require.main === module) {
    runPipeline();
}

module.exports = { runPipeline };
