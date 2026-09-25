#!/usr/bin/env node
// Servidor local de Cerebro: sirve la interfaz y guarda el grafo en data/brain.json.
// Sin dependencias: solo Node.js >= 18.
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const PORT = Number(process.env.PORT) || 4321;
const HOST = process.env.HOST || '127.0.0.1';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = process.env.BRAIN_DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'brain.json');
const BACKUP_FILE = path.join(DATA_DIR, 'brain.backup.json');
const MEDIA_DIR = path.join(DATA_DIR, 'media');
const MAX_BODY = 20 * 1024 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
};

// Solo se aceptan peticiones dirigidas a este equipo (evita DNS rebinding).
function isLocalHost(hostHeader) {
  const host = String(hostHeader || '').replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === HOST;
}

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Cuerpo demasiado grande'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function handleApi(req, res) {
  if (req.method === 'GET') {
    try {
      send(res, 200, await fs.promises.readFile(DATA_FILE, 'utf8'));
    } catch (err) {
      if (err.code === 'ENOENT') send(res, 200, 'null');
      else send(res, 500, JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'PUT') {
    // Cabecera personalizada: obliga a un preflight CORS que nunca aprobamos,
    // así ninguna web externa puede escribir en tu cerebro.
    if (req.headers['x-brain'] !== '1') return send(res, 403, JSON.stringify({ error: 'Prohibido' }));
    let data;
    try {
      data = JSON.parse(await readBody(req));
    } catch (err) {
      return send(res, 400, JSON.stringify({ error: 'JSON inválido' }));
    }
    if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.links)) {
      return send(res, 400, JSON.stringify({ error: 'Formato inválido: se esperan nodes y links' }));
    }
    try {
      await fs.promises.mkdir(DATA_DIR, { recursive: true });
      await fs.promises.copyFile(DATA_FILE, BACKUP_FILE).catch(() => {});
      const tmp = DATA_FILE + '.tmp';
      await fs.promises.writeFile(tmp, JSON.stringify(data, null, 2));
      await fs.promises.rename(tmp, DATA_FILE);
      send(res, 200, JSON.stringify({ ok: true, savedAt: new Date().toISOString() }));
    } catch (err) {
      send(res, 500, JSON.stringify({ error: err.message }));
    }
    return;
  }

  send(res, 405, JSON.stringify({ error: 'Método no permitido' }));
}

// Guarda un video subido en data/media (en streaming, sin cargarlo en memoria).
async function handleMedia(req, res, url) {
  if (req.method !== 'POST') return send(res, 405, JSON.stringify({ error: 'Método no permitido' }));
  if (req.headers['x-brain'] !== '1') return send(res, 403, JSON.stringify({ error: 'Prohibido' }));
  const original = path.basename(url.searchParams.get('name') || 'video.mp4');
  const safe = original.replace(/[^\w.\- ]+/g, '_').slice(-120) || 'video.mp4';
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  await fs.promises.mkdir(MEDIA_DIR, { recursive: true });
  const file = path.join(MEDIA_DIR, `${stamp}_${safe}`);
  const out = fs.createWriteStream(file);
  req.pipe(out);
  out.on('finish', () => send(res, 200, JSON.stringify({ ok: true, path: file, name: path.basename(file) })));
  out.on('error', (err) => send(res, 500, JSON.stringify({ error: err.message })));
  req.on('error', () => out.destroy());
}

function insideMedia(p) {
  const abs = path.resolve(p);
  return abs.startsWith(path.resolve(MEDIA_DIR) + path.sep);
}

function launch(cmd, args) {
  const child = spawn(cmd, args, { detached: true, stdio: 'ignore', shell: false });
  child.on('error', (err) => console.error(`No se pudo abrir ${cmd}: ${err.message}`));
  child.unref();
}

// Abre en el sistema: una app/ruta guardada en el cerebro (opcionalmente con un
// video de data/media como argumento) o muestra un video en su carpeta.
async function handleOpen(req, res) {
  if (req.method !== 'POST') return send(res, 405, JSON.stringify({ error: 'Método no permitido' }));
  if (req.headers['x-brain'] !== '1') return send(res, 403, JSON.stringify({ error: 'Prohibido' }));
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return send(res, 400, JSON.stringify({ error: 'JSON inválido' }));
  }
  const { target, file, reveal } = body || {};

  if (file && (typeof file !== 'string' || !insideMedia(file) || !fs.existsSync(file))) {
    return send(res, 400, JSON.stringify({ error: 'Archivo no válido' }));
  }

  if (reveal) {
    if (!file) return send(res, 400, JSON.stringify({ error: 'Falta el archivo' }));
    if (process.platform === 'win32') launch('explorer.exe', [`/select,${file}`]);
    else if (process.platform === 'darwin') launch('open', ['-R', file]);
    else launch('xdg-open', [path.dirname(file)]);
    return send(res, 200, JSON.stringify({ ok: true }));
  }

  // Solo se pueden abrir rutas que ya están guardadas en tu cerebro.
  let known = [];
  try {
    known = JSON.parse(await fs.promises.readFile(DATA_FILE, 'utf8')).nodes.map((n) => String(n.url || '').trim());
  } catch { /* sin datos todavía */ }
  if (typeof target !== 'string' || !target.trim() || !(known.includes(target.trim()) || insideMedia(target))) {
    return send(res, 400, JSON.stringify({ error: 'Esa ruta no está guardada en ningún nodo' }));
  }
  const t = target.trim();
  const args = file ? [file] : [];
  if (process.platform === 'darwin') {
    launch('open', t.endsWith('.app') ? ['-a', t, ...args] : [t, ...args]);
  } else if (process.platform === 'win32') {
    if (/\.exe$/i.test(t)) launch(t, args);
    else launch('explorer.exe', [t]);
  } else if (fs.existsSync(t) && fs.statSync(t).isFile() && (fs.statSync(t).mode & 0o111)) {
    launch(t, args);
  } else {
    launch('xdg-open', [t]);
  }
  send(res, 200, JSON.stringify({ ok: true }));
}

async function handleStatic(req, res, pathname) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Método no permitido', 'text/plain');
  const rel = pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(PUBLIC_DIR, rel);
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 403, 'Prohibido', 'text/plain');
  try {
    const body = await fs.promises.readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    send(res, 404, 'No encontrado', 'text/plain');
  }
}

const server = http.createServer((req, res) => {
  if (!isLocalHost(req.headers.host)) return send(res, 403, 'Prohibido', 'text/plain');
  const url = new URL(req.url, 'http://localhost');
  const { pathname } = url;
  if (pathname === '/api/brain') return handleApi(req, res);
  if (pathname === '/api/media') return handleMedia(req, res, url);
  if (pathname === '/api/open') return handleOpen(req, res);
  if (pathname.startsWith('/media/')) {
    const file = path.resolve(MEDIA_DIR, decodeURIComponent(pathname.slice(7)));
    if (!insideMedia(file)) return send(res, 403, 'Prohibido', 'text/plain');
    return fs.createReadStream(file)
      .on('open', function () { res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); this.pipe(res); })
      .on('error', () => send(res, 404, 'No encontrado', 'text/plain'));
  }
  return handleStatic(req, res, pathname);
});

server.listen(PORT, HOST, () => {
  console.log(`🧠 Cerebro listo en http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  console.log(`   Datos guardados en ${DATA_FILE}`);
});
