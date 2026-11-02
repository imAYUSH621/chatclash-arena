const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const path = require('node:path');
const { makeEntity } = require('./entities');
const { chooseEvent } = require('./events');

const W = 1000, H = 700;
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
class Arena extends EventEmitter {
  constructor(config) {
    super();
    this.config = config;
    this.players = new Map();
    this.phase = 'lobby';
    this.phaseEnds = Date.now() + config.lobbySeconds * 1000;
    this.round = 0;
    this.started = false;
    this.winner = null;
    this.feedItems = [];
    this.radius = 320;
    this.chaosVotes = new Map();
    this.speedUntil = 0;
    this.gravityUntil = 0;
    this.leaders = this.readLeaderboard();
    this.interval = setInterval(() => this.tick(), config.arenaTickMs);
  }
  readLeaderboard() {
    try { return JSON.parse(fs.readFileSync(this.config.leaderboardFile, 'utf8')); }
    catch { return {}; }
  }
  saveLeaderboard() {
    fs.mkdirSync(path.dirname(this.config.leaderboardFile), { recursive: true });
    fs.writeFileSync(this.config.leaderboardFile, `${JSON.stringify(this.leaders, null, 2)}\n`);
    this.emit('leaderboard', this.leaderboard());
  }
  leaderboard() {
    return Object.entries(this.leaders).sort((a, b) => b[1].wins - a[1].wins || b[1].kills - a[1].kills)
      .slice(0, 8).map(([name, stats]) => ({ name, ...stats }));
  }
  addFeed(text, kind = 'info') {
    const item = { id: `${Date.now()}-${Math.random()}`, text, kind, at: Date.now() };
    this.feedItems.unshift(item); this.feedItems.length = Math.min(this.feedItems.length, 6); this.emit('feed', item);
  }
  join(name, bot = false) {
    const key = name.toLowerCase();
    if (this.players.has(key) && this.players.get(key).alive) return this.players.get(key);
    const p = makeEntity(name.slice(0, 24), this.players.size, bot);
    this.players.set(key, p);
    this.addFeed(`${p.name} dropped into the arena!`, 'join');
    return p;
  }
  handleChat(user, message) {
    const parts = message.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();
    if (command === '!join' || command === '!play') {
      if (this.phase !== 'lobby') { this.addFeed(`${user}, next round is almost ready!`); return; }
      this.join(user);
    } else if (command === '!attack') this.attack(user, (parts[1] || '').replace(/^@/, ''));
    else if (command === '!heal') this.heal(user);
    else if (command === '!chaos') this.voteChaos(user);
  }
  attack(attackerName, targetName) {
    if (this.phase !== 'battle') return;
    const attacker = this.players.get(attackerName.toLowerCase());
    const target = this.players.get(targetName.toLowerCase());
    const now = Date.now();
    if (!attacker?.alive || !target?.alive || attacker === target || now - attacker.lastAttack < 10000) return;
    attacker.lastAttack = now;
    const damage = 18 + Math.floor(Math.random() * 13);
    target.hp = Math.max(0, target.hp - damage); target.hitUntil = now + 350;
    this.addFeed(`${attacker.name} bonked ${target.name} for ${damage}!`, 'hit');
    if (target.hp === 0) this.eliminate(target, attacker);
  }
  heal(name) {
    if (this.phase !== 'battle') return;
    const p = this.players.get(name.toLowerCase()), now = Date.now();
    if (!p?.alive || now - p.lastHeal < 30000 || p.hp >= p.maxHp) return;
    p.lastHeal = now; p.hp = Math.min(p.maxHp, p.hp + 28);
    this.addFeed(`${p.name} found a squishy heal!`, 'heal');
  }
  voteChaos(name) {
    if (this.phase !== 'battle') return;
    const now = Date.now();
    for (const [who, at] of this.chaosVotes) if (now - at > 15000) this.chaosVotes.delete(who);
    this.chaosVotes.set(name.toLowerCase(), now);
    this.addFeed(`Chaos vote ${this.chaosVotes.size}/5!`, 'vote');
    if (this.chaosVotes.size >= 5) { this.chaosVotes.clear(); this.chaos(); }
  }
  chaos() {
    const event = chooseEvent(), alive = [...this.players.values()].filter(p => p.alive);
    this.addFeed(`⚡ CHAOS: ${event.toUpperCase()}!`, 'chaos');
    if (event === 'meteor strike') {
      const target = alive[Math.floor(Math.random() * alive.length)];
      if (target) { target.hp = Math.max(0, target.hp - 35); target.hitUntil = Date.now() + 600; this.addFeed(`A meteor bonked ${target.name}!`, 'hit'); if (!target.hp) this.eliminate(target, null); }
    } else if (event === 'health shuffle' && alive.length > 1) {
      const values = alive.map(p => p.hp).sort(() => Math.random() - .5); alive.forEach((p, i) => p.hp = values[i]);
    } else if (event === 'speed burst') this.speedUntil = Date.now() + 10000;
    else if (event === 'gravity flip') this.gravityUntil = Date.now() + 8000;
  }
  eliminate(player, killer) {
    if (!player.alive) return;
    player.alive = false; player.hp = 0;
    if (killer && killer !== player) {
      killer.kills++;
      const row = this.leaders[killer.name.toLowerCase()] ||= { wins: 0, kills: 0 };
      row.kills++;
    }
    this.addFeed(`${player.name} got bounced!${killer ? ` ${killer.name} gets the bonk.` : ''}`, 'ko');
    this.emit('leaderboard', this.leaderboard());
  }
  beginBattle() {
    if (!this.started) { this.started = true; this.round = 1; }
    else this.round++;
    this.phase = 'battle'; this.winner = null; this.radius = 320;
    const real = [...this.players.values()].filter(p => !p.bot && p.alive).length;
    let botIndex = 1;
    while ([...this.players.values()].filter(p => p.alive).length < Math.max(this.config.minPlayers, real)) this.join(`ArenaBot${botIndex++}`, true);
    this.phaseEnds = Date.now() + this.config.roundSeconds * 1000;
    this.addFeed(`ROUND ${this.round} — FIGHT!`, 'round');
    this.emit('chatMessage', `⚔️ ChatClash Round ${this.round} is live! Type !join next round, !attack @name, !heal, or !chaos.`);
  }
  endBattle(winner) {
    this.phase = 'winner'; this.winner = winner?.name || null; this.phaseEnds = Date.now() + 12000;
    if (winner) {
      const row = this.leaders[winner.name.toLowerCase()] ||= { wins: 0, kills: 0 };
      row.wins++;
      this.addFeed(`👑 ${winner.name} is the champion!`, 'winner');
      this.saveLeaderboard();
      this.emit('chatMessage', `👑 ${winner.name} wins ChatClash Round ${this.round} with ${winner.kills} KO${winner.kills === 1 ? '' : 's'}! GG!`);
    } else this.addFeed('No survivors this round!', 'round');
    this.emit('chatMessage', `🏁 ChatClash Round ${this.round} is over!`);
  }
  tick() {
    const now = Date.now();
    if (this.phase === 'lobby' && now >= this.phaseEnds) this.beginBattle();
    else if (this.phase === 'battle') {
      const left = Math.max(0, (this.phaseEnds - now) / 1000);
      this.radius = Math.max(92, 320 - (1 - left / this.config.roundSeconds) * 210);
      const alive = [...this.players.values()].filter(p => p.alive);
      for (const p of alive) {
        if (p.bot && Math.random() < .025) {
          const targets = alive.filter(q => q !== p); const target = targets[Math.floor(Math.random() * targets.length)];
          if (target) this.attackBot(p, target);
        }
        const speed = now < this.speedUntil ? 1.8 : 1;
        if (now < this.gravityUntil) { p.vy += (Math.random() - .5) * 25; p.vx += (Math.random() - .5) * 25; }
        p.x = clamp(p.x + p.vx * this.config.arenaTickMs / 1000 * speed, 25, W - 25);
        p.y = clamp(p.y + p.vy * this.config.arenaTickMs / 1000 * speed, 25, H - 25);
        p.vx = clamp(p.vx + (Math.random() - .5) * 8, -110, 110); p.vy = clamp(p.vy + (Math.random() - .5) * 8, -110, 110);
        const dx = p.x - W / 2, dy = p.y - H / 2;
        if (Math.hypot(dx, dy) > this.radius) { p.hp = Math.max(0, p.hp - .6); if (p.hp === 0) this.eliminate(p, null); }
      }
      const survivors = [...this.players.values()].filter(p => p.alive);
      if (survivors.length <= 1) this.endBattle(survivors[0] || null);
      else if (now >= this.phaseEnds) {
        survivors.sort((a, b) => b.hp - a.hp); this.endBattle(survivors[0]);
      }
    } else if (this.phase === 'winner' && now >= this.phaseEnds) {
      for (const p of this.players.values()) if (!p.bot) p.alive = false;
      this.players.clear(); this.phase = 'lobby'; this.phaseEnds = now + this.config.lobbySeconds * 1000;
      this.addFeed('Lobby open! Type !join to drop in.', 'round');
    }
    this.emit('state', this.snapshot());
  }
  attackBot(attacker, target) {
    if (!attacker.alive || !target.alive) return;
    const damage = 7 + Math.floor(Math.random() * 11); target.hp = Math.max(0, target.hp - damage); target.hitUntil = Date.now() + 300;
    this.addFeed(`${attacker.name} bonked ${target.name}!`, 'hit'); if (!target.hp) this.eliminate(target, attacker);
  }
  snapshot() {
    return { phase: this.phase, round: this.round, secondsLeft: Math.max(0, Math.ceil((this.phaseEnds - Date.now()) / 1000)), winner: this.winner,
      width: W, height: H, radius: this.radius, players: [...this.players.values()].map(({ lastAttack, lastHeal, ...p }) => ({ ...p })), feed: this.feedItems };
  }
  stop() { clearInterval(this.interval); }
}
module.exports = { Arena };
