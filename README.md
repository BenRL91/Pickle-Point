# Pickle Point — phone/tablet preview 0.2.0

Private responsive web app with Quick Play, optional voice/text game descriptions, player library, session history and local persistence. Native packaging and cloud/integrations are subsequent milestones. See [Phone preview notes](docs/PHONE-PREVIEW.md).

Run `npm ci`, `npm run build`, and `npm test`. The Site serves `dist/`; `src/` is copied into `dist/src/` by the build.

# Pickle Point — isolated scoring engine

Working name. Version 0.1.0. This is the first implementation milestone, not a released phone/watch app.

## Run

Node 22 or later; no third-party dependencies and no install step.

```sh
npm test
npm run demo
```

`node --test test/*.test.js` is equivalent. Tests include manually specified golden transitions, bounded exploration, seeded traces, journal corruption/retry tests, and outing/match behavior. See `test-results.txt` for the latest run. No Xcode, HealthKit, Health Connect, native Watch, physical court, cloud or PaddleLog write has been tested by this milestone.

## Use the engine

```js
import {createGame, applyCommand, serializeGame, restoreGame} from './src/engine.js';

const before = createGame({gameId: 'stable-game-id'}); // doubles, side-out, 11, win by 2
const result = applyCommand(before, {
  type: 'RallyWon', winner: 0,
  eventId: 'stable-command-id', at: '2026-10-04T02:25:00Z',
  expectedRevision: before.state.headRevision, hostEpoch: before.config.hostEpoch
});
// The host adapter must atomically persist result.game and its outbox BEFORE
// publishing result.game.state or playing result.effects as success feedback.
const bytes = serializeGame(result.game);
const recovered = restoreGame(bytes);
```

The caller supplies stable game/event IDs, UTC timestamps, expected revision and host epoch. The engine creates no clocks, IDs, network requests, file writes, auth sessions or health records. Returned objects and immutable rule snapshots are deeply frozen; input is never mutated. `ScoringError.code` is the adapter-facing error contract.

`applyCommand` supports RallyWon, UndoRally, RedoRally, FlipView, AbandonGame and ReopenGame. An identical event retry returns `duplicate:true` with no effects. Reusing an ID with different payload rejects. Stale revisions and rival epochs reject; epochs alone are not authorization. All platform adapters must enforce the actual single-writer permission.

Undo reverses one effective rally, including completion, server and derived end switches. Redo is one candidate, retained until a new rally or abandonment. View perspective is independent and survives rally Undo. Ended accidental game point can be undone immediately. Abandonment requires explicit reopening before scoring/correction. Names are not engine identities; stable player slots keep scoring intact when names are assigned later.

## Supported rule profiles

- `usap-2026-side-out-doubles`
- `usap-2026-side-out-singles`
- `usap-2026-rally-doubles`
- `usap-2026-rally-singles`
- `simple-v1` (score only; no fabricated server/court behavior)

Target, win-by, starting team, team starting anchors, starting physical left team, one end-switch threshold and host epoch are configurable. The snapshot and engine version accompany every game. Unknown profiles/versions fail closed instead of silently replaying history under different rules. Do not mutate an existing profile to implement a future rule change: add a version and retain the old reducer.

Output includes score, score call, serving team/slot, transient server number (traditional doubles), service side, receiver, required service positions, game-point opportunities, winner/status, physical left team and screen orientation. Court side is relative to each team's view facing the net. It does not measure physical player movement or stacking. The active server is retained at completion to show the final transition; gameplay is terminal until Undo.

## Session hierarchy

`src/sessions.js` models ScoreSession → Match → Game → journal. Its owner ID is an opaque local reference, not verified suite identity. Casual matches require one win; best-of uses required wins. Match results derive from completed games and invalidate after Undo. Team/rule changes require a new match. A session cannot finish or start a second active game without explicitly completing/abandoning the current game. A scorer absent from the roster has no inferred W/L. A finished session's correction/reopen workflow is not implemented yet.

## Recovery and integrity

Accepted journal commands plus initial config are authoritative. Cached state is ignored during restoration and rebuilt; changed journal transitions/profile/version reject. Checksums use FNV-1a over canonical JSON UTF-8, for accidental corruption only. They are not signatures, are not collision-resistant and do not prove sporting results or user permission. Production cloud must validate ownership/host and replay events; cryptographic authenticity is a separate boundary.

This reference implementation replays the journal on each command. That is deliberate for correctness verification, but it is not the final low-latency watch persistence path. Benchmark/checkpoint design and native reducer parity are next. Bounded exploration covers all reachable states within its configured finite limits, not literally all scores of unbounded win-by-two games.

## Current scope limits

No UI, persistent local adapter, cloud backend, authentication integration, payments, PaddleLog write, health export, native watch target or deployment. No MLP freeze/DreamBreaker rules, technical-foul officiating, manual arbitrary score baseline correction, roster replacement within a live game, multi-scorer handoff, automatic pauses, equipment interval writer or future scoring-profile migration. Unknown variants are rejected. These remain explicit future work, not simulated integrations.

Read `docs/ARCHITECTURE-AUDIT.md` for refreshed live/source evidence, `docs/INTEGRATION-DECISIONS.md` for gated architecture decisions, and `docs/SCORING-SPEC.md` for rule provenance and platform-neutral behavior. All code lives in an isolated directory; neither audited existing app was edited.
