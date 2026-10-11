// node test.mjs: content sanity + 3000 simulated games with random choices.
import assert from 'node:assert/strict';
import { EVENTS, JAIL } from './events.js';
import { newGame, nextEvent, play, advance, checkEnd, gender, score } from './logic.js';

const ids = EVENTS.map(e => e.id);
assert.equal(new Set(ids).size, ids.length, 'duplicate event id');
for (const e of [...EVENTS, ...JAIL]) {
  assert(e.jail || (Number.isInteger(e.rank) && e.tag), `${e.id}: needs rank + tag`);
  for (const o of e.options) {
    assert(o.win && o.winText, `${e.id}: option missing win`);
    assert(o.chance >= 100 || (o.lose && o.loseText), `${e.id}: risky option missing lose`);
    for (const txt of [e.title, e.sub, o.label, o.winText, o.loseText ?? '']) {
      assert(!/[{}]/.test(gender(txt, true).replace('{n}', '')), `${e.id}: broken {m|f} in "${txt}"`);
    }
  }
}

function simulate(daily, pick) {
  const s = newGame({ name: 'x', female: false, daily });
  let e = nextEvent(s), end, turns = 0;
  for (;;) {
    assert(++turns < 500, 'game never ends');
    const n = advance(s, e, play(s, e.options[pick(s, e)]));
    if (n.jail) { e = n.jail; continue; }
    if ((end = checkEnd(s))) break;
    e = nextEvent(s);
  }
  return { end, turns, score: score(s), age: s.age, jail: s.jailYears };
}

const ends = {}, turns = [];
for (let i = 1; i <= 3000; i++) {
  const r = simulate(i, (s, e) => Math.floor(s.rand() * e.options.length));
  ends[r.end] = (ends[r.end] || 0) + 1;
  turns.push(r.turns);
}
turns.sort((a, b) => a - b);
console.log('endings:', ends, '| turns p10/p50/p90:', turns[300], turns[1500], turns[2700]);
assert(Object.keys(ends).length === 4, 'every ending should be reachable');

// daily: same seed + same choices → same game
const first = s => 0;
assert.deepEqual(simulate(42, first), simulate(42, first), 'daily is not deterministic');
console.log('ok');
