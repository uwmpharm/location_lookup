const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function sendJson(res, statusCode, payload) {
    res.writeHead(statusCode, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, x-secret',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    });
    res.end(JSON.stringify(payload));
}

function runScript(scriptName, res) {
    const scriptPath = path.join(__dirname, scriptName);
    const child = spawn(process.execPath, [scriptPath], {
        cwd: __dirname,
        stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
        stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
        stderr += data.toString();
    });

    child.on('close', (code) => {
        if (code !== 0) {
            console.error(`Failed to run ${scriptName}:`, stderr || stdout);
            sendJson(res, 500, { ok: false, error: stderr || stdout || 'Unknown error' });
            return;
        }

        console.log(`[trigger-cache] ${scriptName} completed`);
        if (stdout) console.log(stdout.trim());
        sendJson(res, 200, { ok: true, message: 'Cache and JSON refresh complete' });
    });
}

const server = http.createServer((req, res) => {
    if (req.method === 'OPTIONS') {
        sendJson(res, 204, {});
        return;
    }

    if (req.method === 'POST' && req.url === '/update-cache') {
        runScript('static-data.js', res);
        return;
    }

    if (req.method === 'POST' && req.url === '/admin-auth') {
        let body = '';
        req.on('data', (chunk) => {
            body += chunk;
        });
        req.on('end', () => {
            try {
                const { password } = JSON.parse(body || '{}');
                console.log('[admin-auth] received password:', password);
                console.log('[admin-auth] configured password:', ADMIN_PASSWORD);
                if (password === ADMIN_PASSWORD) {
                    sendJson(res, 200, { ok: true, message: 'Authorized' });
                } else {
                    sendJson(res, 401, { ok: false, error: 'Incorrect password' });
                }
            } catch (error) {
                sendJson(res, 400, { ok: false, error: 'Invalid request body' });
            }
        });
        return;
    }

    sendJson(res, 401, { ok: false, error: 'Unauthorized' });
});

server.listen(3001, '0.0.0.0', () => console.log('Trigger server running on port 3001'));