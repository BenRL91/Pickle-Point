# Integration and implementation decisions

Statuses are deliberate: **adopted locally** permits this isolated engine; **recommended/gated** is not permission to modify existing applications or infrastructure. No payment path exists.

| Decision | Status | Resolution / gate |
| --- | --- | --- |
| Pure deterministic domain first | Adopted locally | Dependency-free JS ESM with explicit IDs/times, immutable snapshots and fixtures; phone/browser consumers can run it without network |
| Launch scoring prototype | Adopted locally | Versioned USAP 2026 traditional singles/doubles, USAP rally, simple mode; no guessed MLP variants |
| Hierarchy | Adopted locally | Session → Match → Game → journal; mutable names outside engine slots |
| Active authority | Adopted locally | One expected revision/host epoch; no automatic device takeover or score branch merge |
| Shared identity | ADR-006 accepted / cloud implementation gated | Reuse current Supabase issuer and preserve existing Leeway UUIDs. Do not mint a Pickle Point suite UUID; future cloud onboarding resolves the authoritative Leeway UUID, then establishes independent `pickle_point/player` membership. Hosting owner access remains unrelated. |
| Score storage | Recommended/gated | Separate Score Workers/D1 is aligned with current stack; choose/provision only after API/native access and account-resolution design review |
| App permissions | Required before integration | Per-app owner checks, explicit operation-limited grants; no shared database credentials or library-wide reads |
| PaddleLog timing edits | Recommended/gated | PaddleLog-only visible override; source-aware mapping/validator/backup/old-client migration separately reviewed before writes |
| PaddleLog deletion/retry | Required before integration | Suppression tombstones and stable interval source identity; source-aware deletion effects and manual overlap review |
| Health storage | Recommended/gated | Platform store/device default; server status/minimal opaque link only; no raw health upload |
| Apple workouts | Device/SDK gate | Exact pickleball type exists, but safe coexistence/automatic-start behavior and uncertain-save retry need proof |
| Android workouts | Platform gate | Health Connect session store with stable client IDs; generic workout fallback if pinned SDK still lacks pickleball; no phone-only invented sensors |
| Native parity | Next milestone | Swift/Kotlin ports consume checked-in fixtures; portable shared-core choice only after performance/build prototype |
| Working branding | Provisional | Pickle Point display name; no permanent domain/bundle/package registration |
| Old `leeway-score` IDs in planning | Unregistered draft | Review machine source names/URLs before contract launch; no migration required because no source integration exists yet |
| Pricing/payments | Not implemented | No pricing decision, subscriptions or payment configuration changed |

Next sequence: keep phone/tablet first; expand local fixtures and durable transaction/checkpoint work → use the accepted ADR-006 account/membership boundary when designing cloud onboarding → choose/provision an independent backend only after staging/API review → review the additive PaddleLog usage contract in staging → health duplicate/coexistence device tests → connected beta. Watch targets remain deferred. Do not interpret later phases as authorization for production cross-app writes.

The isolated scoring engine is executable now without those integration decisions. A developer receiving this package should run the tests, preserve rule/engine versions, refresh audit if source changes, and keep integration code disabled until its particular gate is resolved.
