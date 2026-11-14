# 🚀 SaveZonix — Universal High-Performance Media Downloader Suite

Universal commercial-grade media download ecosystem built with **100% MERN Stack (MongoDB Atlas, Express.js, React.js, Node.js)** and **Chrome Extension (Manifest V3)**.

---

## 🌐 Deployments

| Component | Host | URL |
| :--- | :--- | :--- |
| **Web Portal & Studio** | Vercel | [https://savezonix-pro.vercel.app](https://savezonix-pro.vercel.app) |
| **Admin Dashboard** | Vercel | [https://savezonix-pro.vercel.app/admin/overview](https://savezonix-pro.vercel.app/admin/overview) |
| **Backend API** | Render / Local | [https://savezonix.onrender.com](https://savezonix.onrender.com) (or `http://localhost:5001`) |
| **Chrome Extension** | Chrome Web Store / Unpacked | `extension/` directory |

---

## 🏗️ Clean MERN Architecture

```mermaid
graph TD
    User([User Web Browser]) <--> ReactApp[React 18 + Vite Web Studio\nSingle Downloader, Playlist Studio, Admin Panel]
    Extension[Chrome MV3 Extension] <--> ExpressAPI[Express.js & Socket.IO API\nPort 5001]
    ReactApp <-->|Socket.IO Real-time Events| ExpressAPI
    
    subgraph Engine [Node.js Turbo Media Engine]
        ExpressAPI --> MediaResolver[Media Stream Resolver\n@distube/ytdl-core & play-dl]
        MediaResolver --> TurboDownloader[Turbo Parallel Slicer\n8-32 Micro-burst Sockets]
        TurboDownloader --> FFmpeg[FFmpeg Muxer & MP3 Converter]
    end

    subgraph Database [Database Layer]
        ExpressAPI <--> MongoDB[(MongoDB Atlas\nUsers, VIP, History, Playlists)]
    end
```

---

## 📁 Repository Structure

```
SaveZonix/
├── client/              # React 18 + Vite Frontend (Landing, DownloadStudio, Admin)
│   ├── src/
│   │   ├── components/  # DownloadStudio, AdminDashboard, Navbar, etc.
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── package.json
│
├── server/              # Node.js + Express + Socket.IO Backend
│   ├── controllers/     # downloadController, playlistController, adminController
│   ├── models/          # User, DownloadHistory, PlaylistQueue, AppConfig
│   ├── routes/          # downloads, playlist, auth, admin, payment
│   ├── services/        # TurboDownloader, MediaResolver, FFmpegService
│   ├── server.js        # Main Express server with Socket.IO
│   └── package.json
│
├── extension/           # Chrome Extension (Manifest V3)
│   ├── manifest.json
│   ├── src/             # popup, content script, background service worker
│   └── icons/
│
├── branding/            # Logos, banners, visual assets
├── vercel.json          # Vercel deployment configuration
└── package.json         # Unified Monorepo Workspaces Configuration
```

---

## ⚡ Quick Start

### 1. Install All Dependencies
```bash
npm run install:all
```

### 2. Run Both Server & React Client Concurrently
```bash
npm run dev
```

### 3. Run Server Only (Production Mode)
```bash
npm run server
```
* Access Web Portal at: `http://localhost:5001` (or `http://localhost:5173` in Vite dev mode).
* Real-time Socket.IO streams live progress on `http://localhost:5001/socket.io`.

---

## 🛡️ Security & Performance Highlights
* **Zero-RAM Slicing:** Micro-burst parallel range downloads directly to disk with dynamic chunking.
* **100% Cloud Persistence:** MongoDB Atlas automatically tracks history, users, and VIP payment tiers.
* **Direct Web Downloading:** Users can download media directly in their browser without installing any desktop software or unzipping files.
