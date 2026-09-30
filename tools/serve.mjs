// Local stand-in for Vercel: serves ../public with cleanUrls, the 404 page, the redirects and the
// response headers (including the CSP) from ../vercel.json. usage: node serve.mjs [port]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUB = path.join(ROOT, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
};
const pattern = (src) => new RegExp('^' + src.replace(/\(\.\*\)/g, '(.*)') + '$');

export function serve(port = 4817) {
  const server = http.createServer((req, res) => {
    const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'vercel.json'), 'utf8'));
    const p = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    for (const r of cfg.redirects ?? []) {
      if (p === r.source) {
        res.writeHead(308, { Location: r.destination });
        return res.end();
      }
    }
    for (const rule of cfg.headers ?? []) {
      if (pattern(rule.source).test(p)) for (const h of rule.headers) res.setHeader(h.key, h.value);
    }
    let file = path.join(PUB, p);
    let status = 200;
    if (p.endsWith('/')) file = path.join(file, 'index.html');
    else if (!path.extname(p)) file += '.html';
    if (!file.startsWith(PUB) || !fs.existsSync(file)) {
      file = path.join(PUB, '404.html');
      status = 404;
    }
    res.writeHead(status, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(port, () => resolve(server)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 4817;
  await serve(port);
  console.log(`http://localhost:${port}`);
}
