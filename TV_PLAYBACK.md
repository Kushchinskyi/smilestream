# Smile Stream: TV playback and central synchronization

## Architecture and preserved authorization
React 19 / TanStack Start serves the public client-only `/tv` page. Two stable HTML5 video elements preload the next clip and switch visibility on `playing`; the independent audio element is not restarted by video transitions. Original sound is enabled per video ID; music and video volume are independent and music is ducked during original-sound playback. Media recovery/watchdog and the Chromium 85 build target remain in place.

The authenticated route still validates the user with `auth.getUser()`. The admin page still checks `user_roles`; database RLS remains the write authority. No auth client, auth storage, user roles, first-admin trigger, existing video policies or existing video CRUD logic was changed for task 2.

The repository's initial schema is `drizzle/migrations/0000_migration.sql`. It defines `public.has_role(uuid, app_role)`, public reads of active videos and admin-only writes. A read-only attempt to inspect live policies via Supabase MCP returned permission denied. Consequently the live schema and deployed RLS have NOT been confirmed against source; check these on staging before deployment.

## Central audio settings
`public.playback_settings` is a singleton (`id = 1`) containing `music_urls`, `music_volume`, `video_volume`, `duck_volume`, `original_video_ids`. The new migration grants read access to anon/authenticated (TV playback is public), grants authenticated users UPDATE only on the settings columns, and uses the existing `has_role(auth.uid(), 'admin')` for both USING and WITH CHECK. Browser clients cannot insert/delete the singleton or update its ID. Volume constraints enforce 0..1; original IDs use UUID arrays. Dangling IDs are inert; there is deliberately no delete cascade or change to videos.

The admin panel loads from Supabase and saves one UPDATE, requiring a returned singleton row before reporting success. It disables saving after a failed initial load and displays a retry action. Save errors/unknown timeout outcomes are surfaced; reread the server before retrying an uncertain save. Concurrent administrator saves use last-successful-write-wins; explicit reread replaces the local draft. Imported files and old localStorage settings fill a draft only; an admin must explicitly save it to publish settings to TVs. Local settings no longer override the central configuration.

## Automatic synchronization
`playback-api.ts` contains typed Supabase requests; `playback-sync.ts` provides independent polling loops for settings and active videos. Each loop starts immediately, then reads again 10 seconds after completing its last request. Network latency adds to that delay. Online and foreground events request an immediate refresh. There are no Realtime channels, subscriptions, publication changes or device write requests. Expected steady-state load is approximately 12 reads/minute/TV across the two resources.

Each resource permits one request in flight, coalesces reconnect events, passes a 12-second abort signal timeout, cancels timers/listeners on cleanup, and ignores late results after unmount. The loops independently preserve their last good state on failures; an absent settings migration does not stop video synchronization. The page displays synchronization errors and retries automatically. This preserves state during an outage in the current page session; it does not cache media or support offline cold start.

`TvPlayback.updateSettings` changes volume/original-sound selection without replacing video sources or restarting unchanged music. Changing the music URL list starts its first track. Browser autoplay restrictions can still require the existing explicit sound-start button.

`TvPlayback.updatePlaylist` keeps the currently playing clip/source/time intact and updates the inactive element. If the current ID remains, its successor in the refreshed order plays next; if it was removed/disabled, the next clip is the first of the fresh list. A changed URL on the active ID takes effect on a future turn. Updates during a handoff are coalesced until the incoming `playing` event. Empty lists allow the current clip to finish and leave music running; new content resumes the queue. Only active rows are read, sorted by existing sort_order (ID is a deterministic tie breaker). No video writes, reorder operations or demo fallback are performed by synchronization.

## Prepared SQL — NOT APPLIED
Only new migration:
`supabase/migrations/20261016174139_centralized_playback_settings.sql`

It creates the singleton table, explicit grants, RLS SELECT/UPDATE policies, volume/array constraints and one default settings row. It does not modify any video, user, role, trigger or existing policy. It does not enable Realtime. The file was created via `supabase migration new`; no database apply/push/reset command was run.

The initial schema lives in Drizzle rather than Supabase migration history. Do not blindly replay all repository migrations or seed files on an existing database: the original Drizzle migration includes demo videos. Review the baseline/history and apply only the new migration after staging verification and separate production authorization. With this migration unapplied, central audio controls correctly show a loading error, while TV video playback still works from the existing videos table.

## Local checks — 2026-10-16
- TypeScript (`tsc --noEmit`): passed.
- Production build (`vite build`): passed; existing large-bundle and tsconfig-paths plugin warnings remain.
- Vitest: 19 tests passed in 4 files. Includes media handoff/loop, independent audio, network/stall recovery, settings mapping and saving errors, polling, reconnect coalescing, timeout/cleanup, dynamic/empty playlist and updates during handoff.
- ESLint: passed for new/changed playback, settings, synchronization and test modules. Repository-wide lint from task 1 has existing CRLF/formatting issues and prefer-const in previewAuthStorage.ts; these unrelated files were not rewritten.
- Supabase requests are mocked in automated tests. SQL execution/RLS behavior, live authentication, actual media decoder concurrency, visual browser smoke test and physical TV soak testing remain unverified. No production database writes were made.

Dependencies were installed for task 1 with pnpm without changing bun.lock; Bun is unavailable here. Repeat checks with a frozen bun.lock installation in CI before merging.

## Required before publication
1. Review the live schema against the source baseline and confirm has_role signature/semantics and active-video SELECT access. Obtain access for this read-only inspection if needed.
2. Apply only the prepared migration on a disposable/local or staging database with the existing baseline, review database security advisors, and test the access matrix: anon can SELECT but cannot UPDATE/INSERT/DELETE; authenticated non-admin can SELECT but cannot change settings; an admin can UPDATE settings but cannot INSERT/DELETE or change the singleton ID. Test invalid volume and UUID values and missing-singleton errors. SQL/RLS tests have not run in this environment.
3. In staging, use two browser/TV sessions: save from admin, verify settings on both within polling latency, and update active videos through the existing admin UI while confirming current clip/time continue. Test denied/expired sessions, no schema access, initial empty list, all videos disabled, updates during transition, offline/online, foreground and unmount/remount. Verify no overlapping requests or increasing timer/channel counts.
4. On a physical Samsung 2022 Tizen 6.5 / Chromium 85 TV, verify focus/OK/fullscreen, audio gesture, codecs, ducking, transitions, network recovery and 8+ hour memory/decoder stability. Use direct HTTPS H.264/AAC MP4 and MP3/AAC sources supported by the actual model. Native preload is a hint and cannot guarantee frame-accurate gapless playback. Existing Tailwind v4 styles also need visual checking on Chromium 85.
5. Review/select desired central settings; old local preferences are not auto-published. Obtain separate authorization to apply the migration to production. Then obtain separate authorization for push/PR/merge/deployment. None has been performed.
