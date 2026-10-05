# Audio (ElevenLabs SFX)

Copied from `E:\AI Sound Effects` on 2026-10-04 and renamed to web-safe names. The category
folders are the raw **library**. The game never loads them directly.

**In the game:** `game/` holds the trimmed, faded, level-matched files the game loads. They are
made from the library by `python tools/audio/prep_audio.py`; each file's source and cuts are in
the recipe at the top of that script. One-shots are MP3; loops are gapless WAV, because MP3
padding clicks at the loop seam. Smoke test: `node tools/shots/audio.js`.

| Game file | Plays as |
|---|---|
| click, pickup, paper, whoosh, boost, dive, thud, alarm, trap, breath | the `sfx.*` voice of the same name |
| xray | `sfx.xray` (X-ray / detective vision on) |
| heat | `sfx.heat` (brawler heat vision) |
| wind-cruise, wind-fast | flight wind (`src/flightaudio.js`), crossfaded by airspeed |
| crime-scene + radio1/2 | investigation bed + random radio chatter (`src/ambience.js`) |
| drone | asylum + captured bed |
| street | brawler bed |

Still synthesized (no matching recording yet): punch, hit, hurt, pow, sonic boom, shutter,
drink, door, win, lose, the spin sting and the siren. The raw library's peaks above 0 dBFS
and end clicks are fixed in the `game/` copies.

## flight/
| File | Source | Use |
|---|---|---|
| wind-cruise-loop | WHSH-Player-controlled_ar | Base wind bed in `FlightAudio` (low speed) |
| wind-fast-loop | WINDDsgn-Continuous_extreme_h | High-speed wind; crossfade by `speedFrac` (trim the fade in/out) |
| wind-turbulence-loop | WINDTurb-the_sound_of_the_win | Low rumble / buffeting layer, clouds |
| flying-whooshes-30s | SWSH-superhero_flying_in_ | Pulsing pass-bys; slice into one-shots for buildings |
| dive-swell | WINDDsgn-Immersive_cinematic_ | `sfx.dive` |
| boost-rush | WHSH-Powerful_superhero_b | `sfx.boost` (5 s sustained, so trim or fade) |
| whoosh-sharp | WHSH-A_sharp,_fast_cinema | `sfx.whoosh` (jumps, flykicks) |
| whoosh-soft | WHSH-Soft_sound_effect_fo | Light whoosh, panel slides, `sfx.spin` layer |
| rise-short | DSGNRise-0-3_seconds_deep_cin | Pre-boost / scene-transition riser |
| takeoff-swell | Cinematic_superhero_ | Take-off, `sfx.sonicBoom` lead-in |

## impacts/
| File | Source | Use |
|---|---|---|
| bass-thud | DSGNImpt-Cinematic_bass_thud | `sfx.thud` (comic landing) |
| hero-landing | FOLYFeet-Cinematic_superhero_ | Alternative landing, brawler drop-in |

## powers/
| File | Source | Use |
|---|---|---|
| frost-breath | MAGElem-Magical_frozen_slash | `sfx.breath` (brawler freeze breath) |
| heat-blast | MAGSpel-A_blazing_fireball_r | `sfx.beam` (heat vision) |
| power-charge | SCIEnrg-Create_a_short_premi | Energy charge, super-move wind-up |

## ambience/
| File | Source | Use |
|---|---|---|
| city-night-loop | AMBUrbn-Night_time_city_ambi | Overworld bed (very quiet, ~-44 dB RMS, so normalise) |
| city-street-loop | AMBUrbn-Sounds_of_outside_am | Street-level / brawler bed |
| city-night-bright-loop | AMBUrbn-Immersive_city_night | Alternative bed (bright, hissy) |
| crime-scene | AMBSubn-crime_scene,_suburba | `crimescene.js` / investigate bed |
| police-radios-a/b/c | AMBUrbn-police_radios,_dista (three takes) | Crime-scene chatter; rotate takes |

## tension/
| File | Source | Use |
|---|---|---|
| braam-eerie | DSGNBram-Eerie_horror_braam | Asylum `sfx.trap`, reveals |
| horror-build | DSGNBram-Cinematic_horror_ten | Asylum entry / long build (15 s) |
| braam-deep-long | DSGNBram-Powerful_deep_cinema | Boss / villain reveal (9 s decay tail) |
| sub-drone-loop | SCIEnrg-Deep_cinematic_atmos | Low drone under captured / asylum |
| suspense-ticks | MUSCStr-Create_a_tense,_susp | Accelerating ticks: captured guard timer |
| countdown-5s | 5-second_modern_coun | 5-tick countdown |
| alarm-loop | SCIAlrm-Seamless_1_second_wa | `sfx.alarm` (air events, asylum) |

## ui/
| File | Source | Use |
|---|---|---|
| scan | SCICmpt-Futuristic_scanning_ | Night scan / scan view |
| data-chatter | SCICmpt-High_tech_computer_i | Scan HUD, case board readout |
| clue-found | MUSCChim-Short_positive_disco | `sfx.pickup` for clues/evidence |
| achievement-shimmer | MAGShim-Enchanted_arcane_ach | Lead unlocked, achievement |
| evidence-glow | MAGShim-Soft_mystical_ambien | Hovering or highlighting evidence |
| bright-ding | A_short,_bright,_and | Single chime (5.7 s tail, so trim) |
| alert-minimal | UIAlert-High-quality_minimal | Toast / notification |
| alert-arcade | UIAlert-Loud_arcade-style_UI | Bad toast, incident alert |
| pop | UIClick-3._Pop_Used_for_Icon | Icon / button pop |
| click | UIClick-Create_a_short,_frie | `sfx.click` |
| toggle | UIClick-Soft_plastic_toggle_ | Settings toggles |
| tech-confirm-a/b | UIClick-Style_Clean,_tech-in (two takes) | Confirm / menu select |
| page-flip | UIClick-Single_book_page_fli | `sfx.paper` (case file, newspaper) |

## music/
| File | Source | Use |
|---|---|---|
| sting-short | MUSCStngr-Create_a_short_3–4_s | `sfx.win` / case-solved sting |
| cinematic-trailer-30s | Create_a_cinematic_t | Title screen / cutscene bed (loud, ~-8 dB RMS) |

## Left out
Exact duplicates (the "(1)" copies of FOLYFeet, UIAlert-minimal, UIClick-toggle and
WHSH-Powerful) were skipped. Also skipped, because nothing in the game fits them yet:
forest, jungle, swamp, rural, crickets, ocean waves, suburban night, train cabin,
battlefield, barefoot footsteps, crunchy snack, breathing and the adult vocal clip.
