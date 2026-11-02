const tls = require('node:tls');
const { EventEmitter } = require('node:events');

class TwitchChat extends EventEmitter {
  constructor(config, onMessage) {
    super();
    this.config = config;
    this.onMessage = onMessage;
    this.socket = null;
    this.buffer = '';
    this.reconnectTimer = null;
    this.closed = false;
    this.authed = Boolean(config.oauth && config.nick);
    this.nick = this.authed ? config.nick.toLowerCase() : `justinfan${10000 + Math.floor(Math.random() * 89999)}`;
  }
  connect() {
    if (this.closed) return;
    console.log(`Connecting to Twitch IRC as ${this.nick}${this.authed ? ' (chat enabled)' : ' (anonymous read-only)'}`);
    this.socket = tls.connect({ host: 'irc.chat.twitch.tv', port: 6697 }, () => {
      if (this.authed) this.send(`PASS ${this.config.oauth.startsWith('oauth:') ? this.config.oauth : `oauth:${this.config.oauth}`}`);
      else this.send('PASS SCHMOOPIIE');
      this.send(`NICK ${this.nick}`);
      this.send(`JOIN #${this.config.channel}`);
    });
    this.socket.setEncoding('utf8');
    this.socket.on('data', chunk => this.consume(chunk));
    this.socket.on('error', err => { console.error('Twitch IRC:', err.message); });
    this.socket.on('close', () => {
      if (!this.closed) this.reconnectTimer = setTimeout(() => this.connect(), 5000);
    });
  }
  consume(chunk) {
    this.buffer += chunk;
    const lines = this.buffer.split('\r\n');
    this.buffer = lines.pop();
    for (const line of lines) {
      if (line.startsWith('PING ')) { this.send(`PONG ${line.slice(5)}`); continue; }
      const match = line.match(/^:([^!]+)!.* PRIVMSG #[^ ]+ :(.*)$/);
      if (match) this.onMessage(match[1], match[2]);
    }
  }
  say(message) {
    // Twitch limits individual IRC lines; our generated announcements stay short.
    if (this.authed && this.socket?.writable) this.send(`PRIVMSG #${this.config.channel} :${String(message).slice(0, 450)}`);
  }
  send(line) { if (this.socket?.writable) this.socket.write(`${line}\r\n`); }
  close() { this.closed = true; clearTimeout(this.reconnectTimer); this.socket?.end(); }
}
module.exports = { TwitchChat };
