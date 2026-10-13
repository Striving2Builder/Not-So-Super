# Round 11, track L (the 10-minute club loop): handoff

Branch `worktree-agent-acf0df8fc46297e1d` (phase-2 merged in at a6f223a: tech-debt removals + travel
moments; no conflicts, no imports of removed files/symbols). Brief: docs/polish/ROUND11.md (L).

## Built (verified in the harness, r11L-2)
- `src/club3d/stealth.js`: the club's own `updateGuards`. Per bouncer calm → sus ("?") → search →
  alert ("!": floor alert 45, radio, chase, grab within 1.2 m). Close calls, takedown from behind
  (USE "Take him down", smoke-tested: guard goes `ko`), icons over heads, edge arrows, X-ray tags.
- `tension.js` (heartbeat, muffle, vignette, spotted sting, close-call relief), `cctv.js` + `video.js`
  (the DJ wall + TVs cut to a security cam when she's made), `selftalk.js` (thought bubbles).
- `story.js`: stakes line, `slipAway` when caught again <30 s, `shakeOff` resets guard minds.
- `struggle.js`: touch counts the thumb path's heading; a thumb that was already down when she got
  caught (on the joystick) is adopted, no lift-and-tap needed (that was the real touch loss).
  Hard is now 4 turns / 13 s / slip 0.14 / idle 0.55 (was 5 / 12 / 0.2 / 0.4).
- Cutscene skip pill, closer camera, FOV punch, X-ray darkens the room, `style.css` `/* === r11 L === */`.
- Fix: tap bubbles (rumours/offers, chatter.js) were pinned top-left over the HUD: `bub-in`'s held
  `transform` overrode the inline translate. They now pop in with `scale`/`rotate` (`c3b-in`).

## Harness (tools/shots/club3d.js)
- Flows stealth, spot, xrayread, touch (thumb down before the struggle, ~1 loop/s, wobbly: wins in
  ~4 s of 13), caught (auction: made → grabbed → struggle on a thumb → free → crowd → dance).
- Screenshots freeze the game clock (`frozen`): under SwiftShader a frame cost seconds of game time,
  and the 6 s cover after breaking free ran out between strip frames (looked like an instant re-catch).
- "Caught crashes the page": not reproducible after the merge. Ran caught on auction (x4), halo,
  flashpoint, 5 catches in a row (win/lose mixed) and lose-until-carried-out: 0 page errors.

## r11L-2 result (SwiftShader High, 844×390)
21 flows, 0 failed, 0 page errors. 5 rooms × (entrance + crowd): 2343 calls / 3.83M tris vs base
2351 / 3.83M (-0.3% / -0.1%). Rave entrance 255 / 379k, crowd 190 / 368k. fps ~5 (too coarse).

## Next
- Critic pack: shots/r11L-2/club3d + shots/r11L-2/strips (stealth, spot, xrayread, touch, caught).
- On a phone: the hard struggle feel, CCTV legibility on the DJ wall (it reads weakly under the
  stage lights in SwiftShader), X-ray tags that sit on her when a bouncer stands behind her.
