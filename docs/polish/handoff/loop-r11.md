# Round 11, track L (the 10-minute club loop): handoff

Branch `worktree-agent-acf0df8fc46297e1d` (from phase-2 0cc680e). Brief: docs/polish/ROUND11.md (L).

## Done (WIP, not yet verified in the harness)
- `src/club3d/stealth.js` (new): the club's own `updateGuards`. Per bouncer `st` calm → sus ("?" fills,
  he stops and stares at 25) → search (walks to where he saw her, looks round) → alert ("!": floor
  alert 50, he radios the nearest bouncer, chases, grabs her within 1.3 m). Close call when a "?" past
  60 fizzles. Takedown from behind (USE "Take him down": 40 s KO, filmed in a packed crowd = a card).
  Screen read: icons over heads, edge arrows for off-screen threats, X-ray glow + state tags.
- `src/club3d/tension.js` (new): threat 0..1 → heartbeat on the music's beats, music muffle, red
  vignette; spotted sting + camera punch + slow-mo; close-call relief + caption; "lost them".
- `src/club3d/cctv.js` (new) + `video.js`: when she's made, the DJ wall + TVs cut to a security
  camera on her (256×144 target, 5 Hz, High/Balanced only; snow on Battery saver).
- `src/club3d/selftalk.js` (new): her thought bubbles (self-mocking when high; dry lines sober).
- `struggle.js`: touch counts the thumb path's heading (was the angle round the landing point:
  a natural circle only counted half a turn). Gesture hint, jolt per quarter turn.
- `story.js`: stakes line in the struggle; caught again <30 s after breaking free → `slipAway`
  (far side of the floor); `shakeOff` resets the new guard minds. `sedation.js` wake resets them.
- `cutscene.js` + CSS: the skip pill is top right, big, says the taps it takes, nudges after 4 s.
- Camera closer (CAM_OPEN 0.62/6.2, CAM_CROWD 0.45/4.4), FOV punch, X-ray darkens the room.
- `style.css`: block `/* === r11 L === */` at the end.

## In progress / next
- Harness flows in `tools/shots/club3d.js`: stealth (? builds → crowd → lost), spot (CCTV),
  xray read, struggle on touch (hard, realistic circles), compressed loop; drive her with keys.
- Look at frames, tune rates/colours, perf A/B (SwiftShader fps is ~5: needs a long-window script).
- Critic pack: shots/r11L-1/club3d (≥12 stills) + strips + strips.md.

## Perf baseline (r11L-base, SwiftShader High, 844×390)
rave entrance 251 calls / 378k tris, crowd 187 / 367k; 0 errors. fps ~5 (too coarse for 5%).
