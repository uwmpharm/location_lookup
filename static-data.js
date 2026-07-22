const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://iynuqsbgnshlromwkzfl.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5bnVxc2JnbnNobHJvbXdremZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU1MDQ5NzcsImV4cCI6MjA5MTA4MDk3N30.SGvfrCXQbgbZk_ptt97R3sYGetFdB6KfRmJvoF1LpGI';
global.WebSocket = WebSocket;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
const tables = ['test_dms_extsys_item_valid', 'test_wms_iv_f', 'test_wms_lc_f'];
const outputDir = __dirname;

async function fetchRecords(table) {
    const allRecords = [];
    const batchSize = 1000;
    let index = 0;

    while (true) {
        const { data, error } = await sb.from(table).select('*').range(index, index + batchSize - 1);
        if (error) {
            console.error(`Error fetching data from ${table}:`, error);
            break;
        }
        if (!data || data.length === 0) {
            break;
        }
        allRecords.push(...data);
        if (data.length < batchSize) {
            break;
        }
        index += batchSize;
    }
    return allRecords;
}
async function main() {
    for (const table of tables) {
        const data = await fetchRecords(table);
        const outputPath = path.join(outputDir, `${table}.json`);
        fs.writeFileSync(outputPath, JSON.stringify(data, null, 2));
        console.log(`Data from ${table} has been written to ${outputPath} (${data.length} rows)`);
    }
}

main();