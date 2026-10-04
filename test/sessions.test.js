import test from 'node:test';
import assert from 'node:assert/strict';
import {createSession, addMatch, addGame, updateGame, finishSession, sessionSummary} from '../src/sessions.js';
import {act, win} from './helpers.js';
const session = () => createSession({id: 'thursday', ownerId: 'local-owner', start: '2026-10-01T22:04:00Z', timezone: 'America/New_York', title: 'Thursday Open Play'});
test('three rotating games stay in one 128-minute outing with 2-1 own results', () => {
  let s = session();
  const teams = [[['lee', 'mike'], ['sarah', 'jen']], [['lee', 'sarah'], ['mike', 'jen']], [['lee', 'jen'], ['mike', 'sarah']]];
  const scores = [[11, 7], [8, 11], [11, 4]];
  for (let i = 0; i < 3; i++) {
    s = addMatch(s, {id: `m${i}`, teams: teams[i], profileId: 'usap-2026-rally-doubles'});
    s = addGame(s, `m${i}`, {gameId: `g${i}`, startingTeam: i === 1 ? 1 : 0});
    let g = s.matches[i].games[0];
    const winner = i === 1 ? 1 : 0, loser = 1 - winner;
    for (let p = 0; p < scores[i][loser]; p++) g = win(g, loser);
    for (let p = 0; p < scores[i][winner]; p++) g = win(g, winner);
    s = updateGame(s, `m${i}`, g);
  }
  s = finishSession(s, '2026-10-02T00:12:00Z');
  assert.deepEqual(sessionSummary(s, 'lee').ownResults, {wins: 2, losses: 1});
  assert.equal(sessionSummary(s).durationMs, 128 * 60000); assert.equal(sessionSummary(s).completedGames, 3);
  assert.equal(sessionSummary(s).ownResults, null);
  assert.deepEqual(s.matches.map(m => m.games[0].state.points), scores);
  assert.equal(s.matches.length, 3); assert.equal(finishSession(s, s.end), s);
});
test('best-of match derives winner, and Undo invalidates the result', () => {
  let s = addMatch(session(), {id: 'best-of', gamesRequired: 2, target: 1, winBy: 1});
  for (const gameId of ['g1', 'g2']) {
    s = addGame(s, 'best-of', {gameId});
    s = updateGame(s, 'best-of', win(s.matches[0].games.at(-1), 0));
  }
  assert.equal(s.matches[0].winner, 0);
  assert.throws(() => addGame(s, 'best-of', {gameId: 'g3'}), {code: 'MATCH_COMPLETED'});
  s = updateGame(s, 'best-of', act(s.matches[0].games[1], 'UndoRally'));
  assert.equal(s.matches[0].winner, null); assert.equal(s.matches[0].status, 'open');
});
test('session completion requires explicit game completion/abandonment; excludes abandoned W/L', () => {
  let s = addGame(addMatch(session(), {id: 'm1'}), 'm1', {gameId: 'g1'});
  assert.throws(() => finishSession(s, '2026-10-02T00:12:00Z'), {code: 'ACTIVE_GAME'});
  assert.throws(() => addGame(s, 'm1', {gameId: 'g2'}), {code: 'ACTIVE_GAME'});
  s = updateGame(s, 'm1', act(s.matches[0].games[0], 'AbandonGame'));
  s = finishSession(s, '2026-10-02T00:12:00Z');
  assert.deepEqual(sessionSummary(s, 'a1').ownResults, {wins: 0, losses: 0});
  assert.equal(sessionSummary(s).incompleteGames, 1);
});
test('old game correction cannot create two active games or replace accepted journal', () => {
  let s = addGame(addMatch(session(), {id: 'm1', gamesRequired: 2, target: 1, winBy: 1}), 'm1', {gameId: 'g1'});
  const empty = s.matches[0].games[0]; const completed = win(empty, 0); s = updateGame(s, 'm1', completed);
  assert.throws(() => updateGame(s, 'm1', empty), {code: 'JOURNAL_CONFLICT'});
  s = addGame(s, 'm1', {gameId: 'g2'});
  assert.throws(() => updateGame(s, 'm1', act(completed, 'UndoRally')), {code: 'ACTIVE_GAME'});
});
test('partner/rule changes require a new match; invalid UTC date rejects', () => {
  const s = addMatch(session(), {id: 'm1'});
  assert.throws(() => addGame(s, 'm1', {gameId: 'g1', teams: [['x', 'y'], ['z', 'w']]}), {code: 'CONFIG_CONFLICT'});
  assert.throws(() => createSession({id: 's1', ownerId: 'owner', start: '2026-02-30T00:00:00Z', timezone: 'UTC'}), {code: 'INVALID_TIME'});
});
