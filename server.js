const http = require('http');
const fs = require('fs');
const path = require('path');
const apiHandler = require('./api/index');

const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  // Serve static files from /public
  if (url.pathname === '/' || url.pathname === '/admin' || url.pathname === '/index.html') {
    const filePath = path.join(__dirname, 'public', 'index.html');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return fs.createReadStream(filePath).pipe(res);
  }

  // Delegate API requests to api/index.js
  let bodyChunks = [];
  req.on('data', chunk => bodyChunks.push(chunk));
  req.on('end', () => {
    req.body = Buffer.concat(bodyChunks).toString('utf8');
    
    // Add Vercel-like status helper
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (obj) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
    };
    res.send = (data) => {
      res.end(data);
    };

    apiHandler(req, res);
  });
});

server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`ProMax TiViMate Control Panel is running locally at:`);
  console.log(`  http://localhost:${PORT}`);
  console.log(`  Admin Dashboard: http://localhost:${PORT}/admin`);
  console.log(`===================================================`);
});
