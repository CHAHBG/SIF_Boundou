const cron = require('node-cron');
const { runPipeline } = require('../scripts/run_pipeline');
const path = require('path');

function initScheduler() {
    console.log('⏰ Initializing Data Update Scheduler...');

    // Schedule: Every day at 02:00 AM
    // Cron format: Minute Hour DayOfMonth Month DayOfWeek
    cron.schedule('0 2 * * *', async () => {
        console.log('⏰ Triggering scheduled data update...');
        // Run as a child process to avoid blocking the main event loop and isolate failures
        // Alternatively, since runPipeline uses spawn internally, we can call it directly 
        // if we want it to run in the same process context (but separate threads/processes for the actual work)
        // For robustness, usually triggering the script file via node is safer.

        const { spawn } = require('child_process');
        const scriptPath = path.join(__dirname, '../scripts/run_pipeline.js');

        const p = spawn('node', [scriptPath], { stdio: 'inherit' });

        p.on('close', (code) => {
            console.log(`⏰ Scheduled update finished with code ${code}`);
        });
    });

    console.log('   ✅ Scheduled to run daily at 02:00 AM');
}

module.exports = { initScheduler };
