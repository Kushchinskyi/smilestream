# Local real-media preview

The isolated harness runs the **same `src/lib/tv-playback.ts` engine** as `/tv`, with two stable HTML5 videos and a separate audio element. It tests playback, not Supabase synchronization, auth or admin UI. Production data and application routes are untouched.

## Start on this computer

PowerShell (stop an existing local server on 4173 with Ctrl+C first):

```powershell
Set-Location 'C:\Users\ТОЙ БОЙ\Documents\ChatGPT\Smile'; & 'C:\Users\ТОЙ БОЙ\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/start-local-test.mjs --media-test --lan
```

Computer: http://127.0.0.1:4173/tv

Samsung on the same LAN: http://192.168.31.27:4173/tv

IP observed on Ethernet 4 on 2026-10-16; DHCP can change it. Keep PowerShell running. Both devices need internet for public media. If the TV cannot connect, check same LAN/no client isolation and Windows private-network Node firewall permission. The launcher does not change firewall rules. Omit `--lan` for loopback only.

`--media-test` implies preview. It builds the standalone static harness into ignored `.media-test-output`, then previews on strict port 4173. It never starts the application backend. No login, database writes or browser storage writes. Reload resets test settings/list; Ctrl+C stops the server.

## Isolation from production

- Default `vite.config.ts` and the application have no harness imports. No URL flag, browser setting or `VITE_*` variable enables this mode in the normal build.
- Dedicated config requires the launcher marker and exact `media-test` mode. CI/Lovable/hosting environments and `--staging` are refused. This is a local build guard, not deployment authorization.
- Launcher strips inherited `VITE_*`, `SUPABASE*`, `SMILE_*` and Nitro variables. Config disables `.env` loading, environment exposure and public directory copying. Test backend variables are ignored.
- The bundle contains the shared playback engine, audio validation and Tizen compatibility shim. The Video import is type-only: no Supabase SDK, project URL or credentials are included.
- Runtime rejects non-private hostnames and ports other than 4173. Do not upload `.media-test-output` or expose it through a tunnel. Ordinary production/Lovable builds still use the normal config/output.

## Temporary media

Three 360p MP4 files, in 5/10/15-second order, from [Samplelib MP4 test files](https://samplelib.com/sample-mp4.html):

- https://samplelib.com/mp4/sample-5s-360p.mp4
- https://samplelib.com/mp4/sample-10s-360p.mp4
- https://samplelib.com/mp4/sample-15s-360p.mp4

Independent [20-second MP3 test music](https://samplelib.com/sample-mp3.html): https://samplelib.com/mp3/sample-20s.mp3

Samplelib describes these as test downloads without license restrictions. All four returned HTTP 200; MP4 sample descriptions contain avc1 (H.264) and mp4a (AAC). Desktop Chromium decoded them. Target is chrome85; Samsung device behavior still requires manual acceptance. External availability is not guaranteed. No test materials are inserted into Supabase or bundled in the normal application.

## TV remote acceptance

1. Open TV URL. Arrows focus buttons with a yellow outline; Enter starts with sound. Confirm moving image and music.
2. Watch at least three full loops (about 90 seconds). All titles must play in order, slots 1/2 alternate, switch/loop counters grow, and next video is preloaded (`readyState` normally 3/4, buffered > 0).
3. Switch time measures ended/manual Next to incoming playing, **not physical screen black-frame duration**. Diagnostics refresh every 250 ms. Also observe the screen.
4. Clip 2 enables original audio: actual music level should drop from 0.35 to 0.07 (duck=0.20), returning on clip 3. Listen to confirm. Use independent Music/Video/Ducking +/- buttons; music time/source must not reset on level changes.
5. Press “Помилка наступного / відновити список”, then Next. Only the temporary next entry becomes an invalid HTTPS source. Expect error counts, bounded retries and automatic skip to a valid clip (normally about 14 seconds plus network/event delay). Music must keep advancing. Press error button again to restore the three valid entries, including during recovery.
6. Disconnect/reconnect internet and verify recovery. Background/reopen browser and resume with a gesture if the device requires it. Check video and music separately.
7. Reload resets fixtures/settings; no login or production playlist. Stop server with Ctrl+C when done.

## Checks

```powershell
node node_modules/typescript/bin/tsc --noEmit
node node_modules/vitest/vitest.mjs run
node --test scripts/test-target.test.mjs
node scripts/check-media-isolation.mjs
```

Artifact audit requires ordinary `.output` and `.media-test-output` builds. It checks production excludes fixture/diagnostic markers, while media output excludes Supabase/production project ref and `SMILE_ISOLATION_CANARY`. For the leak check set a fake inherited `VITE_SECRET=SMILE_ISOLATION_CANARY` before launching media-test.

Verified: TypeScript, Vitest, launcher guards, ordinary Node-preset production build, separate chrome85 media build, artifact isolation, HTTPS availability, desktop real playback/preload/loops, independent levels/ducking and recovery from injected failure, LAN HTTP 200. Bun is unavailable; installed dependencies were used, bun.lock unchanged. No SQL ran. Samsung 2022, physical remote and physical audio/video continuity remain manual checks.
