// Schiebt Änderungen sofort ans Overlay (Server-Sent Events), damit es nicht auf den nächsten Abruf warten muss.
// Das Overlay fragt weiter alle 3 Sekunden nach; der Live-Kanal ist nur die schnelle Abkürzung.
const clients = new Set();

export function notify(kind = 'update') {
  for (const res of clients) { try { res.write(`event: ${kind}\ndata: ${Date.now()}\n\n`); } catch { clients.delete(res); } }
}

// Wird von server.mjs für GET /api/overlay/live aufgerufen
export function attach(req, res) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-store', connection: 'keep-alive', 'x-accel-buffering': 'no' });
  res.write('retry: 2000\n\n');
  clients.add(res);
  const beat = setInterval(() => { try { res.write(': \n\n'); } catch { /* wird unten aufgeräumt */ } }, 20_000);
  req.on('close', () => { clearInterval(beat); clients.delete(res); });
}

export const listeners = () => clients.size;
