// Optional local server for browsers that block direct ElevenLabs calls from file:// or static HTML.
// Run: node voice-proxy-server.js
// Then open: http://localhost:8787
// The HTML still contains the API key as requested. This proxy uses the same key so CORS is avoided.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8787;
const API_KEY = '104ebf650e4230c8351e5c113098cb9c3d7ddbf6d0ec61321a14b401a88f94f0';
const API_BASE = 'https://api.elevenlabs.io';
const ROOT = __dirname;

function send(res, status, body, type = 'text/plain') {
  res.writeHead(status, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*' });
  res.end(body);
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Accept'
      });
      return res.end();
    }

    const url = new URL(req.url, `http://localhost:${PORT}`);

    if (url.pathname === '/api/elevenlabs') {
      const targetPath = url.searchParams.get('path');
      const method = url.searchParams.get('method') || 'GET';
      if (!targetPath || !targetPath.startsWith('/v1/')) return send(res, 400, 'Missing or invalid path');
      const body = method === 'POST' ? await readBody(req) : undefined;
      const upstream = await fetch(API_BASE + targetPath, {
        method,
        headers: {
          'xi-api-key': API_KEY,
          'Content-Type': 'application/json',
          'Accept': req.headers.accept || 'application/json'
        },
        body
      });
      const arr = Buffer.from(await upstream.arrayBuffer());
      res.writeHead(upstream.status, {
        'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*'
      });
      return res.end(arr);
    }

    let file = url.pathname === '/' ? '/index.html' : url.pathname;
    file = path.join(ROOT, path.normalize(file));
    if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');
    fs.readFile(file, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      const ext = path.extname(file).toLowerCase();
      const type = ext === '.html' ? 'text/html; charset=utf-8' : ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
      send(res, 200, data, type);
    });
  } catch (err) {
    send(res, 500, String(err && err.message || err));
  }
});

server.listen(PORT, () => console.log(`Open http://localhost:${PORT}`));
