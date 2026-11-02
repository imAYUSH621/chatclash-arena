const path = require('node:path');

function readArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--')) {
      const key = argv[i].slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true';
      out[key] = value;
    }
  }
  return out;
}

const args = readArgs(process.argv.slice(2));
const envName = key => key.replace(/[A-Z]/g, c => `_${c}`).toUpperCase();
const value = (key, fallback) => args[key] ?? process.env[envName(key)] ?? fallback;
const config = {
  channel: String(value('channel', '')).replace(/^#/, '').toLowerCase(),
  port: Number(value('port', 3000)),
  roundSeconds: Number(value('roundSeconds', 180)),
  lobbySeconds: Number(value('lobbySeconds', 60)),
  minPlayers: Number(value('minPlayers', 6)),
  arenaTickMs: Number(value('tickMs', 100)),
  oauth: process.env.TWITCH_OAUTH || '',
  nick: process.env.TWITCH_NICK || '',
  leaderboardFile: path.resolve(process.env.LEADERBOARD_FILE || 'data/leaderboard.json')
};
if (!config.channel) {
  console.error('Missing Twitch channel. Set CHANNEL=somechannel or pass --channel somechannel.');
  process.exit(1);
}
if (!Number.isFinite(config.port) || config.port < 1 || config.port > 65535) throw new Error('PORT must be a valid TCP port');
for (const [name, number] of Object.entries({ ROUND_SECONDS: config.roundSeconds, LOBBY_SECONDS: config.lobbySeconds, MIN_PLAYERS: config.minPlayers, TICK_MS: config.arenaTickMs })) {
  if (!Number.isInteger(number) || number < 1) throw new Error(`${name} must be a positive integer`);
}
module.exports = config;
