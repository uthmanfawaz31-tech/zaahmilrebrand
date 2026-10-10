const fs = require('fs');
const path = require('path');

// Default initial configuration state for PRO MAX Panel
let storeData = {
  admin_password: "admin123",
  kill_switch: false,
  killed_builds: [],
  builds_seen: [
    { order_id: "cd5b9c07abad293e99c8e5582b164277", last_seen: "2026-10-08 06:27:15", killed: false },
    { order_id: "demo", last_seen: "2026-08-03 08:31:56", killed: false },
    { order_id: "TESTBUILD", last_seen: "2026-08-03 02:58:54", killed: false }
  ],
  authorized_packages: [
    { id: 1, package: "com.bainz.tivi", label: "Customer App", enabled: true, last_seen: "2026-10-04 11:10:13" }
  ],
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
    javascript: true,
    title: "Sports",
    url: "https://sport-tv-guide.live/widgetsingle/5ae7b",
    maintenance_message: ""
  },
  theme: {
    enabled: true,
    bg_id: 16,
    accent_id: 4,
    white: 1,
    revision: 1
  },
  vpns: []
};

// Load persistent data.json if available
try {
  const dataPath = path.join(__dirname, '../data.json');
  if (fs.existsSync(dataPath)) {
    const raw = fs.readFileSync(dataPath, 'utf8');
    storeData = { ...storeData, ...JSON.parse(raw) };
  }
} catch (e) {}

function saveStoreData() {
  try {
    const dataPath = path.join(__dirname, '../data.json');
    fs.writeFileSync(dataPath, JSON.stringify(storeData, null, 2));
  } catch (e) {}
}

module.exports = (req, res) => {
  // Global CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE, PUT');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const searchParams = url.searchParams;

  // Track app package if header present
  const reqPkg = req.headers['x-app-package'];
  if (reqPkg && Array.isArray(storeData.authorized_packages)) {
    const pkgItem = storeData.authorized_packages.find(p => p.package === reqPkg);
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);
    if (pkgItem) {
      pkgItem.last_seen = nowStr;
    } else {
      storeData.authorized_packages.push({
        id: Date.now(),
        package: reqPkg,
        label: "(auto)",
        enabled: true,
        last_seen: nowStr
      });
    }
    saveStoreData();
  }

  // 1. Guard / Kill Switch Check: /guard/check
  if (pathname.includes('/guard/check')) {
    const orderId = searchParams.get('order_id') || searchParams.get('build_id') || 'default';
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 19);

    if (!Array.isArray(storeData.builds_seen)) storeData.builds_seen = [];
    let b = storeData.builds_seen.find(item => item.order_id === orderId);
    if (b) {
      b.last_seen = nowStr;
    } else {
      storeData.builds_seen.unshift({ order_id: orderId, last_seen: nowStr, killed: false });
      if (storeData.builds_seen.length > 50) storeData.builds_seen.pop();
    }
    saveStoreData();

    const isKilled = !!storeData.kill_switch || (storeData.killed_builds || []).includes(orderId) || (b && b.killed);
    
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).json({
      success: true,
      killed: isKilled
    });
  }

  // 2. Portals / DNS List: /api.php or /api/portals or /api/dns.php
  if (pathname.endsWith('/api.php') || pathname.includes('/api/portals') || pathname.includes('/api/dns.php')) {
    const activePortals = (storeData.portals || []).filter(p => p.enabled);
    const lines = activePortals.map(p => `${p.name}|${p.url}|${p.type}`).join('\n') + (activePortals.length ? '\n' : '');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    return res.status(200).send(lines);
  }

  // 3. Sports Section: /api/sports.php or /api/sports
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

  // 6. Admin Authentication API
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

  // 7. Admin Data Read / Save Endpoint
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
        saveStoreData();
      }
      return res.status(200).json({ success: true, data: storeData });
    }
  }

  // Fallback
  return res.status(200).json({
    status: "online",
    message: "PRO MAX TiViMate Control Panel is Running on Vercel"
  });
};
