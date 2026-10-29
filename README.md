# Pickle Point

**Pickleball scoring built around a deterministic, recoverable game engine.**

Pickle Point models the details behind a score: serving order, court positions, end changes, match results and corrections. A phone/tablet interface wraps the engine with Quick Play, player management and local session history.

[Scoring specification](docs/SCORING-SPEC.md) · [Phone preview](docs/PHONE-PREVIEW.md) · [Verification](docs/VERIFICATION.md) · [Contributing](CONTRIBUTING.md)

## Product capabilities

- Start a doubles game quickly or configure singles, doubles, side-out and rally profiles.
- Score by winning team with visible Undo and a transient Redo opportunity.
- Display score calls, service positions and court orientation.
- Organize players, games and session history with local persistence.
- Turn typed or optional speech-transcribed descriptions into an editable game setup.

## Engineering highlights

| Concern | Design |
| --- | --- |
| Repeatable scoring | Pure engine with immutable rule snapshots; caller supplies IDs and timestamps |
| Safe retries | Stable event IDs, duplicate detection and expected revisions |
| Recovery | Rebuild derived state from the accepted command journal |
| Corrections | Undo restores score, server and end-switch state, including accidental game completion |
| Persistence | Atomic IndexedDB saves and optimistic revision checks in the preview adapter |
| Compatibility | Versioned rule profiles; unknown versions fail closed |

The engine does not perform network requests, generate clocks or IDs, or authorize a scorer. Those responsibilities belong to adapters. Journal checksums detect accidental corruption; they are not cryptographic proof of a result.

## Development

Node.js **22 or later**.

```sh
npm ci
npm test
npm run demo
npm run build
```

The engine uses JavaScript ES modules. Development dependencies support IndexedDB and DOM emulation. Tests cover golden scoring transitions, bounded exploration, seeded traces, recovery, session behavior and UI/storage adapters. These checks do not establish real-device durability or court usability.

## Code tour

| Path | Responsibility |
| --- | --- |
| [src/engine.js](src/engine.js) | Scoring commands and state transitions |
| [src/sessions.js](src/sessions.js) | Session → match → game hierarchy |
| [src/storage.js](src/storage.js) | Local persistence adapter |
| [src/app-model.js](src/app-model.js) | Application state orchestration |
| [src/description.js](src/description.js) | Deterministic setup-description parser |
| [test/](test/) | Regression and property-oriented tests |

## Release status

This README describes the source on this branch. The existing phone-preview notes document the local browser milestone; the deployed app is being synchronized separately. Native Watch/Wear OS apps and health integrations must not be inferred from the scoring engine's portability. See [integration decisions](docs/INTEGRATION-DECISIONS.md) for boundaries and planned work.

Changes follow pull requests and CI. Source merges do not deploy the app.

## Related projects

| Project | Responsibility |
| --- | --- |
| [PaddleLog](https://github.com/BenRL91/PaddleLog) | Equipment, maintenance and usage history |
| [Pickle Point](https://github.com/BenRL91/Pickle-Point) | Scoring, games and sessions |
| [Leeway Coaching](https://github.com/BenRL91/Leeway-Coaching) | Booking and breakdown fulfillment |
| [Leeway Replay](https://github.com/BenRL91/Leeway-Replay) | Private video reviews and discussion |
| [Leeway Common](https://github.com/BenRL91/Leeway-Common) | Shared notification components and service |

Each repository has its own release lifecycle. Shared identity does not grant access to another app's private data.
