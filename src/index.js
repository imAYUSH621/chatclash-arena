const config = require('../config');
const { startServer } = require('./server');
const { TwitchChat } = require('./chat');
const { Arena } = require('./game/arena');

const server = startServer(config);
const arena = new Arena(config);
server.attachArena(arena);

const chat = new TwitchChat(config, (user, message) => arena.handleChat(user, message));
chat.connect();
arena.on('chatMessage', (message) => chat.say(message));

function shutdown() {
  chat.close();
  arena.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
