// Dependency-free live preview for Intel Macs running Catalina and Node.js 18.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const port = 5173;
const clients = new Set();
const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
const liveScript = `<script>
(()=>{let revision;const events=new EventSource('/__preview_events');
events.addEventListener('revision',event=>{if(revision && revision!==event.data) location.reload();revision=event.data;});
events.addEventListener('reload',()=>location.reload());
})();
</script>`;
const revision = String(Date.now());
const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); }
  catch { res.writeHead(400); return res.end('Bad request'); }
  if (pathname === '/__preview_events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' });
    res.write(`event: revision\ndata: ${revision}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); return res.end(); }
  const relative = pathname === '/' ? '오답노트.html' : pathname.slice(1);
  const file = path.resolve(root, relative);
  const segments = relative.split('/');
  if (!file.startsWith(root + path.sep) || segments.some(s => s.startsWith('.') || s === 'node_modules') || !mime[path.extname(file)]) {
    res.writeHead(404); return res.end('Not found');
  }
  fs.realpath(file, (realError, realFile) => {
    if (realError || !realFile.startsWith(root + path.sep)) { res.writeHead(404); return res.end('Not found'); }
    fs.readFile(realFile, (error, bytes) => {
      if (error) { res.writeHead(404); return res.end('Not found'); }
      res.writeHead(200, { 'Content-Type': mime[path.extname(file)], 'Cache-Control': 'no-store' });
      if (req.method === 'HEAD') return res.end();
      if (path.extname(file) === '.html') {
        const html = bytes.toString();
        return res.end(html.includes('</body>') ? html.replace('</body>', liveScript + '</body>') : html + liveScript);
      }
      res.end(bytes);
    });
  });
});
let timer;
const watcher = fs.watch(root, { recursive: true }, (event, filename) => {
  if (!filename || filename.split(path.sep).some(s => s.startsWith('.') || s === 'node_modules')) return;
  if (!/\.(html|css|js|svg|png|jpg|webp|json)$/.test(filename)) return;
  clearTimeout(timer);
  timer = setTimeout(() => {
    for (const client of clients) client.write('event: reload\ndata: changed\n\n');
    console.log('Updated:', filename);
  }, 150);
});
const heartbeat = setInterval(() => { for (const client of clients) client.write(': keepalive\n\n'); }, 15000);
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? 'Port 5173 is already in use. Stop the other server first.' : error.message);
  watcher.close(); clearInterval(heartbeat); process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`Live preview: http://127.0.0.1:${port}\nKeep this terminal running. Stop: Ctrl+C`));
function stop() { for (const client of clients) client.end(); watcher.close(); clearInterval(heartbeat); clearTimeout(timer); server.close(); }
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
