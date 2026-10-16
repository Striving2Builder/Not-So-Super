# Act 2 job B: the reputation pendulum (handoff)

Brief: docs/polish/ACT2BUILD.md (wave 2, job B); the design is docs/design/act2.md ("The reputation
pendulum", "The cult and the Supergirl or Impostor games"). Builds on job A (merged 5ca5eed):
`src/act/act2run.js` (`impRep()` placeholder, `count(id)`), `src/act/act2.js`.

## Scope
- **The impostors' rep:** a real value in Act 2 state (roughly the inverse of hers; up when she's
  disgraced, down when impostors are caught at promotions). Replace `impRep()`; show it on the board.
- **It drives the cult's Polaroids:** strays (`src/polaroids.js`) turn up faster when it's high.
- **Negative-rep doors:** a data-driven list of venues that only open while her rep < 0 (the casino,
  "selected nightclubs", some investigations). Which clubs is still the user's call: default to the
  three story clubs' districts plus a naughty-district club, in one easy-to-edit table. Closed doors
  say why ("Only a disgraced hero gets in here").
- **Promotions and grand openings:** a map event in the red-light, nightclub and naughty districts
  ("Supergirl at the grand opening of …"), like Act 1's sightings. At the venue: a lineup of Supergirls;
  she picks out the impostors with the existing call screen (`src/act/spot.js`). Right = rep up,
  impostors' rep down, `count('promotions')`. Wrong = the cult's photo op (rep down).
- Act 1 must play exactly as before (all of this is Act 2 only).

## Done
(nothing yet)

## Next / notes
