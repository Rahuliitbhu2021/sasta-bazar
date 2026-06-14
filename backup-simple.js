const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const backupDir = path.join(__dirname, 'backups');
if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir);

const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
const backupFile = path.join(backupDir, `backup_${timestamp}.json`);

// Supabase connection details
const SUPABASE_URL =' https://zxunkltmnncmrwneudlq.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4dW5rbHRtbm5jbXJ3bmV1ZGxxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzMTk1OTksImV4cCI6MjA5Njg5NTU5OX0.qPae_mTWsLSpHsEzLb6eyeui_iDdgc6UgIqyGhCInZA';

// Alternative backup using Supabase REST API
async function backupViaAPI() {
    console.log('🔄 Starting backup via Supabase API...');
    
    const tables = ['customers', 'products', 'bills', 'commissions', 'wallet_transactions'];
    const backupData = {};
    
    for (const table of tables) {
        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=*`, {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                }
            });
            const data = await response.json();
            backupData[table] = data;
            console.log(`✅ ${table}: ${data.length} records`);
        } catch (err) {
            console.log(`❌ ${table}: Failed - ${err.message}`);
            backupData[table] = [];
        }
    }
    
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    console.log(`✅ Backup saved to: ${backupFile}`);
    console.log(`📊 Size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
}

backupViaAPI();