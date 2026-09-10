const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

let mapHtmlContent = fs.readFileSync(path.join(__dirname, '..', 'main', 'map.html'), 'utf8');
if (!mapHtmlContent.includes('window.__testMap = map;')) {
  mapHtmlContent = mapHtmlContent.replace('map = L.map(', 'window.__testMap = map = L.map(');
}

const PORT = 8996;
const CDP_PORT = 9350;

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
  console.log(`[Test Server] Running on http://localhost:${PORT}`);

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

    if (!pageTab) {
      throw new Error('Page tab not found in Edge CDP');
    }

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
    await send('Console.enable');

    const consoleLogs = [];
    ws.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      if (data.method === 'Runtime.consoleAPICalled' || data.method === 'Runtime.exceptionThrown') {
        consoleLogs.push(data);
      }
    });

    await new Promise(r => setTimeout(r, 2000));

    const evalRes1 = await send('Runtime.evaluate', {
      expression: `(() => {
        const map = window.__testMap;
        if (!map) return { error: 'Map not initialized' };
        const center = map.getCenter();
        return {
          lat: center.lat,
          lng: center.lng,
          zoom: map.getZoom(),
          isDragging: map.dragging.enabled()
        };
      })()`,
      returnByValue: true
    });

    console.log('[Initial State]', evalRes1.result.value);

    console.log('[Test Action] Dispatching mouse drag (500, 300) -> (350, 150)...');
    
    await send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: 500,
      y: 300,
      button: 'left',
      buttons: 1,
      clickCount: 1
    });

    await new Promise(r => setTimeout(r, 50));

    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 450,
      y: 250,
      buttons: 1
    });

    await new Promise(r => setTimeout(r, 50));

    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 400,
      y: 200,
      buttons: 1
    });

    await new Promise(r => setTimeout(r, 50));

    await send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: 350,
      y: 150,
      buttons: 1
    });

    await new Promise(r => setTimeout(r, 50));

    await send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: 350,
      y: 150,
      button: 'left',
      buttons: 0
    });

    await new Promise(r => setTimeout(r, 500));

    const evalRes2 = await send('Runtime.evaluate', {
      expression: `(() => {
        const map = window.__testMap;
        const center = map.getCenter();
        return {
          lat: center.lat,
          lng: center.lng,
          zoom: map.getZoom()
        };
      })()`,
      returnByValue: true
    });

    console.log('[Post-Drag State]', evalRes2.result.value);

    const initLat = evalRes1.result.value.lat;
    const initLng = evalRes1.result.value.lng;
    const postLat = evalRes2.result.value.lat;
    const postLng = evalRes2.result.value.lng;

    const deltaLat = Math.abs(initLat - postLat);
    const deltaLng = Math.abs(initLng - postLng);
    const moved = (deltaLat > 0.000005) || (deltaLng > 0.000005);
    console.log(`[Drag Result] Center moved: ${moved} (deltaLat: ${deltaLat.toFixed(6)}, deltaLng: ${deltaLng.toFixed(6)})`);

    console.log('[Test Action] Clicking on a room polygon to test bottom-sheet opening...');
    const clickRoomRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const poly = document.querySelector('path.room-polygon.has-project');
        if (!poly) return { error: 'No room polygon found' };
        poly.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        
        const sheet = document.getElementById('bottomSheet');
        return {
          polygonFound: true,
          sheetState: sheet ? sheet.getAttribute('data-state') : null
        };
      })()`,
      returnByValue: true
    });

    console.log('[Room Click Result]', clickRoomRes.result.value);

    const fatalExceptions = consoleLogs.filter(log => {
      const text = JSON.stringify(log);
      return text.includes('baseVal') || text.includes('TypeError');
    });

    console.log(`[Error Check] Fatal baseVal/TypeError exceptions: ${fatalExceptions.length}`);
    if (fatalExceptions.length > 0) {
      console.error('[Fatal Error Details]', JSON.stringify(fatalExceptions, null, 2));
    }

    if (moved && fatalExceptions.length === 0) {
      console.log('=== TEST PASSED: Map pan drag is working perfectly without errors! ===');
      cleanup();
      process.exit(0);
    } else {
      console.error('=== TEST FAILED: Map did not move or encountered exceptions ===');
      cleanup();
      process.exit(1);
    }

  } catch (err) {
    console.error('[Test Error]', err);
    cleanup();
    process.exit(1);
  }
});
