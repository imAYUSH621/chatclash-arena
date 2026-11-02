const COLORS = ['#ff6b9d', '#59d9ff', '#ffd166', '#a78bfa', '#62e6a7', '#ff9568', '#f472e8', '#9be564'];
function makeEntity(name, index, bot = false) {
  const angle = Math.random() * Math.PI * 2;
  const radius = 80 + Math.random() * 260;
  return {
    id: name.toLowerCase(), name, bot, x: 500 + Math.cos(angle) * radius, y: 350 + Math.sin(angle) * radius,
    vx: (Math.random() - .5) * 100, vy: (Math.random() - .5) * 100,
    hp: 100, maxHp: 100, alive: true, color: COLORS[index % COLORS.length], kills: 0,
    radius: 24 + Math.random() * 5, hitUntil: 0, lastAttack: 0, lastHeal: 0
  };
}
module.exports = { makeEntity };
