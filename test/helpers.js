import {createGame, applyCommand} from '../src/engine.js';
export function game(options = {}) { return createGame({gameId: 'game-1', ...options}); }
export function act(g, type, fields = {}) {
  return applyCommand(g, {type, eventId: `e-${g.journal.length + 1}`, at: '2026-10-04T02:25:00Z',
    expectedRevision: g.journal.length, hostEpoch: g.config.hostEpoch, ...fields}).game;
}
export const win = (g, winner) => act(g, 'RallyWon', {winner});
export function physical(s) {
  const {headRevision, effectiveRallyIds, redoEventId, ...rest} = s; return rest;
}
