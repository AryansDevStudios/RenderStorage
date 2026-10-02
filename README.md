# 📦 RenderStorage

> Cloud storage, file management, and remote workspace hub powered by FileBrowser, Express 5, and an interactive Xterm.js web terminal.

![Node.js](https://img.shields.io/badge/Node.js-v18%2B-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-v5.1.0-000000?logo=express&logoColor=white)
![FileBrowser](https://img.shields.io/badge/FileBrowser-Standalone%20Go-29B6F6)
![Xterm.js](https://img.shields.io/badge/Terminal-Xterm.js%20v5.3-FF6F00)
![Platform](https://img.shields.io/badge/Deploy-Render%20%7C%20Replit-46E3B7)
![Status](https://img.shields.io/badge/Status-Active-brightgreen)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📖 Overview

**RenderStorage** is a cloud storage and remote workspace management platform configured for fast deployment on Render and Replit environments. It couples a native Go FileBrowser binary with an Express 5 orchestrator and reverse proxy, delivering an all-in-one web portal for browsing files, editing code, streaming media, and executing shell commands.

In addition to visual file management, the platform incorporates a browser-based Linux terminal powered by `node-pty`, Server-Sent Events (SSE), and `xterm.js`, raw file serving with automatic MIME detection, and automated keep-alive polling to prevent container idling.

---

## ✨ Features

- **Embedded Standalone FileBrowser**: Seamlessly reverse-proxies native FileBrowser (running on internal port 8081) to the public application port with permissive iframe embedding headers (`X-Frame-Options: ALLOWALL`).
- **Interactive In-Browser Terminal**: Full interactive terminal at `/terminal` driven by a persistent `node-pty` shell process (`bash --login`), featuring real-time SSE output streaming (`/terminal/events`), debounced keystroke posting (`/terminal/input`), and dynamic window resizing.
- **Direct Raw File Streaming**: Dedicated `/raw` endpoint delivering workspace assets with `?inline=true` support for accurate in-browser media rendering (images, video, audio) powered by dynamic `mime-types` detection.
- **Process Resilience & Keep-Alive**: Automatically detects PTY shell exit and restarts terminal sessions; runs an automated 10-second background keep-alive ping loop targeting `RENDER_EXTERNAL_URL` to avoid free-tier container sleep.
- **Pre-Configured Render Environment**: Includes `start.sh` bootstrap script configuring environment paths, setting up the bundled GitHub CLI (`bin/gh`), and validating user permissions.
- **Persistent SQLite Database**: Backed by a local `filebrowser.db` SQLite database retaining user accounts, permissions, and custom filesystem views.

---

## 🛠️ Tech Stack

- **Server & Proxy**: [Node.js](https://nodejs.org/) (v18+), [Express 5](https://expressjs.com/), `http-proxy-middleware`, `cors`, `helmet`
- **File Manager**: [FileBrowser](https://filebrowser.org/) (Standalone Go Binary), SQLite (`filebrowser.db`)
- **Terminal Emulator**: [xterm.js](https://xtermjs.org/) v5.3.0, `node-pty`, Server-Sent Events (SSE)
- **Deployment & Tooling**: Render, Replit, GitHub CLI (`bin/gh`), Bash

---

## 📁 Project Structure

```
RenderStorage/
├── bin/
│   └── gh                    # Bundled GitHub CLI binary
├── filebrowser               # Native standalone FileBrowser executable
├── filebrowser.db            # SQLite database for FileBrowser settings & users
├── package.json              # Node.js dependencies and scripts
├── public/
│   └── index.html            # Web terminal frontend UI powered by Xterm.js
├── replit.md                 # Replit and Render deployment architecture notes
├── start.js                  # Express 5 server, proxy, PTY & raw file endpoints
└── start.sh                  # Bootstrap and environment provisioning script
```

---

## 🚀 Getting Started

### Prerequisites

- Linux container / environment (Render, Replit, or local Linux machine)
- Node.js `18.x` or later
- npm or yarn

### 1. Clone Repository

```bash
git clone https://github.com/AryansDevStudios/RenderStorage.git
cd RenderStorage
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables (Optional)

Configure your target port and workspace directory in your environment:

```bash
export PORT=5000
export PROJECT_PATH=$(pwd)
export RENDER_EXTERNAL_URL="https://your-app.onrender.com" # For keep-alive
```

### 4. Start Application

Using Node.js:

```bash
node start.js
```

Or using the Render bootstrap script:

```bash
chmod +x start.sh filebrowser bin/gh
./start.sh
```

---

## 🌐 Endpoints & Access

| Path | Description |
|------|-------------|
| `/` | Standalone FileBrowser web interface for file uploading, editing, and sharing |
| `/terminal` | Full-screen interactive Xterm.js terminal connected to host shell |
| `/raw/<filepath>` | Stream raw files with proper MIME content types (`?inline=true` for browser display) |
| `/ping` | Lightweight health-check endpoint for uptime monitors |

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to open an issue or submit a pull request.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
