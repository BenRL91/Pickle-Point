# Pickle Point phone/tablet preview — 0.2.0

This milestone adds a private responsive web interface around the isolated scoring engine. Apple Watch and Wear OS implementation are deferred per the user's direction. iPhone/iPad/Android native packaging is future work; this release is a browser app.

## Implemented
- One-tap Quick Play: traditional doubles, 11, win by 2, guest slots.
- Game setup: singles/doubles; traditional or USAP 2026 rally; target/win-by; first serving team; right/left starting players; optional switch threshold; title and venue.
- Description setup: optional Web Speech API transcription, keyboard dictation or typed text, local deterministic parsing, editable preview before starting. Exact user example and unpunctuated transcripts tested. A new description does not automatically start or modify a live game.
- Recent/favorite player chips; save names at start; swap partners; randomize; same teams through next-game/rematch setup. People do not need accounts.
- Tap-winning-team scoring, visible one-rally Undo, transient Redo, explicit score call, court service-position diagram, server role and end-switch orientation, manual view flip.
- Game completion retains Undo; incomplete games can resume before starting the next game. One outing contains all its games. MVP UI currently creates one-game matches; core supports structured matches for a later UI.
- Local session history, post-game player assignment, self-selected player stats, favorites, player editing and deletion/anonymization, session deletion, JSON backup export.
- Atomic IndexedDB save before UI confirmation; immutable rally journal and derived session saved together; optimistic revision comparison prevents tab overwrite. Background/visibility refresh uses BroadcastChannel where supported, with revision checking always enforced.
- Recover committed games by replaying the stored journals. Invalid/unknown data blocks scoring and offers raw export; it never silently resets.

## Storage, connectivity and privacy
This is device-local storage, not LeewayPB cloud identity. Site hosting remains owner-private. Core scoring has no network dependency once loaded. Fresh app loading/reloading still needs a connection; there is no service-worker offline shell yet. Browser storage may be evicted; request persistent storage and export backups. Restore/import UI is not yet shipped. Single whole-library CAS storage is suitable for the preview; migrate to per-session transactions and versioned outbox before large histories/cloud sync.

Descriptions are ephemeral and not persisted. Audio is not recorded or uploaded by Pickle Point code. The browser's selected speech provider may send audio to its service; that disclosure appears before the microphone button is used. Microphone use starts only after the user taps it and grants applicable browser permission. Navigation, dismissal and backgrounding abort listening. Speech errors preserve typed input. The bounded English parser is not a general language model: unfamiliar formats require manual review. Exact saved-name matching is used, not automatic fuzzy identity merging.

Scores and participant labels are separate. Post-game identity assignments do not rewrite the rally journal or serving slots. Deleting a saved player removes that identity/name from this app's local histories and retains anonymized scores. Player name edits apply to the library; historical labels remain snapshots unless reassigned.

## Integration boundaries
No PaddleLog, coaching, Supabase, HealthKit, Health Connect, subscription or payment changes are included. Prior architecture findings must be refreshed at the integration milestone, especially PaddleLog's newer multi-paddle session work and Apple auth configuration. Existing PaddleLog physical-paddle references and interval contracts must be reconciled before cross-app writes. A Site owner gate is not the future shared LeewayPB account model.

## Verification limits
Automated scoring, model, storage-emulation and DOM-emulation tests run in Node. The managed environment does not expose the Sites-required control-browser skill, so no preview server/browser automation was started. Real layout rendering, Safari/iPhone/iPad/Android IndexedDB durability, permission prompts, speech provider behavior, device scoring latency, outdoor usability and assistive technology require device QA. Native shells, background workout behavior and Watch apps have not been implemented or tested.

Reference Web Speech API behavior: https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition and https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API/Using_the_Web_Speech_API (checked 2026-10-04).

## Next delivery
1. Device/court QA on this build; refine voice descriptions and setup friction from observed failures.
2. Durable offline app shell, tested storage migrations, backup restore and per-session persistence/outbox.
3. Refresh suite identity/PaddleLog audit, resolve explicit grants and contracts, then staging cloud and equipment integrations.
4. Capacitor iOS/iPadOS/Android builds, platform integrations and TestFlight/closed testing.
5. Native Watch/Wear OS later, reusing versioned contracts and deterministic fixtures.
