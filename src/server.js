const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { Server } = require('socket.io');

function startServer(config) {
  const app = express();
  const httpServer = http.createServer(app);
  const io = new Server(httpServer, { cors: { origin: '*' } });
  app.use(express.static(path.join(__dirname, '..', 'public')));
  app.get('/', (_req, res) => res.redirect('/overlay'));
  app.get('/overlay', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'overlay.html')));
  app.get('/api/status', (_req, res) => res.json({ channel: config.channel, chatWriteEnabled: Boolean(config.oauth && config.nick) }));
  const clients = new Set();
  io.on('connection', socket => { clients.add(socket); socket.on('disconnect', () => clients.delete(socket)); });
  httpServer.listen(config.port, () => console.log(`ChatClash overlay: http://localhost:${config.port}/overlay (channel: #${config.channel})`));
  return {
    attachArena(arena) {
      arena.on('state', state => io.emit('state', state));
      arena.on('feed', item => io.emit('feed', item));
      io.on('connection', socket => { socket.emit('state', arena.snapshot()); socket.emit('leaderboard', arena.leaderboard()); });
      arena.on('leaderboard', board => io.emit('leaderboard', board));
    },
    close: callback => httpServer.close(callback)
  };
}
module.exports = { startServer };
