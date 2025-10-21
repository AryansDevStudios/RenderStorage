# File Browser & Web Terminal

## Overview
This is a web-based file management and terminal application built with Node.js and Express. It provides:
- **File Browser**: A web interface to browse, upload, download, and manage files
- **Web Terminal**: An interactive terminal accessible through the browser using xterm.js

## Project Architecture

### Core Components
1. **Express Server** (port 5000): Main web server that handles all HTTP requests
2. **File Browser Binary** (port 8081): Native file manager running internally
3. **PTY Process**: Pseudo-terminal that powers the web terminal

### Key Files
- `start.js`: Main application entry point
- `filebrowser`: Standalone file browser binary
- `filebrowser.db`: SQLite database for file browser settings
- `public/index.html`: Web terminal UI

### Technology Stack
- **Backend**: Node.js, Express.js
- **Terminal**: node-pty, xterm.js
- **Proxy**: http-proxy-middleware
- **Security**: helmet, cors
- **File Management**: FileBrowser binary

## How It Works

1. **File Browser**: 
   - Runs as a separate process on port 8081
   - Proxied through the main server at port 5000
   - Provides file management capabilities (browse, upload, download, delete, etc.)

2. **Web Terminal**: 
   - Accessible at `/terminal/`
   - Uses Server-Sent Events (SSE) for real-time output
   - Spawns a PTY process with bash/shell
   - Supports resize and input commands

3. **Raw File Access**:
   - `/raw/` endpoint serves files directly
   - Supports `?inline=true` parameter for proper MIME type handling

## Configuration

### Environment Variables
- `PORT`: Server port (default: 5000)
- `PROJECT_PATH`: Root directory for file browser (default: current working directory)
- `RENDER_EXTERNAL_URL`: Optional URL for keep-alive pings

### Ports
- **5000**: Main web server (public)
- **8081**: File browser (internal only)


## Manual Setup (if needed)
If dependencies are missing, install them with:
```bash
npm install
```

### Deployment
Configured for VM deployment to maintain persistent state:
```bash
node start.js
```

## Security & CORS

### Current Configuration
The application is configured to work in embedded contexts (iframes):
- CORS enabled for all origins
- X-Frame-Options set to ALLOWALL
- Content Security Policy disabled for compatibility
- Cross-Origin headers configured for embedding

### ⚠️ Security Warning
**This configuration is designed for development/demo use and internal tools.** 

For production deployments, consider:
- Restricting CORS to specific trusted origins
- Re-enabling Content Security Policy
- Adding authentication/authorization (the file browser and terminal are publicly accessible)
- Limiting X-Frame-Options to specific domains
- Using environment-specific security configurations

## Notes

- The File Browser uses SQLite (`filebrowser.db`) for storing settings
- The terminal PTY process auto-restarts if it crashes
- Keep-alive pings are optional (only if RENDER_EXTERNAL_URL is set)
- All dependencies are managed via npm



