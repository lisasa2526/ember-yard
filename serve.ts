// Dev-only static server for the Ember Yard game folder (Node 22, stdlib
// only). Lets the game run locally with no build step:
//   node serve.ts [--port 8080]
// Serves game/ on http://localhost:8080 by default. Not part of the entry.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const gameRoot = resolve(fileURLToPath(new URL('./game', import.meta.url)));

const cli = process.argv.slice(2);
const portFlag = cli.indexOf('--port');
const wanted = portFlag === -1 ? 8080 : Number(cli[portFlag + 1]);
const port = Number.isInteger(wanted) && wanted > 0 && wanted < 65536 ? wanted : 8080;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
};

function safePath(raw) {
  let path = raw;
  try {
    path = decodeURIComponent(path);
  } catch {
    return null;
  }
  if (path.endsWith('/')) path += 'index.html';
  const file = resolve(join(gameRoot, normalize(path)));
  if (file !== gameRoot && !file.startsWith(gameRoot + sep)) return null;
  return file;
}

createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  const file = safePath(url.pathname);
  if (!file) {
    res.writeHead(400).end('bad request');
    return;
  }
  let info;
  try {
    info = statSync(file);
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  if (!info.isFile()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'content-length': info.size,
  });
  createReadStream(file).pipe(res);
}).listen(port, () => console.log(`Ember Yard on http://localhost:${port}`));
