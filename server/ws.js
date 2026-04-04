import { WebSocketServer } from 'ws';
import { logger } from './logger.js';

let wss;
const clients = new Set();

export function setupWebSocket(server) {
  wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (ws) => {
    clients.add(ws);
    logger.info('WebSocket client connected', { clients: clients.size });

    ws.on('close', () => {
      clients.delete(ws);
      logger.info('WebSocket client disconnected', { clients: clients.size });
    });

    ws.on('error', (err) => {
      logger.error('WebSocket client error', { error: err.message });
      clients.delete(ws);
    });
  });

  return wss;
}

export function broadcast(event, payload = {}) {
  const msg = JSON.stringify({ event, ...payload });
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  }
}
