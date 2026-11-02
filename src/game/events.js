const EVENTS = ['meteor strike', 'health shuffle', 'speed burst', 'gravity flip'];
function chooseEvent() { return EVENTS[Math.floor(Math.random() * EVENTS.length)]; }
module.exports = { EVENTS, chooseEvent };
