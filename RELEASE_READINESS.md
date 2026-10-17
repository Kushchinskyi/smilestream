# Release readiness — Smile Stream 2.0 candidate

**NOT READY FOR PRODUCTION. Draft PR only. No merge/deploy approval is implied.**

## Verified boundaries

- Work stays on `feature/seamless-tv-audio`, PR [#1](https://github.com/Kushchinskyi/smilestream/pull/1).
- Only Supabase `dhvfrnlxskqjnefndztu` has received the new migrations/tests. Production URL/credentials were not used for these operations.
- Existing dual-video/music/recovery engine and `/tv` source are unchanged in this redesign.
- No existing videos were deleted or reordered by setup. SQL fixture/order tests roll back.
- No paid project or plan upgrade was requested. Existing test project remains the previously approved Free project.

## Required SQL order before any approved release

The production database must already have the original Drizzle schema, auth roles/function and policies. **Do not replay `drizzle/migrations/0000_migration.sql` or its seed against an existing database.**

Apply only after database backup, schema review and explicit production permission:

1. `supabase/migrations/20261016174139_centralized_playback_settings.sql` — settings singleton, public read/admin column update. Skip only if already applied and verified.
2. `supabase/migrations/20261016211630_admin_media_metadata.sql` — admin-only category/music-label metadata and reorder RPC.
3. `supabase/migrations/20261017041255_reorder_identity_guard.sql` — mandatory exact-identity/NULL protection for reorder RPC. Keep the order; do not deploy between steps 2 and 3.
4. `supabase/migrations/20261017123203_advertisement_library.sql` — isolated admin-only advertisement inventory. **No scheduler or inserts into normal videos.**

Verify anon, ordinary user and admin rights through both SQL role impersonation and real Data API sessions. Check generated client types, Data API schema exposure and metadata absence fallback. Do not treat successful tests as permission to apply production SQL.

## Release blockers

- Browser smoke/responsive review at **1440, 1280, 1024, 768 and 390 px has NOT been performed for the redesign**. Browser tool access to localhost is blocked by a saved permission despite the user's chat approval. No alternate browser, headless shell or CDP workaround was used. User must unblock the actual browser permission or review screenshots manually before release.
- Advertisements are inventory only. Scheduled insertion, intervals, rotation, ad-error fallback and post-block resume are not implemented. No claim that ads play on TV.
- Screen pairing, device credentials, per-screen playlists/volume, heartbeat, telemetry and command transport are not implemented. The UI reports unavailable data.
- Schedules/time-of-day volume and working hours are not implemented. Europe/Kyiv is used for displayed timestamps only.
- Full restore/import of playlist/ads/screens/schedules is not implemented; audio import is validated and staged only.
- No real 8-hour soak test was run. Existing automated decoder/recovery tests do not replace Samsung hardware checks.
- Bun is unavailable; installed dependencies were used without changing bun.lock. Repeat frozen-lock verification in the intended CI/runtime.
- New admin video save spans video, metadata and audio requests. Partial completion is reported and existing video identity is retained for retry, but this is not a cross-table transaction. Multiple admins can still overwrite a settings snapshot; use one editor at a time pending optimistic concurrency support.
- Original baseline SECURITY DEFINER/password-protection advisor warnings are documented in INTEGRATION_TEST.md; no authorization rewrite was slipped into this task.

## Backup plan

1. With separately approved production access, capture database schema and restorable data backup through the organization's supported Supabase backup/dump workflow. Record time, project ref, versions and responsible operator. Verify restore in a disposable environment.
2. Export current normal library/audio metadata and advertisement inventory JSON from an authorized panel. These are supplementary, not complete DB backups. Capture screens/auth/RLS in the DB backup; never export auth keys or plaintext passwords into application JSON.
3. Preserve existing video assets/URLs and storage bucket policies separately. This change does not copy/delete media.
4. Store backups outside Git, limit access, check expiry of externally hosted media URLs.

## Rollback plan

1. Revert application changes through a normal new Git commit/release; never force-push or rewrite Lovable-connected history.
2. Restore previous verified application build. Additive metadata/advertisement tables can remain; older app ignores them. Do not drop them during an incident without exporting their data.
3. Leave the settings singleton in place when rolling back UI only. Playback remains compatible with its existing five fields.
4. If DB rollback is necessary, stop admin writes, take another backup, review precise changes and restore from the verified backup under separate approval. Do not replay baseline seeds or use a broad reset.
5. Verify playback, authentication, permissions and playlist order on the test environment and Samsung before re-enabling operations.

## Controlled publication sequence

Finish visual/accessibility and hardware checks → resolve review findings → independently review Draft PR and SQL → verify immutable dependency lock → back up and test restore → obtain explicit production SQL permission → apply reviewed migrations in order → permission checks → obtain merge/deploy permission → coordinate GitHub/Lovable branch handling → deploy approved build → monitor actual logs and perform rollback if needed. This document performs none of those production actions.
