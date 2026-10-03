# Supergirl look pass: handoff

Branch based on phase-2 fc7c052. Scope: the player hero only (flight 3D/2D, brawler sprite, portraits).

## Tools
- Hero lab: `node tools/supergirl/lab.js --label NAME --port 8812 [--query only=fly|sprite&hero=classic]`
  → `shots/supergirl/NAME.png`: rows = flight states (cruise, turnR, turnL night, boost, climb, descend
  night, dive, slow, hover), cols = cameras (chase, phone-size, side, front, below, head, face), then the
  2D-flight sprites and brawler sprites. Crops: `python tools/supergirl/crop.py NAME OUT rows cols [scale]`.
- Baselines: `shots/supergirl/lab-base.png`, harness `shots/sg-base/` (flying + brawler street).
- Note: in the lab the WebGL context was lost if created before `loadHero()` (SwiftShader); it's
  created after now.

## Done
- `src/heropose3d.js` (new): FlightPose = attitude springs (roll with overshoot, pitch from climb
  angle atan(vz/speed), yaw slip into turns, float bob) + bone offsets blended per pose: cruise (fist
  forward, chin up, left knee bent), boost (both fists, straight), dive (arms swept back), slow glide
  (tilted up, arm reaching, legs dangling), hover (toes pointed, knee lifted), turns (head/fist lead in,
  legs swing out, chest twists). herofly3d uses it (old flyPose/flyK/boostK removed).

## In progress / next
- Hair shell (Blender) + comic face paint + colour blocking in the atlas; shared cel material for
  HeroSprite (2D modes); cape narrower/shorter so it stops swallowing the body.
