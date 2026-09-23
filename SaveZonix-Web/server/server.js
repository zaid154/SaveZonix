const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const configRoutes = require('./routes/config');
const adminRoutes = require('./routes/admin');
const extensionUpdatesRoutes = require('./routes/extension-updates');
const paymentRoutes = require('./routes/payment');
const playlistRoutes = require('./routes/playlist');
const downloadsRoutes = require('./routes/downloads');

const app = express();
const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/SaveZonixDb';

// Middleware
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key']
}));
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/app-config', configRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/telemetry', adminRoutes);
app.use('/api/playlist', playlistRoutes);
app.use('/api/downloads', downloadsRoutes);
app.use('/api/extension-updates.xml', extensionUpdatesRoutes);

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime(),
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date()
  });
});

// Root Welcome
app.get('/', (req, res) => {
  res.send('⚡ SaveZonix Central Cloud API is Live. Connected to Render & Vercel.');
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`[SaveZonix Server] 🚀 Server running on http://localhost:${PORT}`);
});

// Connect to MongoDB asynchronously
mongoose.connect(MONGO_URI, { serverSelectionTimeoutMS: 3000 })
  .then(() => {
    console.log(`[SaveZonix Server] 🍃 Connected to MongoDB: ${MONGO_URI}`);
  })
  .catch((err) => {
    console.warn(`[SaveZonix Server] ⚠️ MongoDB connection notice: ${err.message} (Running in fallback mode)`);
  });
