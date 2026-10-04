# Round 10 critiques (2026-10-04, phase-2 c834ee4)

Three fresh critics judged the build tagged `testdrive-2026-10-04` (city round 9 + Supergirl look pass
+ dive landing merged) from images only. The images live in the git-ignored `shots/` folder; regenerate
them with `node tools/shots/shoot.js flying --label r10crit --port 8871` (same city seed and plans).

| Report | Input | vs AAA | vs best HTML5 |
|---|---|---|---|
| [blind.md](blind.md) | 8 blind pairs, ours vs AAA refs | 3 (r9fly was 4.0) | 6.5 |
| [city.md](city.md) | all 16 fly3d shots + Superman UE5 refs + dive sheets | 3 | 6 |
| [supergirl.md](supergirl.md) | hero lab sheet (`tools/supergirl/lab.js`) + 4 in-game frames | 4 | 6.5 |

The blind critic identified our frame in 8/8 pairs; the hero was the tell every time.

Blind pair → our shot (the answer key): pair1 patrolview_1 (B), pair2 boost_2 (B), pair3 boost_1 (B),
pair4 low_2 (B), pair5 night_1 (B), pair6 cruise_2 (A), pair7 patrolview_2 (A), pair8 low_1 (B).

Coordinates in city.md are in the 1688×780 fly3d frame. The director's merged, filtered list (standing
decisions applied) is in STATUS.md → "Round 10 review".
