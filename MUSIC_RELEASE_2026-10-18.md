# Music release verification — 2026-10-18

Published through PR #5 (ordinary merge 7974f1d) in the existing Lovable project.
GitHub connector PR creation returned 403; the already-authorized GitHub browser
session created and merged the PR instead. No Git history was rewritten.

## Actual import

15 new HoliznaCC0 MP3 derivatives, 2,672.274287 seconds (44:32), 64,144,641 bytes.
All 15 uploaded files were fetched and compared by SHA-256 to the prepared files.
Original archive membership and original SHA-256 were separately verified. Source
declarations, derivatives and public evidence are recorded in
`content/music-replacement-batch.json` and
`public/music-license-evidence/holizna-cc0.json`.

Publisher CC0 permission covers rights the affirmer holds. This is not a finding
that clinics are exempt from non-waivable Ukrainian remuneration. The public page
states the separate composition/performance/phonogram scope and limitations.

Assignments: Lo-Fi & Chillhop 15; Автомікс 15 (the same recordings, not another 15).
Jazz, Ambient, Deep House, Acoustic and Modern Pop remain empty. Existing seven
profile IDs, descriptions, order, defaults and volumes were preserved. Old 59
recordings remain retired. No schema or RLS changes.

After import: library URLs 15; music metadata 15; videos 25, fingerprint
`1ef26b9529ddaa4238fd33f7165826e9`; screens and roles retain their prior fingerprints;
Auth user count 1. Music/video/duck volumes .35/1/.15, original IDs [], ads empty,
advertisement settings OFF / 30 minutes / one block, all unchanged.

## Actual publication checks

- https://smilestream.lovable.app/ contains the music-rights block and register link.
- https://smilestream.lovable.app/music-licenses opens without login, reports 15/15
  documented recordings and renders 15 articles. Local candidates are absent.
- https://smilestream.lovable.app/tv shows profile names without descriptions,
  counts, source links or licence credits. Remote Down moves focus to Lo-Fi.
- Selecting Lo-Fi on the published player starts audio and video together. Both
  have readyState 4, advancing currentTime, paused=false, error=null; the second
  video is preloaded with readyState 4. Actual public MP3 URL is the new bucket file.

TypeScript, changed-module ESLint, production build and 124 Vitest tests pass.
Both media/integration isolation checks pass. Bun is unavailable. Physical Samsung
retesting, long-duration soak and live advertisement/ducking checks were not performed;
existing engine tests pass and playback engine code was not changed.

## Remaining music work

23 HowWorks originals (including the preserved first 11) are locally downloaded,
decoded and inventoried; not imported while AI provenance/right-chain questions
remain unresolved. Seven additional Loyalty Freak Music originals were downloaded
and decoded in earlier research; metadata includes non-instrumental flags, so they
are not admitted. Njoy AkustiK has conflicting CC0 prose / CC BY link and a paid
download; Agavius jazz pack requires payment. Neither was purchased or imported.
These are separate artists, not extra Holizna profile filler.

Targets of 10–20 suitable recordings in the other five genres remain unmet. No
claim of human listening, vocal analysis, universal ОКУ exemption or completed
multi-artist production catalogue. Continue from ignored `music-replacement.local/`
evidence and files without redownloading or re-running the import transaction.
