# Re-export list — every street, character and rooftop asset

**One job: open each master, export once at the size in the right-hand column.**

Nothing here needs redrawing. Every size below is smaller than the masters that
were already drawn (the taxi master is 1677 × 938; the largest single frame asked
for here is 1240px wide), so this is an export pass, not an art pass.

**Why:** the delivered set was authored at 3× the game's logical grid. On a phone
held sideways in fullscreen the picture is 2080 device pixels across a 320-unit
grid — 6.5 real pixels per unit — so 3× art arrived with less than half the detail
the screen could show. 8× covers every display the game can reach and is capped to
match by `MAX_STORE_SCALE` in `GameCanvas.tsx`. The full reasoning is in
`docs/ASSETS-STREET.md` §1.6.

## The rules that matter more than the sizes

1. **One reduction, from the master, straight to the target size.** Never reduce
   to a small size and enlarge back — that is what happened last time and it is
   why the art looks like mush in game while looking fine in a file browser.
   Reduction is one-way; nothing recovers it.
2. **No posterising, no palette indexing, no "make it look pixel-art" pass.**
   Deliver the honest reduction. The engine filters shrinking draws itself
   (`smoothFor` in `streetArt.ts`), so soft edges are correct now.
3. **Real alpha at the silhouette.** Transparent background, not white, not a
   checkerboard.
4. **Frame counts stay in the filename.** A six-frame sheet is `id@6.png`, frames
   left to right, each frame exactly 1/6 of the width. The `@N` in the name is the
   only thing the loader reads — a manifest is ignored.
5. **Same id, same folder.** Overwrite in place; the wiring is keyed on the id.

## What actually went wrong, in one line

**The files were drawn at the logical size and enlarged 3× to meet the old
"deliver at 3×" instruction, instead of being rendered at 3×.** `car-taxi.png`
was 102 × 57 containing about a 21 × 11 drawing. 102 of the 124 street files are
like this; the median pixel covers a 2.8 × 2.8 block. Every check this repo had
passed them, because the dimensions really were 3×.

The replacement taxi is the proof: same nominal 102 × 57, detail native to the
file, and in the game it is a different asset. So the size table below matters,
but **detail native to the delivered size matters more.** A correct 102px export
beats an enlarged 360px one.

Flight 404's 156 files are unaffected — mean run 1.17, all native. Nothing in
`assets/art/flight404` needs re-exporting for this reason.

## Check it yourself before sending

```
node scripts/check-art.mjs assets/art/street
```

It reports, per file, how much real drawing is inside it. `detail is native to
the file (runs of 1.0)` is the target. Anything reporting `contains only about
NxM of real drawing` went through an enlargement.

## How to check one before doing all 156

Open the exported file at 100% zoom. It should be roughly the size it will appear
on a phone screen and look finished at that size. If it looks like a big
thumbnail, a reduction happened somewhere it should not have.

## Sizes

`current` is what is in the repo today. `re-export at` is the target; for a
multi-frame sheet it is the size of **the whole strip**, so one frame is that
width divided by the frame count.

Sizes marked in the vehicle section are larger than §1.6's table implies on
purpose — the code draws vehicles at 1.3× so they read as bigger than a person on
a board, and these numbers already include it. 77 of 156 were measured from a
live run of both games; the rest are derived from what they were authored at.

### Characters

| id | frames | current | **re-export at** |
|---|---|---|---|
| `skateboard-balance-fall` | 10 | 500×40 | **1360×104** |
| `skateboard-burpee-to-stand` | 10 | 340×36 | **2320×240** |
| `skateboard-front-collision-backward` | 12 | 696×48 | **3552×240** |
| `skateboard-ground-roll` | 10 | 440×32 | **3360×240** |
| `skateboard-hit-skater` | 12 | 1368×90 | **3648×240** |
| `skateboard-hit-stumble` | 8 | 720×90 | **1920×240** |
| `skateboard-kickflip` | 12 | 552×44 | **1440×120** |
| `skateboard-manual` | 10 | 440×36 | **1200×96** |
| `skateboard-obstacle-trip-forward` | 12 | 696×48 | **1824×128** |
| `skateboard-oil-wobble` | 10 | 900×90 | **2400×240** |
| `skateboard-ollie` | 10 | 440×42 | **1200×112** |
| `skateboard-ped-collide` | 12 | 1224×90 | **3264×240** |
| `skateboard-pushup-recover` | 8 | 256×30 | **704×80** |
| `skateboard-ride` | 12 | 480×32 | **3648×240** |
| `skateboard-soaked` | 8 | 720×90 | **1920×240** |
| `skateboard-throw-chancla` | 8 | 816×96 | **2176×256** |
| `skateboard-throw-heavy` | 10 | 1080×102 | **2880×272** |
| `skateboard-throw-slushie` | 8 | 816×96 | **2176×256** |
| `throw-chancla` | 6 | 216×24 | **960×104** |
| `throw-heavy` | 6 | 216×36 | **576×96** |
| `throw-slushie` | 6 | 180×36 | **480×96** |

### Landmarks

| id | frames | current | **re-export at** |
|---|---|---|---|
| `landmark-capitol-records` | — | 90×144 | **240×384** |
| `landmark-griffith-observatory` | — | 216×96 | **576×256** |
| `landmark-hellaweird-sign` | — | 288×84 | **768×224** |

### Props & street furniture

| id | frames | current | **re-export at** |
|---|---|---|---|
| `bin-wheelie` | — | 30×36 | **80×96** |
| `bin-wheelie-down` | — | 45×24 | **120×64** |
| `bmx` | 4 | 216×42 | **576×112** |
| `cat-dart` | 4 | 156×18 | **640×72** |
| `cat-street` | 6 | 198×18 | **816×72** |
| `clustered-pipes` | — | 48×48 | **128×128** |
| `cone` | — | 18×21 | **48×56** |
| `dog-bark` | 4 | 192×30 | **512×80** |
| `dog-stray` | 6 | 270×27 | **720×72** |
| `door-front` | 2 | 60×42 | **160×112** |
| `doormat` | — | 36×12 | **120×40** |
| `drain-grate` | — | 30×12 | **80×32** |
| `dust-plume` | 5 | 210×30 | **560×80** |
| `exhaust-stack` | — | 48×48 | **128×128** |
| `feather-puff` | 4 | 120×24 | **320×64** |
| `garage-door` | — | 84×60 | **224×160** |
| `gull` | 4 | 132×18 | **352×48** |
| `house-apartment-far` | — | 144×156 | **384×416** |
| `house-apartment-near` | — | 144×156 | **384×416** |
| `house-bungalow-far` | — | 132×102 | **352×272** |
| `house-bungalow-near` | — | 132×102 | **352×272** |
| `house-twostorey-far` | — | 132×138 | **352×368** |
| `house-twostorey-near` | — | 132×138 | **352×368** |
| `hydrant` | — | 18×24 | **48×64** |
| `hydrant-blown` | 5 | 270×66 | **720×176** |
| `impact-star` | 5 | 180×36 | **480×96** |
| `mailbox` | — | 24×33 | **64×88** |
| `manhole` | — | 36×15 | **96×40** |
| `oil-slick` | — | 90×21 | **240×56** |
| `palm-short` | — | 48×78 | **128×208** |
| `palm-sway` | 4 | 216×132 | **576×352** |
| `palm-tall` | — | 54×132 | **144×352** |
| `pigeon-flock` | 5 | 270×27 | **720×72** |
| `pizza-bag-spill` | 6 | 360×48 | **960×128** |
| `pizza-box` | 4 | 96×24 | **256×64** |
| `pizza-box-landed` | — | 30×15 | **80×40** |
| `pizza-stack` | — | 30×36 | **80×96** |
| `planter` | — | 30×27 | **80×72** |
| `restock-crate` | — | 42×36 | **112×96** |
| `roadworks` | — | 72×42 | **192×112** |
| `roadworks-lamp` | 4 | 288×42 | **768×112** |
| `roof-vent` | — | 48×48 | **128×128** |
| `satellite-dish` | — | 48×48 | **128×128** |
| `skate-ramp` | — | 66×30 | **176×80** |
| `skid-mark` | — | 60×12 | **200×40** |
| `speed-lines` | 3 | 288×36 | **768×96** |
| `splash-water` | 5 | 210×30 | **560×80** |
| `sprinkler` | 6 | 252×27 | **672×72** |
| `streetlight` | — | 36×138 | **96×368** |
| `streetlight-glow` | — | 120×120 | **320×320** |
| `sun-low` | — | 120×120 | **320×320** |
| `trash-pile` | — | 48×24 | **136×72** |
| `tree-street` | — | 60×96 | **160×256** |
| `trolley-bay` | — | 108×54 | **288×144** |
| `trolley-shopping` | 4 | 240×48 | **640×128** |
| `utility-mast` | — | 48×48 | **128×128** |
| `water-tank-small` | — | 48×48 | **128×128** |
| `watertower-classic` | — | 60×78 | **160×208** |
| `watertower-conical` | — | 60×78 | **160×208** |
| `watertower-squat` | — | 60×78 | **160×208** |
| `window-lit` | — | 30×30 | **80×80** |
| `window-open` | 2 | 60×30 | **160×80** |

### Skyline & rooftop

| id | frames | current | **re-export at** |
|---|---|---|---|
| `access-shed` | — | 48×48 | **128×128** |
| `antenna-a` | — | 36×60 | **96×160** |
| `antenna-b` | — | 36×60 | **96×160** |
| `antenna-c` | — | 36×60 | **96×160** |
| `antenna-d` | — | 36×60 | **96×160** |
| `antenna-e` | — | 36×60 | **96×160** |
| `antenna-f` | — | 36×60 | **96×160** |
| `antenna-thin` | — | 48×48 | **128×128** |
| `billboard-a` | — | 78×60 | **208×160** |
| `billboard-b` | — | 78×60 | **208×160** |
| `billboard-c` | — | 78×60 | **208×160** |
| `billboard-d` | — | 78×60 | **208×160** |
| `billboard-e` | — | 78×60 | **208×160** |
| `billboard-frame` | — | 48×48 | **128×128** |
| `far-lowrise-a-strip` | — | 108×78 | **288×208** |
| `far-lowrise-b-walkup` | — | 108×78 | **288×208** |
| `far-lowrise-c-industrial` | — | 108×78 | **288×208** |
| `far-lowrise-d-corner` | — | 108×78 | **288×208** |
| `far-lowrise-e-mixed` | — | 108×78 | **288×208** |
| `far-lowrise-f-rooftop` | — | 108×78 | **288×208** |
| `far-tower-a-wide` | — | 84×120 | **224×320** |
| `far-tower-b-narrow` | — | 84×120 | **224×320** |
| `far-tower-c-stepped` | — | 84×120 | **224×320** |
| `far-tower-d-box` | — | 84×120 | **224×320** |
| `far-tower-e-crown` | — | 84×120 | **224×320** |
| `far-tower-f-old` | — | 84×120 | **224×320** |
| `hvac-box` | — | 48×48 | **128×128** |
| `lowrise-a-strip` | — | 108×78 | **288×208** |
| `lowrise-b-walkup` | — | 108×78 | **288×208** |
| `lowrise-c-industrial` | — | 108×78 | **288×208** |
| `lowrise-d-corner` | — | 108×78 | **288×208** |
| `lowrise-e-mixed` | — | 108×78 | **288×208** |
| `lowrise-f-rooftop` | — | 108×78 | **288×208** |
| `sky-billboard` | — | 78×60 | **208×160** |
| `sky-hills` | — | 384×72 | **1024×192** |
| `sky-lowrise` | — | 288×78 | **768×208** |
| `sky-towers` | — | 288×120 | **768×320** |
| `sky-watertower` | — | 60×78 | **160×208** |
| `tower-a-wide` | — | 84×120 | **224×320** |
| `tower-b-narrow` | — | 84×120 | **224×320** |
| `tower-c-stepped` | — | 84×120 | **224×320** |
| `tower-d-box` | — | 84×120 | **224×320** |
| `tower-e-crown` | — | 84×120 | **224×320** |
| `tower-f-old` | — | 84×120 | **224×320** |

### Surfaces (tiling)

| id | frames | current | **re-export at** |
|---|---|---|---|
| `fence-picket` | — | 72×30 | **192×80** |
| `grass-verge` | — | 96×18 | **256×48** |
| `hedge-low` | — | 72×27 | **192×72** |
| `kerb` | — | 96×15 | **256×40** |
| `pavement` | — | 96×24 | **256×64** |
| `road-asphalt` | — | 192×54 | **512×144** |
| `road-centreline` | — | 96×9 | **256×24** |
| `road-crack` | — | 72×18 | **224×56** |
| `road-edgeline` | — | 96×6 | **256×16** |
| `wall-breeze` | — | 72×36 | **192×96** |

### Vehicles & riders

| id | frames | current | **re-export at** |
|---|---|---|---|
| `bike-banana-slip` | 12 | 792×52 | **2112×136** |
| `bike-fall-off` | 10 | 640×52 | **2880×240** |
| `bike-hit-chancla` | 10 | 1020×90 | **2720×240** |
| `bike-hit-heavy` | 12 | 1224×90 | **3264×240** |
| `bike-hit-slushie` | 10 | 1020×90 | **2720×240** |
| `bike-look-back` | 8 | 480×48 | **1280×128** |
| `bike-ride` | 12 | 696×48 | **3552×248** |
| `bike-thumb-suck` | 8 | 480×48 | **2368×240** |
| `bike-wheelie-sparks` | 10 | 620×52 | **1680×136** |
| `car-door-open` | 3 | 180×48 | **480×128** |
| `car-sedan` | — | 102×57 | **272×152** |
| `car-taxi` | — | 102×57 | **360×200** |
| `car-van` | — | 126×69 | **352×192** |
| `car-wreck` | — | 108×48 | **304×136** |
| `longboard` | 4 | 264×15 | **704×40** |
| `tiny-bicycle` | — | 464×48 | **1240×128** |

---

Total pixel area goes from 2.30M to 20.6M, about 9.0×. That is the
point: the screen was always able to show it.
