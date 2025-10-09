    // --- All Required Imports ---
    let express, createProxyMiddleware, pty, bodyParser, helmet, cors, mime;
    try {
        express = require('express');
        ({ createProxyMiddleware } = require('http-proxy-middleware'));
        pty = require("node-pty");
        bodyParser = require("body-parser");
        helmet = require("helmet");
        cors = require('cors');
        mime = require('mime-types'); // <-- ADD THIS
    } catch (error) {
        console.error("A required module is not installed. Please run `npm install`.", error.message);
        process.exit(1);
    }

    const { spawn } = require('child_process');
    const https = require('https');
    const path = require('path');
    const fs = require('fs');


    // --- Part 0: Environment and Configuration ---
    const projectPath = process.env.PROJECT_PATH || '/opt/render/project/src/'; //'/workspaces/RenderStorage/'
    const publicPort = process.env.PORT || 8080;
    const filebrowserPort = 8081;
    const keepAliveUrl = process.env.RENDER_EXTERNAL_URL;


    // --- Part 1: Start Backend Services (File Browser + PTY) ---
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
        p.onData((data) => {
            for (const client of sseClients) {
                client.write(`data: ${JSON.stringify(data)}\n\n`);
            }
        });
        p.onExit(({ exitCode }) => {
            console.error(`PTY process exited with code ${exitCode}. Restarting...`);
            setTimeout(createPtyProcess, 1000);
        });
        ptyProcess = p;
    }
    createPtyProcess();


    // --- Part 2: Create the Main Express Server and Define Routes ---
    const app = express();

    app.use(cors());
    app.use(helmet({
        contentSecurityPolicy: false,
        xFrameOptions: false
    }));

    // --- NEW AND IMPROVED /raw ROUTE ---
    // This middleware handles requests with ?inline=true for any file type.
    app.use('/raw', (req, res, next) => {
        // Only apply this logic if the query parameter is present
        if (req.query.inline !== 'true') {
            // If not, skip to the next middleware (the standard file server)
            return next();
        }

        const filePath = path.join(projectPath, req.path);

        // Read the file as a raw buffer (works for text and binary)
        fs.readFile(filePath, (err, data) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    return res.status(404).type('text').send('File not found.');
                }
                return res.status(500).type('text').send('Error reading the file.');
            }

            // Use the mime-types library to get the correct content-type
            const contentType = mime.lookup(filePath) || 'application/octet-stream';

            // Set the header and send the file data
            res.setHeader('Content-Type', contentType);
            res.send(data);
        });
    });

    // This serves files from /raw for normal requests (without ?inline=true)
    app.use('/raw', express.static(projectPath));


    // --- Terminal Routes ---
    const terminalRouter = express.Router();
    terminalRouter.use(express.static(path.join(__dirname, "public")));
    terminalRouter.use("/xterm.js", express.static(path.join(__dirname, "node_modules/xterm/lib/xterm.js")));
    terminalRouter.use("/xterm.css", express.static(path.join(__dirname, "node_modules/xterm/css/xterm.css")));
    terminalRouter.get("/events", (req, res) => {
        res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" });
        res.flushHeaders();
        sseClients.add(res);
        const heartbeat = setInterval(() => res.write(":heartbeat\n\n"), 25000);
        req.on("close", () => {
            clearInterval(heartbeat);
            sseClients.delete(res);
        });
    });
    terminalRouter.post("/input", express.text({ type: '*/*' }), (req, res) => {
        if (ptyProcess) ptyProcess.write(req.body);
        res.status(204).end();
    });
    terminalRouter.post("/resize", express.json(), (req, res) => {
        try {
            const { cols, rows } = req.body;
            if (ptyProcess && Number.isInteger(cols) && Number.isInteger(rows)) ptyProcess.resize(cols, rows);
            res.status(204).end();
        } catch {
            res.status(400).send('Invalid JSON for resize.');
        }
    });
    app.use('/terminal', terminalRouter);


    // --- Proxy Route ---
    app.use('/', createProxyMiddleware({
        target: `http://127.0.0.1:${filebrowserPort}`,
        changeOrigin: true,
        ws: true,
        onProxyRes: function (proxyRes, req, res) {
            proxyRes.headers['Access-Control-Allow-Origin'] = '*';
            proxyRes.headers['Access-Control-Allow-Methods'] = '*';
            proxyRes.headers['Access-Control-Allow-Headers'] = '*';
            proxyRes.headers['Access-Control-Allow-Credentials'] = 'true';
            proxyRes.headers['Access-Control-Expose-Headers'] = '*';
            proxyRes.headers['Cross-Origin-Embedder-Policy'] = 'unsafe-none';
            proxyRes.headers['Cross-Origin-Opener-Policy'] = 'unsafe-none';
            proxyRes.headers['Cross-Origin-Resource-Policy'] = 'cross-origin';
            proxyRes.headers['X-Frame-Options'] = 'ALLOWALL';
        }
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
            }, 10 * 1000); // Every 10 seconds
        } else {
            console.log("Skipping keep-alive task: RENDER_EXTERNAL_URL not set.");
        }
    }


    // --- Part 4: Start Server and Post-Start Logic ---
    app.listen(publicPort, '0.0.0.0', () => {
        console.log(`--- Main server is live on http://0.0.0.0:${publicPort} ---`);
        setTimeout(() => {
            setupPeriodicTasks();
        }, 500);
    });