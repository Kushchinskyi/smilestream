# Smile Stream 2.0 — development report, 2026-10-17

Review candidate on `feature/seamless-tv-audio`, [Draft PR #1](https://github.com/Kushchinskyi/smilestream/pull/1). No merge, deployment, production Supabase access or Lovable configuration changes. This supersedes the earlier inventory-only status.

## Architecture

- One `AdScheduler` per `TvPlayback`, driven by the existing 3-second watchdog. No second engine, scheduler timer, Realtime subscription or music authority. The two stable HTML5 videos and independent audio element remain.
- A due block preloads its first ad, starts only at a natural main-video end, and preloads each successor/next main clip. Outgoing video remains until incoming `playing`. Manual Next does not start ads; pending guards prevent duplicate ended/configuration blocks.
- During ads, main items and the completed main ID are retained separately. Resume selects that ID's successor in the latest main snapshot. If removed, select the first fresh item; empty main waits for new content with music continuing. No normal video is inserted/deleted/reordered by playback.
- Rotation uses active ads ordered by sort_order/id, continuing after the last selected ad. Count 1/2/3/all, no repeats within a block. An absent cursor starts at the first active ad. Empty/disabled ads follow normal playback.
- A block is a snapshot: list/order/count/ad-sound changes affect the next block. Disabling completes the current ad then resumes main. Global volume/sound settings apply immediately. Normal sound uses only playback_settings.original_video_ids; ads use their own original_sound, default OFF.
- Video 0%, global mute, pause, buffering, end or recovery do not duck music. Main→ad→main does not restart unchanged music. Music URL changes keep the established new-list behavior.
- Broken ads use source-generation protection, two reloads and 2/4/8-second retry delays before skipping. Frozen sources trigger the existing 15-second watchdog. A failed block advances once through its finite list, then returns to main; the next interval provides cooldown. Main all-bad recovery retains its 30-second cooldown.

## Per-TV time model

A fresh page starts at zero. The clock samples real forward main-video progress every 3 seconds, adding eligible active playback samples (maximum 5 seconds each). Short handoffs/zero-progress samples add nothing but retain credit. Pause, offline, visibility changes, buffering/recovery reset credit. Hidden/offline/suspended time never becomes debt; finishing a block resets the clock. There is no persistent/global wall-clock schedule or catch-up burst.

Identical polls do not reset time. Enabled/interval/count changes reset it; list-only changes retain credit and are selected at the next natural boundary. A due block waits for the current main clip. TVs intentionally have independent phase. Precision is the sampling period plus remaining clip duration.

## Database, isolation and synchronization

CLI-created additive migrations were applied only after verifying `smilestream-integration-test`, ref `dhvfrnlxskqjnefndztu`, Frankfurt:

1. `20261017131933_ad_playback_settings.sql`: singleton default OFF, intervals 15/20/30/45/60, count 0=all; public SELECT/admin column UPDATE via original has_role; no browser INSERT/DELETE/id update. Public active-only advertisement reads; invoker snapshot RPC.
2. `20261017132134_media_cover_urls.sql`: optional validated HTTPS cover metadata for ordinary/ad libraries, not TV payloads.
3. `20261017133052_ad_snapshot_capacity_guard.sql`: 1001st overflow sentinel and partial active-ad ordering index. Clients reject >1000 active ads instead of silently treating a truncated list as all. Admin can still disable scheduling/deactivate excess ads.

All remain **unapplied to production**. Earlier migration prerequisites are in RELEASE_READINESS.md. Existing auth roles, first-admin trigger, has_role and normal-video RLS are unchanged. Never replay Drizzle seeds on an existing database. Test MCP history records these names at versions 20261017132044 / 20261017132217 / 20261017133135 respectively, while local CLI filenames retain their creation timestamps. No history repair was performed; reconcile the history explicitly before any CLI push to an already migrated environment.

`read_ad_playback` returns settings and ordered active ads in one consistent snapshot. One new bounded polling resource joins existing audio/video loops: approximately 18 reads/minute/TV, one in flight per resource, 12-second abort, coalesced reconnect/foreground events and cleanup. Missing ad tables do not stop main playback. Failures retain the last accepted snapshot and show a sync error.

The isolated launcher aliases a separate clock module to 60 seconds; ordinary code has zero override and no URL/env/user-settings switch. CI/hosting is refused, backend is pinned and inherited backend variables replaced. Artifact scans verify the accelerated label only in integration output, no production ref/passwords there, and no test ref in ordinary output. Credential/output files stay ignored; browser gets only a public key.

Two deliberately retained short test ads (5/10 seconds, Samplelib HTTPS MP4) are in the test advertisements table only. Both HEAD checks returned 200/video/mp4. Prefix: `РЕКЛАМА · ІНТЕГРАЦІЙНИЙ ТЕСТ`; original sound OFF. Scheduling is left OFF, interval 30/count 1. The three existing main videos/order and two test accounts are preserved. SQL fixtures roll back; HTTP fixtures are deleted by generated UUID and prior settings restored.

## UI changes

- Separate advertising settings card with saved/draft/loading/error/retry states and returned-row verification. Navigation/reload guards protect drafts; zero-row/partial bulk writes are not called success.
- Ducking explanation calculates current draft values and marks saved/draft. Video 0% explains base music; 0/100% edges tested.
- Active main cycle duration is explicit: `30 с`, `1 год 1 хв 5 с`; excludes ads.
- Existing design preserved; small captions/URLs/statuses raised to at least 12px and pale text darkened. Flexible settings controls and long-text wrapping added.
- Optional manual HTTPS covers in editors/library/exports; lazy no-referrer images with Film fallback on error. No automatic MP4/CORS thumbnail promise; /tv does not load covers.
- Per-device last/next ad and counters remain “Дані недоступні”; no fabricated global admin-clock schedule.

## Executed verification

- TypeScript PASS; Vitest **104 tests / 15 files PASS**; ESLint touched TS/TSX/MJS modules PASS. Legacy repository formatting was not rewritten.
- Coverage includes normal timing, natural end/manual Next/OFF, rotation/all/count/config changes, duplicate events, 100 scheduler cycles/six media cycles, short-clip clock retention, preload sound changes, moved main index, empty lists, single clip, two bad ads, frozen ad, source retry reset, pause/offline/hidden, zero volume/music continuity, cleanup, draft/error UI and cover fallback.
- Production-mode Node/chrome85, isolated integration and freshly rebuilt standalone media-test builds PASS. Node preset was process-local; Lovable configuration unchanged. Existing tsconfig-paths/plugin warnings remain.
- Node launcher safety **11 PASS**. Integration/media artifact and actual-password scans PASS.
- SQL/RLS suites for original playback settings, metadata/reorder, ads, new scheduling/covers and 1001-row overflow PASS on test only. Fixtures/order roll back.
- Real Auth/Data API anon/user/admin restrictions, admin UPDATE RETURNING, denied INSERT/DELETE/id/invalid values, active-only reads and invoker snapshot PASS. Two independent anonymous HTTP clients received actual admin ad/sound/playlist changes; fixture cleanup/config restore PASS. This is not two browser TVs.
- Local admin and /tv HTTP/LAN availability checked; this does not verify rendering/decoders.

Bun is unavailable. Checks used installed dependencies via direct Node entrypoints; bun.lock unchanged. A pnpm exec wrapper attempted installation and failed on ignored dependency build scripts; generated untracked pnpm files were removed. Frozen Bun validation remains a release gate.

## Unverified and remaining risks

- Saved browser permission denies `http://127.0.0.1:4173` despite previous chat approval. No alternate browser/headless/CDP bypass used. No new rendered UI, two-TV browser test or screenshots at 1440/1280/1024/768/390. User must allow that exact origin in browser access permissions and authorize retry; managed denial may require its administrator. Exact settings-menu location has not been verified.
- Previous baseline Samsung success is the user's hardware result. New advertising still needs physical Samsung/decoder/autoplay/network checks and an actual long soak. Preload is a hint; frame-perfect gapless playback is not guaranteed.
- Existing baseline SECURITY DEFINER warnings on assign_first_admin/has_role and disabled leaked-password protection remain. See [public function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Existing auth settings/functions were not rewritten.
- Last-write-wins settings, non-atomic ordinary video+metadata+sound saves (with partial-error reporting), external media availability and no offline cold start remain.
- Pairing/per-device config, real heartbeat/telemetry, working-hours schedules and full restore/import remain separate unfinished scope. No production-ready claim.

Core: [2d85c65](https://github.com/Kushchinskyi/smilestream/commit/2d85c65). UI: [fe038a2](https://github.com/Kushchinskyi/smilestream/commit/fe038a2). Validation/documentation follow as a separate commit in the same Draft PR; final head/status are reported after push. ADMIN_GUIDE_UK.md contains the five-minute Samsung scenario; RELEASE_READINESS.md contains publication gates.

# Release/content preparation — 17 October 2026

User-confirmed active Lovable branch: main. Existing Lovable project still reports original main SHA 4c335929; feature work has not been merged or published. Production audit through Lovable was read-only: 25 active videos, 3 screens, one Auth user/role, original three public tables with RLS. No production migration, content insert or Lovable configuration mutation was performed.

Added LOVABLE_RELEASE_PLAN.md (seven existing migration hashes, Cloud backup steps, separate approval gates, rollback), RELEASE_USER_GUIDE.md, catalog JSON/CSV and an offline append-only review planner with five Node tests. Playback/admin implementation and dependencies are unchanged. Git bundle verification, separate clone and fsck passed. Application-data snapshot is private/ignored; it is not a full Auth/Storage backup. Full Cloud export and DB restore remain outstanding.

Content results: 95 Mixkit pages audited; 17 Free (all duplicates of existing videos), 43 Restricted excluded, 35 deferred after HTTP 429. Twelve new Pexels candidates have direct URLs and ffprobe metadata: three HD H.264 and nine needing normalization. Thirty-two music candidates total about 9h42 by source metadata; 29 HTTP/MP3 probes pass. Visual/listening QC, stable hosting and public-performance clearance remain open; no materials marked import-ready, purchased or inserted. Offline plan correctly holds all twelve new videos. This does not fulfill a library of 95 newly cleared clips; specific technology coverage gaps are recorded in content/README.md.

Validation: TypeScript passes; 104 Vitest tests / 15 files pass; 16 Node tests (11 existing isolation guards + 5 new planner tests) pass; ESLint on new scripts passes; normal cloudflare-module production build passes; media/integration artifact isolation checks pass. Local TV HTTP 200. Bun unavailable, lock unchanged; no new dependency install. No repeated long Samsung ad test or browser screenshot run. User's successful physical TV acceptance is retained separately from automated results.
