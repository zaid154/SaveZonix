# SaveZonix — Monorepo

A premium all-in-one video download, stream capture, and cinema playback platform.

## Repository Structure

```
SaveZonix/
├── SaveZonix-Web/        # Website & Cloud Backend (MERN Stack)
│   ├── client/           # React + Vite Frontend (Deploy → Vercel)
│   └── server/           # Express + MongoDB API  (Deploy → Render)
│
└── SaveZonix-App/        # Desktop Engine & Chrome Extension (.NET 10)
    ├── Controllers/      # MVC Admin & Account Controllers
    ├── Core/             # Parallel Downloader, M3U8 Parser, Media Validator
    ├── Extension/        # Chrome Extension (auto video detection)
    ├── Views/            # Razor Admin Dashboard
    ├── wwwroot/          # Frontend UI (app.js, playlist.js, cinema player)
    ├── Program.cs        # API endpoints & download engine
    └── Zonix.csproj      # .NET 10 project file
```

---

## Quick Start

### 1. Desktop App (SaveZonix-App)

```bash
cd SaveZonix-App
dotnet restore
dotnet run
# Open: http://localhost:5000
```

### 2. Website Frontend (SaveZonix-Web/client)

```bash
cd SaveZonix-Web/client
npm install
npm run dev
# Open: http://localhost:5173
```

### 3. Cloud API Server (SaveZonix-Web/server)

```bash
cd SaveZonix-Web/server
cp .env.example .env    # Edit with your MongoDB URI & JWT secret
npm install
npm start
# API: http://localhost:5001
```

### 4. Chrome Extension

1. Open Chrome → `chrome://extensions/`
2. Enable **Developer mode**
3. Click **Load unpacked** → Select `SaveZonix-App/Extension`

---

## Deployment

| Component           | Platform | Root Directory           |
|---------------------|----------|--------------------------|
| Landing Site        | Vercel   | `SaveZonix-Web/client`   |
| Cloud API           | Render   | `SaveZonix-Web/server`   |
| Desktop Installer   | GitHub Releases | N/A              |

---

## Key Features

- ⚡ **64-Thread Parallel Downloads** — Hyper-fast multi-threaded byte-range slicing
- 🎬 **4K Cinema Player** — Immersive built-in media player with HDR support
- 🔄 **HLS/M3U8 Live Capture** — Rolling live stream recording via FFmpeg
- 🌐 **Chrome Extension** — Auto-detect videos on 50+ platforms
- 🚀 **Remote App Config** — `/api/app-config` endpoint for 50k+ desktop users
- 💎 **VIP Monetization** — Daily download limits, 4K lock, and announcements
- 🔐 **JWT Authentication** — Secure login with Google OAuth support

---

## License

Private — All rights reserved.
