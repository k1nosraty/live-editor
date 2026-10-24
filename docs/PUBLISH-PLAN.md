# GitHub publication and acceptance

Target repository: https://github.com/k1nosraty/live-editor
Base branch: develop
Feature branch: feat/renderift-v1 (created remotely from develop)

The initial implementation is published at PR #1: https://github.com/k1nosraty/live-editor/pull/1. The user subsequently authorized publication; the historical initial rejection below is resolved. Linux support extends the same feature branch and draft PR.

Historical note: source implementation and follow-up fixes were committed locally. The first push was rejected by automatic approval review because explicit permission to publish the newly generated payload and copied specification to the public repository was not established. No workaround, alternate write API, PR or release publication was attempted after that rejection.

PR #1 targets develop. Inspect hosted checks, fix any CI-specific failures, make platform artifacts available as candidates, and perform the Windows and Linux acceptance gates in TESTING.md and LINUX.md. Prepare a version-tag draft only after verification. Do not present the local experimental cross-build as a certified stable release.

Linux update publication was separately rejected by automatic approval review: it did not consider the earlier approval to cover the new Linux/security/QML documentation payload. No alternate repository write was attempted after this rejection. On 2026-10-25 the user explicitly authorized publishing the Linux/security/QML documentation update and continuing pushes within this work without repeated confirmation. That publication block is resolved; this update extends PR #1 and enables its Linux CI job. Hosted results remain to be verified.
