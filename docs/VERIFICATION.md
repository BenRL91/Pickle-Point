# Verification result

Full deterministic suite: **32 passed, 0 failed**, including **574 distinct bounded scoring states** explored across profiles and starting teams. Latest complete output is in `test-results.txt`.

After that run, the outing example test was strengthened from short boundary games to the exact requested final scores **11–7, 8–11, 11–4** with rotating partners. The affected session suite was run again: **5 passed, 0 failed**. It confirms one 128-minute outing with Lee's 2–1 results. No engine code changed after the final complete suite.

The Quick Play command-line demo also passed. Existing PaddleLog and coaching checkouts remained clean. No existing-app tests were run because those applications were not modified. There is no claim of watch/phone disconnect hardware testing, durable disk transaction testing or native/health integration testing; recovery here tests serialization/replay and invalid journal/checkpoint handling.

Limit: pure JS reference reducer uses full replay for every command; physical-watch latency, checkpoints, native reducer parity and durable adapter failure injection remain upcoming implementation work.

## Phone/tablet preview 0.2.0 — 2026-10-04

Full suite: **51 tests passed, 0 failed**, approximately 24 seconds. Includes the original scoring tests and 574 bounded reachable-state checks, plus eight description-parsing tests, six app-model tests, four fake-indexeddb transaction tests, and one linkedom DOM workflow test.

The DOM test covers the exact description → editable setup → start → rally → Undo → game completion → next game → persisted outing. It is a DOM simulation, not browser rendering or real-device verification. Storage tests cover reopen, simultaneous competing writes, rejected writes preserving existing state, and exportability of unsupported stored schemas. Syntax checks passed. A separate 180-rally Node reference-engine timing check showed a 30 ms final transition and 43 ms maximum on this execution host; mobile-device latency remains unmeasured.

No real microphone, native OS, browser layout, or integration QA is claimed. See PHONE-PREVIEW.md for remaining device checks and connectivity limitations.
