const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// Default initial config state
let storeData = {
  kill_switch: false,
  portals: [
    {
      id: 1,
      name: "Demo XC Server",
      url: "http://line.server.com:8080",
      type: 1,
      enabled: 1,
      sort: 1
    }
  ],
  sports: {
    enabled: true,
    title: "Sports Guide",
    url: "https://m.livesoccertv.com/",
    javascript: true,
    maintenance_message: ""
  },
  theme: {
    enabled: 0,
    bg_id: 16,
    accent_id: 4,
    white: 1,
    revision: 1
  },
  vpns: []
};

// Try loading local data.json if available
try {
  const dataPath = path.join(__dirname, '../data.json');
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath, 'utf8');
    storeData = JSON.parse(raw);
  }
} catch (e) {}

function sendGzip(res, bodyString, contentType = 'text/plain; charset=utf-8') {
  const gz = zlib.gzipSync(Buffer.from(bodyString, 'utf8'));
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Encoding', 'gzip');
  res.setHeader('Content-Length', gz.length);
  res.setHeader('Cache-Control', 'no-cache');
  res.status(200).send(gz);
}

module.exports = (req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // 1. Kill switch: /guard/check
  if (pathname.includes('/guard/check')) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({
      success: true,
      killed: storeData.kill_switch
    });
  }

  // 2. Portals / DNS list: /api.php or /api/portals or /api/dns.php
  if (pathname.endsWith('/api.php') || pathname.includes('/api/portals') || pathname.includes('/api/dns.php')) {
    const activePortals = (storeData.portals || []).filter(p => p.enabled);
    const lines = activePortals.map(p => `${p.name}|${p.url}|${p.type}`).join('\n') + (activePortals.length ? '\n' : '');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(lines);
  }

  // 3. Sports section: /api/sports.php or /api/sports
  if (pathname.includes('/api/sports')) {
    const sports = storeData.sports || {};
    const sportsObj = {
      success: true,
      enabled: sports.enabled !== false,
      title: sports.title || "Sports",
      url: sports.url || "",
      javascript: sports.javascript !== false,
      allow_external: false,
      user_agent: "",
      maintenance_message: sports.maintenance_message || "",
      pages: [
        {
          id: 10,
          title: sports.title || "Sports",
          url: sports.url || "",
          notes: "",
          sort_order: 0
        }
      ]
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json(sportsObj);
  }

  // 4. Remote Theme: /api/theme.php or /api/theme
  if (pathname.includes('/api/theme')) {
    const theme = storeData.theme || {};
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    const themeStr = `${theme.enabled ? '1' : '0'}|${theme.bg_id || 16}|${theme.accent_id || 4}|${theme.white ? '1' : '0'}|${theme.revision || 1}`;
    return res.status(200).send(themeStr);
  }

  // 5. VPN Profiles: /api/vpns.php or /api/vpns
  if (pathname.includes('/api/vpns')) {
    const vpns = storeData.vpns || [];
    const vpnObj = {
      success: true,
      status: true,
      message: "success",
      count: vpns.length,
      profile: vpns[0] || null,
      vpn: vpns[0] || null,
      data: vpns,
      vpns: vpns,
      profiles: vpns
    };
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json(vpnObj);
  }

  // 6. Admin Authentication & Data Endpoint
  if (pathname.includes('/api/admin/login')) {
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      const pass = (storeData.admin_password || "admin123");
      if (body && body.password === pass) {
        return res.status(200).json({ success: true, token: "auth_token_ok" });
      }
      return res.status(401).json({ success: false, message: "Invalid Password" });
    }
  }

  if (pathname.includes('/api/admin/data')) {
    if (req.method === 'GET') {
      return res.status(200).json(storeData);
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch(e) {}
      }
      if (body) {
        storeData = { ...storeData, ...body };
        try {
          const dataPath = path.join(__dirname, '../data.json');
          fs.writeFileSync(dataPath, JSON.stringify(storeData, null, 2));
        } catch (e) {}
      }
      return res.status(200).json({ success: true, data: storeData });
    }
  }

  // Fallback
  return res.status(200).json({
    status: "online",
    message: "ProMax TiViMate Control Panel is Running on Vercel"
  });
};
