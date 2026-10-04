# Scoring/replay contract — 0.1.0

Rule basis rechecked at implementation: [USA Pickleball 2026 rulebook](https://fliphtml5.com/cksih/USAP-Official-Rulebook/) via the [official rules portal](https://usapickleball.org/rules/). Sections 4, 5 and 14.A underpin profiles. Older USAP web articles can describe win-on-serve rules; this prototype specifically uses the 2026 provisional option. No official rulebook prose/assets are bundled.

Traditional scoring awards only the serving side. Doubles uses the opening one-server exception followed by two-server service turns. A starting anchor is right on even own-team scores and left on odd; the next service turn begins with the player then positioned right. Singles server/receiver position follows the serving score. USAP 2026 rally awards each rally to its winner, uses one doubles server before side out and a two-number score call; receiving-side game winners are allowed. The configured target/lead determines completion.

## Envelope

Every command contains `type,eventId,at,expectedRevision,hostEpoch`; RallyWon adds `winner` (0 or 1). Reject unknown fields, invalid UTC timestamps/IDs, unsupported type/profile/version, stale revision/epoch, illegal terminal-state action and conflicting retry. No timestamp sorting: append sequence is authoritative. Caller timestamp can differ from network reception time; do not derive duration from rally spacing.

Accepted entries contain sequence, original command, before/after checksum, semantic effects and engine version. Stable IDs plus identical command bytes acknowledge retries without points/effects; checksums are not signatures. JSON key canonicalization is recursive lexicographic key ordering, array ordering preserved, finite safe integers; UTF-8 FNV-1a 32-bit checksum. Platform ports must match fixtures and journal bytes/checksums before interoperability. Domain IDs are ASCII and labels are external.

## UI output and corrections

`scoreCall` is serving team's score first, receiving team's second, plus current turn's server number for traditional doubles. `serviceSide` is right/left relative to that team facing the net; receiver is diagonally opposite on the corresponding relative service side. Court positions are required service positions, not realtime tracking or stacking instructions.

Physical end mapping and view flip are independent. Configured end threshold changes ends once; rally Undo reverses that effect. View flip persists independently through scoring correction. A rally can emit point/side-out/switch-ends/game-won together; adapters choose a single prioritized haptic (game-won → switch-ends → side-out → second-server → point) after persistence. The engine doesn't call audio/haptic APIs.

Undo removes the latest effective rally frame without deleting accepted journal entries. Redo restores the exact latest undone frame; new rally clears eligibility. Repeated Undo replaces the single Redo candidate. A game completed by a mistaken point returns to playing on Undo. Abandon/Reopen are explicit lifecycle commands; arbitrary manual score/server edits are not implemented yet.

Snapshots carry engine/profile versions. Recovery reconstructs from accepted journal; invalid checkpoint doesn't erase history. Unsupported versions require their original reducer. Production archive versioning, signed cloud envelopes, durable adapter transactions, checkpoint acceleration and automatic interruption recovery remain future work.

## Test scope

Golden fixtures are manually calculated independent expected calls/slots/effects. Bounded graph explores both next rally winners over five profiles and both starting teams, through a score boundary of 5 for target 3/win-by 2. High-score random traces and explicit deuce fixtures complement that finite graph. No exhaustive claim for infinitely extended deuce or every unsupported custom rule.
