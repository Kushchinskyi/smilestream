# Release readiness — Smile Stream 2.0 candidate

**NOT READY FOR PRODUCTION. Draft PR only. No merge/deploy approval is implied.**

## Verified boundaries

- Work stays on `feature/seamless-tv-audio`, PR [#1](https://github.com/Kushchinskyi/smilestream/pull/1).
- Only Supabase `dhvfrnlxskqjnefndztu` has received the new migrations/tests. Production URL/credentials were not used for these operations.
- Dual-video/music architecture is retained. The user has now confirmed physical Samsung acceptance of ad scheduling, continuous music, original audio/ducking, remote control and admin synchronization.
- No existing videos were deleted or reordered by setup. SQL fixture/order tests roll back.
- No paid project or plan upgrade was requested. Existing test project remains the previously approved Free project.

## Required SQL order before any approved release

The production database must already have the original Drizzle schema, auth roles/function and policies. **Do not replay `drizzle/migrations/0000_migration.sql` or its seed against an existing database.**

Apply only after database backup, schema review and explicit production permission:

1. `supabase/migrations/20261016174139_centralized_playback_settings.sql` — settings singleton, public read/admin column update. Skip only if already applied and verified.
2. `supabase/migrations/20261016211630_admin_media_metadata.sql` — admin-only category/music-label metadata and reorder RPC.
3. `supabase/migrations/20261017041255_reorder_identity_guard.sql` — mandatory exact-identity/NULL protection for reorder RPC. Keep the order; do not deploy between steps 2 and 3.
4. `supabase/migrations/20261017123203_advertisement_library.sql` — separate advertisement inventory and atomic reorder.
5. `supabase/migrations/20261017131933_ad_playback_settings.sql` — default-OFF central scheduling, admin column writes/public reads, active-only ads policy and invoker snapshot RPC.
6. `supabase/migrations/20261017132134_media_cover_urls.sql` — optional HTTPS covers; old rows keep empty covers.
7. `supabase/migrations/20261017133052_ad_snapshot_capacity_guard.sql` — overflow sentinel and partial active-ad ordering index.

Steps 5–7 were applied only to the approved TEST project. They remain unapplied to production, as do prior migrations not independently verified there. No migration includes test-media fixtures. Keep ads OFF until explicit hardware acceptance; never publish an accelerated integration build.

Test MCP migration history timestamps differ from local CLI creation filenames: step 5 = 20261017132044, step 6 = 20261017132217, step 7 = 20261017133135 (names match). Earlier MCP-applied migrations have similar history differences. No automatic history repair was performed. Compare names/content and reconcile history under an explicit reviewed plan before using CLI db push on any already migrated environment; never blindly replay these files.

Verify anon, ordinary user and admin rights through both SQL role impersonation and real Data API sessions. Check generated client types, Data API schema exposure and metadata absence fallback. Do not treat successful tests as permission to apply production SQL.

## Release blockers

- Browser smoke/responsive review at **1440, 1280, 1024, 768 and 390 px has NOT been performed for the redesign**. Browser tool access to localhost is blocked by a saved permission despite the user's chat approval. No alternate browser, headless shell or CDP workaround was used. User must unblock the actual browser permission or review screenshots manually before release.
- Physical Samsung acceptance of the new ad flow is confirmed by the user. No additional long advertising test is required for this preparation step. Full eight-hour telemetry was not captured.
- Screen pairing, device credentials, per-screen playlists/volume, heartbeat, telemetry and command transport are not implemented. The UI reports unavailable data.
- Schedules/time-of-day volume and working hours are not implemented. Europe/Kyiv is used for displayed timestamps only.
- Full restore/import of playlist/ads/screens/schedules is not implemented; audio import is validated and staged only.
- No real 8-hour soak test was run. Existing automated decoder/recovery tests do not replace Samsung hardware checks.
- Bun is unavailable; installed dependencies were used without changing bun.lock. A pnpm exec wrapper attempted installation and stopped on ignored build scripts; generated pnpm files were removed. Repeat frozen Bun installation/checks in the intended CI/runtime.
- New admin video save spans video, metadata and audio requests. Partial completion is reported and existing video identity is retained for retry, but this is not a cross-table transaction. Multiple admins can still overwrite a settings snapshot; use one editor at a time pending optimistic concurrency support.
- Original baseline SECURITY DEFINER/password-protection advisor warnings are documented in INTEGRATION_TEST.md; no authorization rewrite was slipped into this task.
- Active-ad capacity is 1000. On overflow, TVs retain the last accepted configuration and display a sync error; reduce the active library. Current blocks retain their list/sound snapshot until completion; volumes apply immediately. Bad ads can hold the last frame during bounded retry/watchdog delays.

## Actual validation for this advertising increment

TypeScript, 104 Vitest tests/15 files, ESLint changed modules, production/chrome85 build, isolated integration build, fresh media harness build, 11 Node guard tests and artifact/password scans pass. SQL role tests and actual Auth/Data API tests pass on test only, including two independent anonymous HTTP clients and fixture cleanup/config restore. Automated API clients are not rendered browser clients or eight-hour stability results. Separately, the user has confirmed physical Samsung acceptance. DEVELOPMENT_REPORT.md describes exact scope.

Browser access remains blocked by the saved permission for http://127.0.0.1:4173. Allow that origin in browser access permissions and authorize retry (or ask the managing administrator to remove the policy); exact settings-menu navigation is unverified. Do not bypass through another browser/headless/CDP. No new screenshots exist at the five requested widths.

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

## Transfer preparation update — 17 October 2026

See LOVABLE_RELEASE_PLAN.md for confirmed main/Lovable alignment, read-only production inventory, verified Git backup restore, exact seven migration hashes and separate SQL/merge/Publish approval gates. Full private Cloud/Auth/Storage backup and DB restore remain required. content/README.md records licensing/codec/QC limits and the offline append-only review planner; no content was inserted. The live backend and main remain unchanged.
