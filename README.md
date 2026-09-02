# ⚡ SaveZonix (v2.5) — Enterprise Multi-Thread Video Downloader & Stream Engine

**SaveZonix** is an ultra-fast, multi-threaded video downloading, live media recording, and stream muxing engine built with **.NET 10 (C#)**, **Docker**, **FFmpeg**, and a high-performance **Chrome Extension (Manifest V3)**.

---

## 🌟 Supported Platforms & Protocols

| Platform / Protocol | Features Supported | Extraction Mechanism |
| :--- | :--- | :--- |
| **YouTube** | 8K Ultra HD, 4K, 1080p 60fps, Opus/AAC Audio | Extension Decrypted Stream + Docker FFmpeg Muxing |
| **Instagram Reels / Posts** | 1080p Vertical Reels + High-Bitrate Stereo Audio | Active-Viewport Sniffer + DASH Audio/Video Merger |
| **Facebook Video / Watch** | 1080p / 720p HD MP4 | Direct CDN Stream Sniffer |
| **TikTok / X / Reddit** | Watermark-free MP4 | Adaptive Stream Interceptor |
| **Adult Video Portals** *(Pornhub, XHamster, etc.)* | 1080p, 720p Full HD Multi-part Streams | High-Concurrency Binary Chunk Merger (16-64 threads) |
| **HLS (m3u8) & MPEG-DASH** | Master playlist multi-bitrate selection | Automatic TS & MP4 Segment Assembly |

---

## 🏗️ System Architecture

```
                               ┌───────────────────────────┐
                               │   SAVEZONIX ARCHITECTURE  │
                               └─────────────┬─────────────┘
                                             │
                   ┌─────────────────────────┴─────────────────────────┐
                   ▼                                                   ▼
 ┌───────────────────────────────────┐               ┌───────────────────────────────────┐
 │       CHROME EXTENSION (MV3)      │               │   ASP.NET CORE 10 + DOCKER BACKEND│
 ├───────────────────────────────────┤               ├───────────────────────────────────┤
 │ • Active Viewport Reel Sniffer    │               │ • Multi-Thread Parallel Downloader│
 │ • Network Stream Sniffer (m3u8/mp4)│ ── Bridge ──▶ │ • FFmpeg Video + Audio Remuxer    │
 │ • YouTube In-Page Token Decryptor │               │ • SQLite + MongoDB Hybrid History │
 │ • Standalone In-Tab Downloader    │               │ • Proxy Image Cache Engine        │
 └───────────────────────────────────┘               └───────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### Option 1: Run with Docker Compose (Recommended) 🐳

Docker provides an isolated Linux environment with pre-installed **FFmpeg** and **.NET 10 Runtime**:

1. **Start Docker Desktop** on your computer.
2. Run the following command in the project root:
   ```bash
   docker compose up --build -d
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:5000
   ```
4. **View Live Logs**:
   ```bash
   docker compose logs -f
   ```
5. **Stop Container**:
   ```bash
   docker compose down
   ```

---

### Option 2: Local .NET CLI Execution 💻

1. Ensure **.NET 10 SDK** is installed.
2. Build and run the Release version:
   ```bash
   dotnet build -c Release
   dotnet run -c Release --no-build
   ```
3. Open **`http://localhost:5000`** in your browser.

---

### Option 3: Install the SaveZonix Chrome Extension 🧩

1. Open Google Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** in the top-right corner.
3. Click **Load unpacked** and select the `Extension/` folder from this repository.
4. Navigate to any video site (Instagram, YouTube, etc.), play the video, and click the SaveZonix toolbar icon to download.

---

## 🛠️ Key Technical Implementations

### 1. Instagram DASH Separate Video + Audio Muxing
Instagram serves video (`mime=video/mp4`) and audio (`mime=audio/mp4`) tracks as distinct URLs. SaveZonix intercepts both streams via `service-worker.js`, passes the `audioUrl` through the pipeline, and merges them using FFmpeg inside the Docker backend:
```bash
ffmpeg -i video.mp4 -i audio.mp4 -c:v copy -c:a aac -map 0:v:0 -map 1:a:0? -movflags +faststart output.mp4 -y
```

### 2. High-Concurrency Parallel Chunk Downloader
- Uses `SocketsHttpHandler` with connection pooling (16 to 64 parallel threads).
- Automatically splits direct MP4 and HLS streams into binary `.part` byte ranges.
- Seamlessly falls back to single progressive stream if CDNs reject chunked range requests.

### 3. Image Proxy Endpoint (`/api/proxy-image`)
- Replaced streaming disposal quirks with `ReadAsByteArrayAsync` and `Results.Bytes`.
- Solves HTTP 500 errors when loading YouTube/Instagram CDN thumbnails.

---

## 🔍 Changelog & Problem Solutions

| Problem | Root Cause | Solution Implemented |
| :--- | :--- | :--- |
| **Instagram Reel Missing Sound** | Instagram DASH serves audio on a separate CDN track | Captured `audioUrl` in Extension sniffer & remuxed with FFmpeg |
| **Background Ads Downloaded on Instagram** | Preloaded Facebook ads intercepted by network listener | Filtered for the active visible `<video>` element in the viewport |
| **YouTube Thumbnail 500 Error** | Stream disposed prematurely during Kestrel chunking | Converted proxy to buffered byte array (`Results.Bytes`) |
| **YouTube Cipher Protection** | Server-side scrapers blocked by signature cipher | Leveraged in-browser Extension context for decrypted streams |
| **Windows App Control / Locking** | File lock on `Zonix.exe` during background execution | Configured Docker containerized deployment with volume mounts |

---

## 📂 Project Structure

```
Zonix/
├── Zonix.csproj               # .NET 10 ASP.NET Core Project Config
├── Program.cs                 # REST API, Image Proxy & Download Controller
├── Dockerfile                 # Multi-stage Docker build with FFmpeg
├── docker-compose.yml         # Container orchestration config
├── README.md                  # System Documentation
├── Core/
│   ├── ParallelDownloader.cs  # High-speed multi-threaded downloader
│   ├── SegmentMerger.cs       # Binary FileStream & FFmpeg remuxer
│   ├── MediaValidator.cs      # Integrity checker (ftyp/moov/tracks)
│   ├── M3U8Parser.cs          # HLS/M3U8 master playlist parser
│   └── StreamSecurityHelper.cs# Anti-403 header & token manager
├── wwwroot/
│   ├── index.html             # Cyberpunk Glassmorphism UI
│   ├── style.css              # Frontend Styling
│   └── app.js                 # Real-time Speed, ETA & Download Manager
└── Extension/
    ├── manifest.json          # Chrome MV3 configuration
    ├── src/
    │   ├── background/        # Service worker & network sniffer
    │   ├── popup/             # Extension UI popup
    │   ├── sites/             # Instagram & YouTube site extractors
    │   └── downloader/        # In-browser session downloader
```

---

## ⚖️ License & Disclaimer

SaveZonix is built for personal archiving, educational research, and offline media streaming analysis. Please adhere to the terms of service of respective media platforms.
