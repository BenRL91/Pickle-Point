import test from 'node:test';
import assert from 'node:assert/strict';
import {applyCommand, restoreGame, serializeGame} from '../src/engine.js';
import {game, act, win} from './helpers.js';
test('JSON journal recovery restores exact state after every command', () => {
  let g = game();
  for (const [type, fields] of [['RallyWon', {winner: 0}], ['RallyWon', {winner: 1}], ['FlipView', {}],
    ['UndoRally', {}], ['RedoRally', {}], ['AbandonGame', {}], ['ReopenGame', {}]]) {
    g = act(g, type, fields); assert.deepEqual(restoreGame(serializeGame(g)), g);
  }
});
test('stale/corrupt checkpoint is ignored and rebuilt from accepted journal', () => {
  const g = win(win(game(), 0), 1); const raw = JSON.parse(serializeGame(g));
  raw.state = {points: [999, 999]}; assert.deepEqual(restoreGame(raw), g);
});
test('changed journal, broken sequence, duplicated event and profile drift reject', () => {
  const g = win(win(game(), 0), 1);
  for (const change of [
    x => { x.journal[0].command.winner = 1; },
    x => { x.journal[0].afterChecksum = 'changed'; },
    x => { x.journal[0].sequence = 7; },
    x => { x.journal[1].command.eventId = x.journal[0].command.eventId; }
  ]) { const raw = JSON.parse(serializeGame(g)); change(raw); assert.throws(() => restoreGame(raw), {code: 'CORRUPT_JOURNAL'}); }
  const raw = JSON.parse(serializeGame(g)); raw.profile.version = '2027';
  assert.throws(() => restoreGame(raw), {code: 'UNSUPPORTED_RULES'});
  raw.engineVersion = '2027'; assert.throws(() => restoreGame(raw), {code: 'UNSUPPORTED_ENGINE'});
});
test('an identical retried event is acknowledged without another rally or haptic', () => {
  const g = game(); const command = {type: 'RallyWon', winner: 0, eventId: 'stable', at: '2026-10-04T02:25:00Z', expectedRevision: 0, hostEpoch: 1};
  const first = applyCommand(g, command); const retry = applyCommand(first.game, command);
  assert.equal(retry.duplicate, true); assert.deepEqual(retry.effects, []); assert.deepEqual(retry.game, first.game);
  assert.throws(() => applyCommand(first.game, {...command, winner: 1}), {code: 'EVENT_ID_CONFLICT'});
});
test('stale revision and rival host cannot append or mutate original game', () => {
  const g = win(game(), 0); const before = serializeGame(g);
  assert.throws(() => act(g, 'RallyWon', {winner: 0, expectedRevision: 0}), {code: 'STALE_REVISION'});
  assert.throws(() => act(g, 'RallyWon', {winner: 0, hostEpoch: 2}), {code: 'STALE_HOST'});
  assert.equal(serializeGame(g), before);
});
test('invalid winner, timestamp, ID and unknown fields fail explicitly', () => {
  for (const [fields, code] of [[{winner: 2}, 'INVALID_TEAM'], [{at: '2026-02-30T02:25:00Z'}, 'INVALID_TIME'],
    [{eventId: 'not/an/id'}, 'INVALID_ID'], [{points: [10, 0]}, 'INVALID_COMMAND']]) {
    assert.throws(() => act(game(), 'RallyWon', {winner: 0, ...fields}), {code});
  }
});
test('missing journal entries fail with a recovery error rather than resetting', () => {
  const raw = JSON.parse(serializeGame(win(game(), 0))); raw.journal[0] = null;
  assert.throws(() => restoreGame(raw), {code: 'CORRUPT_JOURNAL'});
});
