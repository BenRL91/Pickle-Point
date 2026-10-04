import test from 'node:test';
import assert from 'node:assert/strict';
import {RULE_PROFILES, restoreGame, serializeGame, canonical} from '../src/engine.js';
import {game, act, win, physical} from './helpers.js';

function invariant(g) {
  const s = g.state, p = g.profile;
  assert(s.points.every(x => Number.isSafeInteger(x) && x >= 0));
  assert.equal(s.headRevision, g.journal.length);
  if (s.status === 'completed') { assert(s.points[s.winner] >= g.config.target); assert(s.points[s.winner] - s.points[1 - s.winner] >= g.config.winBy); }
  if (p.scoring !== 'simple') {
    assert(g.config.teams[s.servingTeam].includes(s.servingSlotId));
    assert(g.config.teams[1 - s.servingTeam].includes(s.receiverSlotId));
    assert.equal(s.positions.find(x => x.slotId === s.servingSlotId).side, s.serviceSide);
    assert.equal(s.positions.find(x => x.slotId === s.receiverSlotId).side, s.serviceSide);
  }
  if (p.discipline === 'doubles') for (const team of [0, 1]) {
    assert.deepEqual(s.positions.filter(x => x.team === team).map(x => x.side).sort(), ['left', 'right']);
    const anchor = s.positions.find(x => x.slotId === g.config.startingAnchors[team]);
    assert.equal(anchor.side, s.points[team] % 2 === 0 ? 'right' : 'left');
  }
}
test('bounded state exploration checks both winners and reversible transitions across all profiles', () => {
  let visitedCount = 0;
  for (const profileId of Object.keys(RULE_PROFILES)) for (const startingTeam of [0, 1]) {
    const queue = [game({profileId, startingTeam, target: 3, winBy: 2, switchEndsAt: 2})], seen = new Set();
    for (let i = 0; i < queue.length; i++) {
      const g = queue[i];
      const key = canonical(physical(g.state));
      if (seen.has(key)) continue; seen.add(key); visitedCount++; invariant(g);
      if (g.state.status !== 'playing' || Math.max(...g.state.points) >= 5) continue;
      for (const winner of [0, 1]) {
        const next = win(g, winner); invariant(next);
        const undone = act(next, 'UndoRally'); assert.deepEqual(physical(undone.state), physical(g.state));
        const redone = act(undone, 'RedoRally'); assert.deepEqual(physical(redone.state), physical(next.state));
        assert.deepEqual(restoreGame(serializeGame(next)), next);
        queue.push(next);
      }
    }
  }
  assert(visitedCount > 200); console.log(`Explored ${visitedCount} distinct bounded states.`);
});
test('seeded long deuce games, corrections and replay remain deterministic', () => {
  let seed = 932174;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed; };
  for (const profileId of Object.keys(RULE_PROFILES)) {
    let g = game({profileId, target: 100, switchEndsAt: 8});
    for (let i = 0; i < 60; i++) {
      const before = g, next = win(g, (random() >>> 16) % 2); invariant(next);
      let changed = act(next, 'UndoRally'); assert.deepEqual(physical(changed.state), physical(before.state));
      changed = act(changed, 'RedoRally'); assert.deepEqual(physical(changed.state), physical(next.state));
      if (i % 9 === 0) changed = act(changed, 'FlipView');
      g = restoreGame(serializeGame(changed)); invariant(g);
      assert.equal(serializeGame(g), serializeGame(restoreGame(serializeGame(g))));
    }
  }
});
