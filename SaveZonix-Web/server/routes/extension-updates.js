const express = require('express');
const AppConfig = require('../models/AppConfig');

const router = express.Router();

// GET /api/extension-updates.xml  Chromium Omaha Auto-Update Protocol
router.get('/', async (req, res) => {
  try {
    let config = await AppConfig.findOne();
    const version = config?.extensionVersion || '2.5.0';
    const downloadUrl = config?.extensionDownloadUrl || 'https://save-zonix.vercel.app/SaveZonix-Extension.zip';

    // Standard Chromium Omaha Protocol XML format
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="savezonix-video-downloader">
    <updatecheck codebase="${downloadUrl}" version="${version}" status="ok" />
  </app>
</gupdate>`;

    res.set('Content-Type', 'text/xml');
    return res.send(xml);
  } catch (err) {
    const fallbackXml = `<?xml version="1.0" encoding="UTF-8"?>
<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">
  <app appid="savezonix-video-downloader">
    <updatecheck codebase="https://save-zonix.vercel.app/SaveZonix-Extension.zip" version="2.5.0" status="ok" />
  </app>
</gupdate>`;
    res.set('Content-Type', 'text/xml');
    return res.send(fallbackXml);
  }
});

module.exports = router;
