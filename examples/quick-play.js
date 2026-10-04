import {createGame, applyCommand, serializeGame, restoreGame} from '../src/engine.js';
let game = createGame({gameId: 'quick-play-example'});
for (const [index, winner] of [0, 1, 0, 0, 1].entries()) {
  const result = applyCommand(game, {type: 'RallyWon', winner, eventId: `rally-${index}`,
    at: '2026-10-04T02:25:00Z', expectedRevision: game.state.headRevision, hostEpoch: 1});
  game = result.game;
  console.log({call: game.state.scoreCall.join('-'), server: game.state.servingSlotId,
    side: game.state.serviceSide, effects: result.effects});
}
game = applyCommand(game, {type: 'UndoRally', eventId: 'undo-example', at: '2026-10-04T02:26:00Z',
  expectedRevision: game.state.headRevision, hostEpoch: 1}).game;
console.log({afterUndo: game.state.scoreCall, restored: restoreGame(serializeGame(game)).state.scoreCall});
