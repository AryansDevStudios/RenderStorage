// --- All Required Imports ---
const { spawn } = require('child_process');
const https = require('https');
const path = 'path';
const fs = 'fs';
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const pty = require("node-pty");
const helmet = require("helmet");

// --- Part 0: Environment and Configuration ---
const projectPath = process.env.PROJECT_PATH || '/opt/render/project/src/';
const publicPort = process.env.PORT || 8080;
const filebrowserPort = 8081;
const keepAliveUrl = process.env.RENDER_EXTERNAL_URL; // Use Render's env var for the public URL

// --- Part 1: Start Backend Services (File Browser + PTY) ---

// Start File Browser Service
console.log(`Starting File Browser on internal port ${filebrowserPort}`);
const filebrowser = spawn(path.join(__dirname, 'filebrowser'), [
    '-a', '127.0.0.1',
    '-p', filebrowserPort.toString(),
    '-r', projectPath,
    '--database=' + path.join(__dirname, 'filebrowser.db')
]);

filebrowser.stdout.on('data', (data) => console.log(`[FileBrowser] ${data.toString().trim()}`));
filebrowser.stderr.on('data', (data) => console.error(`[FileBrowser ERROR] ${data.toString().trim()}`));
filebrowser.on('error', (err) => console.error(`Failed to start File Browser: ${err.message}`));
filebrowser.on('close', (code) => console.error(`File Browser process exited with code ${code}`));


// Initialize and manage the web terminal PTY process
console.log('Initializing web terminal PTY process...');
const sseClients = new Set();
let ptyProcess = null;

function createPtyProcess() {
    const termShell = process.env.SHELL || 'bash';
    const args = ['--login'];
    const p = pty.spawn(termShell, args, {
        name: 'xterm-color',
        cols: 80,
        rows: 24,
        cwd: projectPath,
        env: process.env
    });

    // Stream PTY output to all connected SSE clients
    p.onData((data) => {
        for (const client of sseClients) {
            client.write(`data: ${JSON.stringify(data)}\n\n`);
        }
    });

    p.onExit(({ exitCode }) => {
        console.error(`PTY process exited with code ${exitCode}. Restarting...`);
        // Respawn the process after a short delay
        setTimeout(createPtyProcess, 1000);
    });
    
    ptyProcess = p;
}

createPtyProcess(); // Initial start

// --- Part 2: Create the Main Express Server and Define Routes ---
const app = express();

// Basic security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Serve project files directly for raw access
app.use('/raw', express.static(projectPath));

// --- Terminal Routes ---
const terminalRouter = express.Router();
terminalRouter.use(express.static(path.join(__dirname, "public")));
terminalRouter.use("/xterm.js", express.static(path.join(__dirname, "node_modules/xterm/lib/xterm.js")));
terminalRouter.use("/xterm.css", express.static(path.join(__dirname, "node_modules/xterm/css/xterm.css")));

// SSE endpoint for streaming terminal output to the client
terminalRouter.get("/events", (req, res) => {
    res.set({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    });
    res.flushHeaders();

    sseClients.add(res);

    const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 25000);

    req.on("close", () => {
        clearInterval(heartbeat);
        sseClients.delete(res);
    });
});

// Endpoint for receiving user input and writing it to the PTY
terminalRouter.post("/input", express.text({ type: '*/*' }), (req, res) => {
    if (ptyProcess) {
        ptyProcess.write(req.body);
    }
    res.status(204).end();
});

// Endpoint for handling terminal resize events
terminalRouter.post("/resize", express.json(), (req, res) => {
    try {
        const { cols, rows } = req.body;
        if (ptyProcess && Number.isInteger(cols) && Number.isInteger(rows)) {
            ptyProcess.resize(cols, rows);
        }
        res.status(204).end();
    } catch {
        res.status(400).send('Invalid JSON for resize.');
    }
});

app.use('/terminal', terminalRouter);

// --- Proxy Route ---
// Proxy all other requests to the File Browser service
app.use('/', createProxyMiddleware({
    target: `http://127.0.0.1:${filebrowserPort}`,
    changeOrigin: true,
    ws: true
}));

// --- Part 3: Periodic Tasks (Keep-Alive) ---
function setupPeriodicTasks() {
    if (keepAliveUrl) {
        setInterval(() => {
            console.log(`Sending keep-alive ping to ${keepAliveUrl}`);
            https.get(keepAliveUrl, (res) => {
                console.log(`Keep-alive ping status: ${res.statusCode}`);
            }).on('error', (err) => {
                console.error(`Keep-alive ping error: ${err.message}`);
            });
        }, 10 * 60 * 1000); // Ping every 10 minutes
    } else {
        console.log("Skipping keep-alive task: RENDER_EXTERNAL_URL not set.");
    }
}

// --- Part 4: Start Server and Post-Start Logic ---
app.listen(publicPort, '0.0.0.0', () => {
    console.log(`--- Main server is live on http://0.0.0.0:${publicPort} ---`);

    // Use a small timeout to ensure the server is responsive before starting other tasks
    setTimeout(() => {
        setupPeriodicTasks();
    }, 500);
});