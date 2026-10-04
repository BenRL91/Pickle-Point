# Contributing to Pickle Point

Pickle Point is independently releasable within the LeewayPB suite.

- Keep main releasable; use short-lived feat/, fix/, or arch/ branches.
- Every change goes through a pull request and CI.
- Prefer squash merge unless preserving commits has a clear reason.
- Merge to main creates a release candidate; it does not authorize production deployment.

## Local verification

    npm ci
    npm test
    npm run build

## Authority boundary

Pickle Point owns scoring sessions, matches, games and scoring journals. PaddleLog owns accepted paddle usage and wear. Coaching owns coaching commerce/booking state.

Do not add external PaddleLog writes until the approved Paddle Usage contract, source revisions, stable operation IDs/outbox, grants, overlap handling and suppression semantics are implemented and staging-tested. Shared identity never implies app membership or another app's entitlement.
