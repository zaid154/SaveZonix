const path = require('path');
const http = require('http');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const adminRoutes = require('./routes/admin');
const extensionUpdatesRoutes = require('./routes/extension-updates');
const paymentRoutes = require('./routes/payment');
const playlistRoutes = require('./routes/playlist');
const downloadsRoutes = require('./routes/downloads');
const feedbackRoutes = require('./routes/feedback');
const downloadManager = require('./services/DownloadManager');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  }
});

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/SaveZonixDb';

// Wire real-time Socket.IO to DownloadManager
downloadManager.setSocketIO(io);

io.on('connection', (socket) => {
  console.log(`[Socket.IO] 🔌 Client connected: ${socket.id}`);
  socket.on('disconnect', () => {});
});

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));
app.use(express.json({ limit: '50mb' }));

// Static downloads directory for file downloads
const downloadsDir = path.resolve(__dirname, '../downloads');
app.use('/api/downloads/file', express.static(downloadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/app-config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/telemetry', adminRoutes);
app.use('/api/playlist', playlistRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/extension-updates.xml', extensionUpdatesRoutes);

// Health Check
const healthHandler = (req, res) => {
  res.json({
    status: 'ok',
    version: '2.5.4',
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    connectedClients: io.engine.clientsCount,
    timestamp: new Date()
  });
};
app.get('/api/health', healthHandler);
app.get('/api/system/health', healthHandler);

// Serve React SPA Frontend
const clientDist = path.resolve(__dirname, '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/socket.io')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('⚡ SaveZonix MERN Core API & Download Engine is Live.');
  });
}

// Start HTTP + Socket.IO Server
server.listen(PORT, () => {
  console.log(`[SaveZonix Server] 🚀 MERN Server running on http://localhost:${PORT}`);
});

// Connect to MongoDB asynchronously
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 5000 })
  .then(() => {
    console.log(`[SaveZonix Server] 🍃 Connected to MongoDB: ${MONGO_URI}`);
  })
  .catch((err) => {
    console.warn(`[SaveZonix Server] ⚠️ MongoDB connection notice: ${err.message} (Running in fallback mode)`);
  });
