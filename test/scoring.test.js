import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGame, applyCommand, RULE_PROFILES} from '../src/engine.js';
import {game, act, win, physical} from './helpers.js';
const fixtures = JSON.parse(readFileSync(new URL('./fixtures/golden.json', import.meta.url)));
for (const fixture of fixtures) test(`golden: ${fixture.name}`, () => {
  let g = createGame(fixture.config);
  for (const row of fixture.steps) {
    const result = applyCommand(g, {type: 'RallyWon', winner: row.winner, eventId: `g-${g.journal.length}`,
      at: '2026-10-04T02:25:00Z', expectedRevision: g.journal.length, hostEpoch: 1});
    g = result.game;
    assert.deepEqual(g.state.points, row.points); assert.deepEqual(g.state.scoreCall, row.call);
    assert.equal(g.state.servingSlotId, row.server); assert.equal(g.state.serviceSide, row.side);
    assert.deepEqual(result.effects, row.effects);
  }
});
test('starting team/anchor variants all open at 0-0-2 with correct slot', () => {
  for (const startingTeam of [0, 1]) for (const a of ['a1', 'a2']) for (const b of ['b1', 'b2']) {
    const g = game({startingTeam, startingAnchors: [a, b]});
    assert.deepEqual(g.state.scoreCall, [0, 0, 2]);
    assert.equal(g.state.servingSlotId, [a, b][startingTeam]);
    assert.equal(g.state.serviceSide, 'right');
    assert.equal(win(g, 1 - startingTeam).state.serverNumber, 1);
  }
});
test('second server is a turn role, not a fixed person', () => {
  let g = game(); g = win(g, 0); g = win(g, 1); // B serving
  g = win(g, 0); g = win(g, 0); // A score 1: a2 begins next turn
  assert.equal(g.state.servingSlotId, 'a2'); assert.equal(g.state.serverNumber, 1);
  g = win(g, 1); assert.equal(g.state.servingSlotId, 'a1'); assert.equal(g.state.serverNumber, 2);
});
test('traditional singles no point on receiving win and no server-number cue', () => {
  const g = win(game({profileId: 'usap-2026-side-out-singles'}), 1);
  assert.deepEqual(g.state.points, [0, 0]); assert.equal(g.state.servingTeam, 1);
  assert.equal(g.state.serverNumber, null); assert.equal(g.state.receiverSlotId, 'a1');
});
test('single receiver stands diagonal to serving side even when scores have different parity', () => {
  const g = win(game({profileId: 'usap-2026-side-out-singles'}), 0);
  assert.deepEqual(g.state.positions.map(x => x.side), ['left', 'left']);
});
test('win-by-two deuce is not an accidental game completion', () => {
  let g = game({profileId: 'usap-2026-rally-singles'});
  for (let i = 0; i < 10; i++) { g = win(g, 0); g = win(g, 1); }
  g = win(g, 0); assert.equal(g.state.status, 'playing'); assert.deepEqual(g.state.points, [11, 10]);
  g = win(g, 0); assert.equal(g.state.status, 'completed'); assert.deepEqual(g.state.points, [12, 10]);
  assert.throws(() => win(g, 1), {code: 'GAME_NOT_PLAYING'});
});
test('USAP 2026 receiver may win the game; traditional receiver cannot score', () => {
  let g = game({profileId: 'usap-2026-rally-doubles', target: 3, winBy: 1});
  g = win(g, 1); g = win(g, 1); g = win(g, 0); g = win(g, 1);
  assert.equal(g.state.winner, 1); assert.deepEqual(g.state.points, [1, 3]);
  const traditional = win(game({target: 1, winBy: 1}), 1);
  assert.equal(traditional.state.winner, null); assert.deepEqual(traditional.state.points, [0, 0]);
});
test('game-point projections are possible scoring opportunities, not win claims', () => {
  let g = game({target: 2, winBy: 1}); g = win(g, 0);
  assert.deepEqual(g.state.gamePointTeams, [0]); g = win(g, 1);
  assert.deepEqual(g.state.gamePointTeams, []);
});
test('end switch occurs once and Undo/Redo reverses it with scoring state', () => {
  let g = game({profileId: 'usap-2026-rally-doubles', switchEndsAt: 2}); g = win(g, 0);
  const prior = g; g = win(g, 0);
  assert.equal(g.state.leftTeam, 1); assert.equal(g.state.endsSwitched, true);
  const switched = g; g = act(g, 'UndoRally'); assert.deepEqual(physical(g.state), physical(prior.state));
  g = act(g, 'RedoRally'); assert.deepEqual(physical(g.state), physical(switched.state));
  g = win(g, 1); g = win(g, 1); assert.equal(g.state.leftTeam, 1);
});
test('visible Undo recovers accidental final point', () => {
  let g = game({target: 1, winBy: 1, switchEndsAt: 1}); const prior = g;
  g = win(g, 0); assert.equal(g.state.status, 'completed');
  g = act(g, 'UndoRally'); assert.deepEqual(physical(g.state), physical(prior.state));
  assert.equal(g.state.redoEventId, 'e-1');
  g = win(g, 1); assert.equal(g.state.redoEventId, null);
  assert.throws(() => act(g, 'RedoRally'), {code: 'NOTHING_TO_REDO'});
});
test('multiple Undo actions each reverse exactly one effective rally', () => {
  let g = game(); const start = g; g = win(g, 0); const one = g; g = win(g, 0); g = win(g, 1);
  g = act(g, 'UndoRally'); g = act(g, 'UndoRally');
  assert.deepEqual(physical(g.state), physical(one.state));
  g = act(g, 'UndoRally'); assert.deepEqual(physical(g.state), physical(start.state));
  assert.equal(g.state.effectiveRallyIds.length, 0);
  assert.throws(() => act(g, 'UndoRally'), {code: 'NOTHING_TO_UNDO'});
});
test('Flip view does not change physical positions, score or server; Undo retains perspective', () => {
  let g = win(game(), 0); const flipped = act(g, 'FlipView');
  assert.deepEqual(flipped.state.points, g.state.points); assert.deepEqual(flipped.state.positions, g.state.positions);
  assert.equal(flipped.state.servingSlotId, g.state.servingSlotId);
  assert.equal(flipped.state.screenLeftTeam, 1);
  g = act(flipped, 'UndoRally'); assert.equal(g.state.viewFlipped, true); assert.equal(g.state.screenLeftTeam, 1);
});
test('abandoned games cannot be scored until explicitly reopened', () => {
  let g = win(game(), 0); g = act(g, 'AbandonGame');
  assert.throws(() => win(g, 0), {code: 'GAME_NOT_PLAYING'});
  assert.throws(() => act(g, 'UndoRally'), {code: 'GAME_ABANDONED'});
  g = act(g, 'ReopenGame'); assert.deepEqual(g.state.points, [1, 0]);
  g = act(g, 'UndoRally'); assert.deepEqual(g.state.points, [0, 0]);
});
test('simple scoring awards one point without fabricated server/position logic', () => {
  const g = win(game({profileId: 'simple-v1'}), 1);
  assert.deepEqual(g.state.points, [0, 1]); assert.deepEqual(g.state.positions, []);
  assert.equal(g.state.servingTeam, null); assert.equal(g.state.serverNumber, null);
});
test('configs/profile snapshots and resulting games are immutable', () => {
  const teams = [['lee', 'mike'], ['sarah', 'jen']]; const g = game({teams}); teams[0][0] = 'changed';
  assert.equal(g.config.teams[0][0], 'lee');
  assert.throws(() => { g.state.points[0] = 100; }, TypeError);
  assert.throws(() => { RULE_PROFILES[g.config.profileId].version = 'next'; }, TypeError);
  assert.throws(() => { g.config.teams[0][0] = 'next'; }, TypeError);
});
test('unknown rally formats and invalid settings/rosters fail closed', () => {
  for (const [cfg, code] of [
    [{profileId: 'mlp-rally'}, 'UNSUPPORTED_RULES'], [{profileId: 'toString'}, 'UNSUPPORTED_RULES'],
    [{teams: [Array(2), ['b1', 'b2']]}, 'INVALID_ROSTER'], [{target: 0}, 'INVALID_SETTINGS'],
    [{winBy: 0}, 'INVALID_SETTINGS'], [{switchEndsAt: 12}, 'INVALID_SETTINGS'],
    [{teams: [['a', 'a'], ['c', 'd']]}, 'INVALID_ROSTER'],
    [{startingAnchors: ['unknown', 'b1']}, 'INVALID_ANCHOR'], [{startingTeam: 2}, 'INVALID_TEAM']
  ]) assert.throws(() => game(cfg), {code});
});
