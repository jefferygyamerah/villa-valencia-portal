const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const root = path.resolve(process.argv[2] || '..');
const host = process.argv[3] || '127.0.0.1';
const port = Number(process.argv[4] || process.env.E2E_PORT || 8787);

const types = {
  '.css': 'text/css; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.geojson': 'application/geo+json; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

function send(res, status, body, type) {
  res.writeHead(status, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function fileForUrl(urlPath) {
  const decoded = decodeURIComponent((urlPath || '/').split('?')[0]);
  const normalized = path.normalize(decoded).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(root, normalized);
  if (!file.startsWith(root)) return null;
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    file = path.join(file, 'index.html');
  }
  return file;
}

const server = http.createServer((req, res) => {
  const file = fileForUrl(req.url);
  if (!file) return send(res, 403, 'Forbidden');
  fs.readFile(file, (err, body) => {
    if (err) return send(res, err.code === 'ENOENT' ? 404 : 500, err.code || 'Error');
    send(res, 200, body, types[path.extname(file)] || 'application/octet-stream');
  });
});

server.listen(port, host, () => {
  console.log(`static-server listening on http://${host}:${port}, root=${root}`);
});
