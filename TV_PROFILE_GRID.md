# TV music picker grid

Three equal columns use the full available TV surface. Seven profiles, no-music
and Back occupy three rows without a scroll container. Selection and keyboard
focus have separate styles. Only the picker presentation/navigation changed;
TvPlayback, music/profile persistence, ducking and advertisements are untouched.

Remote arrows stay within horizontal rows and move vertically by three cells.
Short final rows clamp to the nearest available tile. Reopening focuses the
selected profile; polling preserves existing tile focus, and removed focused
profiles recover to the current selection/first tile. Enter uses native button
activation to avoid duplicate playback starts.

Verified in desktop browser at 1280×720: all nine tile rectangles inside viewport,
grid scrollHeight=clientHeight=604 and scrollWidth=clientWidth=1178. Three computed
columns ~372 px. Actual arrow navigation, Enter selection, persistence and reopening
focus verified. Dark palette, white focus outline and green selection inspected.

TypeScript, changed-module ESLint, production Chromium 85 build, 127 Vitest tests
pass. Added grid edge/short-row navigation and nine-tile picker/polling focus tests.
Physical Samsung TV validation remains for the owner; desktop checks do not claim
physical-device or 1920×1080/4K hardware testing.
