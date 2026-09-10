const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let mapHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'main', 'map.html'), 'utf8');
if (!mapHtmlContent.includes('window.__testMap = map;')) {
  mapHtmlContent = mapHtmlContent.replace('map = L.map(', 'window.__testMap = map = L.map(');
}

const PORT = 8997;
const CDP_PORT = 9351;

const server = http.createServer((req, res) => {
  const urlPath = req.url.split('?')[0];
  if (urlPath === '/' || urlPath === '/map.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(mapHtmlContent);
    return;
  }
  const filePath = path.join(__dirname, '..', 'main', urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    const mime = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.css': 'text/css',
      '.webp': 'image/webp',
      '.png': 'image/png',
      '.svg': 'image/svg+xml'
    }[ext] || 'text/plain';
    res.writeHead(200, { 'Content-Type': mime });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

server.listen(PORT, async () => {
  const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
  const edgeProc = spawn(edgePath, [
    '--headless',
    `--remote-debugging-port=${CDP_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1024,768',
    `http://localhost:${PORT}/map.html`
  ]);

  const cleanup = () => {
    try { edgeProc.kill(); } catch (e) {}
    try { server.close(); } catch (e) {}
  };

  await new Promise(r => setTimeout(r, 2000));

  try {
    const tabsRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json`);
    const tabs = await tabsRes.json();
    const pageTab = tabs.find(t => t.type === 'page');

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);

    let nextId = 1;
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = nextId++;
      const handler = (event) => {
        const data = JSON.parse(event.data);
        if (data.id === id) {
          ws.removeEventListener('message', handler);
          if (data.error) reject(data.error);
          else resolve(data.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

    await new Promise(r => { ws.onopen = r; });
    await send('Runtime.enable');

    await new Promise(r => setTimeout(r, 2000));

    // Test selectRoom function and bottom-sheet expansion
    const testSelectRoom = await send('Runtime.evaluate', {
      expression: `(() => {
        // Find a room polygon with has-project
        const poly = document.querySelector('path.room-polygon.has-project');
        if (!poly) return { error: 'No project room polygon found' };
        
        // Check room click handler or programmatic select
        // In map.html, selectRoom(roomId) is defined
        // Let's test if a pin or polygon can be clicked
        const rect = poly.getBoundingClientRect();
        return {
          cx: rect.x + rect.width / 2,
          cy: rect.y + rect.height / 2,
          width: rect.width,
          height: rect.height
        };
      })()`,
      returnByValue: true
    });

    console.log('[Polygon Bounding Box]', testSelectRoom.result.value);
    const { cx, cy } = testSelectRoom.result.value;

    if (cx && cy) {
      // Dispatch real mouse click at the polygon center
      console.log(`[Test Action] Dispatching real click at (${cx}, ${cy})...`);
      await send('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: cx,
        y: cy,
        button: 'left',
        clickCount: 1
      });
      await send('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: cx,
        y: cy,
        button: 'left'
      });

      await new Promise(r => setTimeout(r, 600));

      const sheetCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          const sheet = document.getElementById('bottomSheet');
          const title = sheet ? sheet.querySelector('.bottom-sheet-title') : null;
          return {
            sheetState: sheet ? sheet.getAttribute('data-state') : null,
            titleText: title ? title.textContent : null
          };
        })()`,
        returnByValue: true
      });

      console.log('[Post-Click Sheet State]', sheetCheck.result.value);
    }

    console.log('=== VERIFICATION COMPLETED ===');
    cleanup();
    process.exit(0);
  } catch (err) {
    console.error(err);
    cleanup();
    process.exit(1);
  }
});
