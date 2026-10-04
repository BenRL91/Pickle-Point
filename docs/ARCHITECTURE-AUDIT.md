# Read-only architecture refresh

Audit performed during the October 3, 2026 America/New_York implementation request. No product data rows were read. No auth, permissions, payment configuration, database schema, repository source or deployment was modified in existing LeewayPB apps.

| Item | Refreshed evidence | Implementation implication |
| --- | --- | --- |
| PaddleLog | Latest saved version 94, source `bc368e24569e104e5c05db0188d3a1072c4d6346` | Advanced since handoff version 93 |
| Changes since handoff | Catalog data, catalog UI/reconciliation/audit/tests | No changes to session validator, library persistence, account mapping, account verification or state route |
| Coaching | Latest saved version 47, source `a041b74bd98eb4d11426c263970dd1c65256e770` | Same source as original audit |
| PaddleLog auth mode | `supabase`; provider project `eclxqfmuqeavwwafbvhu` | Reuse existing identity; do not provision a second auth system |
| Public provider settings | Google/email true, Apple false, anonymous false, signup enabled | Apple remains a configuration/verification gate |
| Coaching runtime | `SITE_ACCESS_MODE=owner`, `STRIPE_MODE=sandbox` | Kept unchanged |
| Existing checkouts | Clean after source refresh | No uncommitted product edits |

Refresh methods: latest saved-version queries, read-only runtime configuration, source helper fetch/open, Git diff, inspection of current relevant source and provider `/auth/v1/settings` using configured publishable key. Latest saved source is not automatically proof of the current deployment; no deployment or production user flow was tested.

Current PaddleLog session representation is `id,paddleId,start,end,notes,ball,location,environment,weather,netType,photoId,beforePhotoId,afterPhotoId`, with optional `estimatedHours`. Unknown source fields still drop in `public/validate.js`. The physical paddle is the current `paddleId`; no second required unit identifier exists. Score must not send estimates or unknown provenance fields through `/api/state` and assume they survive.

`lib/server/library.ts` remains account-scoped normalized D1 storage with reconstructed compatibility state, recovery backup and CAS guarded atomic writes. `account_logs` remains a legacy fallback. `maintenance.js` derives use from sessions; recorded overlaps are still summed. Stable source ID/tombstone mapping and manual-overlap review are prerequisites to cross-app usage writes.

Verified external issuer+subject is mapped to a Leeway UUID in PaddleLog's own D1 `leeway_accounts/leeway_identities`. That UUID is not simply the Supabase subject. No suite registry API has been extracted in this milestone. Coaching booking/customer access remains separate from that shared auth path. Neither common name/email nor subscription proves cross-app permission.

Unverified: complete management Auth configuration, redirect allowlist/manual linking/Apple credentials, bundle IDs/minimum OS/signing, native secure storage/device sign-in, complete deep-link associations, public deployment source parity, real-court behavior. All credentials remain outside this package. No existing app source is copied into this project.
