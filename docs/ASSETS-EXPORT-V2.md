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

## Which folders you can leave alone

Scanned every delivered PNG. **199 of 312 files are fine and must not be
touched** — re-exporting a good file from a master through the same broken step
is how you lose the ones that work.

| folder | verdict |
|---|---|
| `assets/art/flight404/` — **all 156 files** | **leave alone.** Mean run 1.17. Every file is native, including the new `side-view-seat-rows/`. Flight 404 looks soft for a different reason (its Phaser canvas renders at 1056px and gets stretched), and that is a code fix, not an art fix. |
| `assets/art/characters/` — the **17 files in the root** | **leave alone.** All the rider sheets: `skateboard-ride@12`, `bike-ride@12`, `skateboard-ollie@10`, `tiny-bicycle` and the rest. Runs of 1.2–1.3. |
| `assets/art/street/skyline-kit/landmarks/` — all 3 | **leave alone.** Capitol Records, Griffith, the Hellaweird sign. Runs of 1.1–1.3. |
| every `far-*.png` silhouette + the flat rooftop props | **leave alone.** 21 files. Two-colour by design, so there is no detail to lose. |
| `assets/art/street/car-taxi.png` | **leave alone.** Already replaced with the native export. |

Everything else — **113 files** — needs one clean re-export. The heaviest
concentrations:

| folder | files |
|---|---|
| `assets/art/street/` root | 67 |
| `assets/art/characters/getting-hit/street-games/` | 9 — *all of them* |
| `assets/art/characters/thrown-weapons/street-games/` | 6 — *all of them* |
| `assets/art/street/skyline-kit/` (antennas, billboards, watertowers, and the detailed towers/lowrise/rooftop) | 31 |

The split inside `characters/` is worth noticing: the rider sheets in the root
are all clean at 1.2, and both later sub-deliveries are all at 3.2. Whatever
changed in the export between those two batches is the thing to not do again.

The `status` column in the tables below gives the verdict per file, with the run
length that produced it.

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

| id | frames | current | re-export at | status |
|---|---|---|---|---|
| `skateboard-balance-fall` | 10 | 500×40 | 1360×104 | **keep** _(1.3x)_ |
| `skateboard-burpee-to-stand` | 10 | 340×36 | 2320×240 | **keep** _(1.2x)_ |
| `skateboard-front-collision-backward` | 12 | 696×48 | 3552×240 | **keep** _(1.3x)_ |
| `skateboard-ground-roll` | 10 | 440×32 | 3360×240 | **keep** _(1.3x)_ |
| `skateboard-hit-skater` | 12 | 1368×90 | 3648×240 | re-export _(3.2x)_ |
| `skateboard-hit-stumble` | 8 | 720×90 | 1920×240 | re-export _(3.1x)_ |
| `skateboard-kickflip` | 12 | 552×44 | 1440×120 | **keep** _(1.3x)_ |
| `skateboard-manual` | 10 | 440×36 | 1200×96 | **keep** _(1.2x)_ |
| `skateboard-obstacle-trip-forward` | 12 | 696×48 | 1824×128 | **keep** _(1.3x)_ |
| `skateboard-oil-wobble` | 10 | 900×90 | 2400×240 | re-export _(3.1x)_ |
| `skateboard-ollie` | 10 | 440×42 | 1200×112 | **keep** _(1.2x)_ |
| `skateboard-ped-collide` | 12 | 1224×90 | 3264×240 | re-export _(3.2x)_ |
| `skateboard-pushup-recover` | 8 | 256×30 | 704×80 | **keep** _(1.2x)_ |
| `skateboard-ride` | 12 | 480×32 | 3648×240 | **keep** _(1.2x)_ |
| `skateboard-soaked` | 8 | 720×90 | 1920×240 | re-export _(3.1x)_ |
| `skateboard-throw-chancla` | 8 | 816×96 | 2176×256 | re-export _(3.3x)_ |
| `skateboard-throw-heavy` | 10 | 1080×102 | 2880×272 | re-export _(3.3x)_ |
| `skateboard-throw-slushie` | 8 | 816×96 | 2176×256 | re-export _(3.2x)_ |
| `throw-chancla` | 6 | 216×24 | 960×104 | re-export _(2.6x)_ |
| `throw-heavy` | 6 | 216×36 | 576×96 | re-export _(3.1x)_ |
| `throw-slushie` | 6 | 180×36 | 480×96 | re-export _(2.9x)_ |

### Landmarks

| id | frames | current | re-export at | status |
|---|---|---|---|---|
| `landmark-capitol-records` | — | 90×144 | 240×384 | **keep** _(1.1x)_ |
| `landmark-griffith-observatory` | — | 216×96 | 576×256 | **keep** _(1.3x)_ |
| `landmark-hellaweird-sign` | — | 288×84 | 768×224 | **keep** _(1.2x)_ |

### Props & street furniture

| id | frames | current | re-export at | status |
|---|---|---|---|---|
| `bin-wheelie` | — | 30×36 | 80×96 | re-export _(2.8x)_ |
| `bin-wheelie-down` | — | 45×24 | 120×64 | re-export _(2.9x)_ |
| `bmx` | 4 | 216×42 | 576×112 | re-export _(2.7x)_ |
| `cat-dart` | 4 | 156×18 | 640×72 | re-export _(2.5x)_ |
| `cat-street` | 6 | 198×18 | 816×72 | **keep** _(flat)_ |
| `clustered-pipes` | — | 48×48 | 128×128 | re-export _(2.5x)_ |
| `cone` | — | 18×21 | 48×56 | **keep** _(flat)_ |
| `dog-bark` | 4 | 192×30 | 512×80 | re-export _(2.6x)_ |
| `dog-stray` | 6 | 270×27 | 720×72 | re-export _(2.5x)_ |
| `door-front` | 2 | 60×42 | 160×112 | re-export _(3.1x)_ |
| `doormat` | — | 36×12 | 120×40 | re-export _(3.0x)_ |
| `drain-grate` | — | 30×12 | 80×32 | re-export _(3.2x)_ |
| `dust-plume` | 5 | 210×30 | 560×80 | re-export _(2.4x)_ |
| `feather-puff` | 4 | 120×24 | 320×64 | re-export _(2.5x)_ |
| `garage-door` | — | 84×60 | 224×160 | re-export _(3.0x)_ |
| `gull` | 4 | 132×18 | 352×48 | re-export _(2.4x)_ |
| `house-apartment-far` | — | 144×156 | 384×416 | re-export _(3.2x)_ |
| `house-apartment-near` | — | 144×156 | 384×416 | re-export _(3.2x)_ |
| `house-bungalow-far` | — | 132×102 | 352×272 | re-export _(3.4x)_ |
| `house-bungalow-near` | — | 132×102 | 352×272 | re-export _(3.3x)_ |
| `house-twostorey-far` | — | 132×138 | 352×368 | re-export _(3.5x)_ |
| `house-twostorey-near` | — | 132×138 | 352×368 | re-export _(3.4x)_ |
| `hydrant` | — | 18×24 | 48×64 | re-export _(3.0x)_ |
| `hydrant-blown` | 5 | 270×66 | 720×176 | re-export _(2.7x)_ |
| `impact-star` | 5 | 180×36 | 480×96 | re-export _(2.6x)_ |
| `mailbox` | — | 24×33 | 64×88 | re-export _(2.6x)_ |
| `manhole` | — | 36×15 | 96×40 | re-export _(3.0x)_ |
| `oil-slick` | — | 90×21 | 240×56 | re-export _(2.5x)_ |
| `palm-short` | — | 48×78 | 128×208 | re-export _(2.9x)_ |
| `palm-sway` | 4 | 216×132 | 576×352 | re-export _(2.7x)_ |
| `palm-tall` | — | 54×132 | 144×352 | re-export _(2.8x)_ |
| `pigeon-flock` | 5 | 270×27 | 720×72 | re-export _(2.6x)_ |
| `pizza-bag-spill` | 6 | 360×48 | 960×128 | re-export _(3.1x)_ |
| `pizza-box` | 4 | 96×24 | 256×64 | re-export _(2.6x)_ |
| `pizza-box-landed` | — | 30×15 | 80×40 | re-export _(2.7x)_ |
| `pizza-stack` | — | 30×36 | 80×96 | re-export _(2.9x)_ |
| `planter` | — | 30×27 | 80×72 | re-export _(2.8x)_ |
| `restock-crate` | — | 42×36 | 112×96 | re-export _(3.2x)_ |
| `roadworks` | — | 72×42 | 192×112 | re-export _(2.8x)_ |
| `roadworks-lamp` | 4 | 288×42 | 768×112 | re-export _(2.8x)_ |
| `satellite-dish` | — | 48×48 | 128×128 | re-export _(2.4x)_ |
| `skate-ramp` | — | 66×30 | 176×80 | re-export _(2.8x)_ |
| `skid-mark` | — | 60×12 | 200×40 | **keep** _(flat)_ |
| `speed-lines` | 3 | 288×36 | 768×96 | re-export _(2.4x)_ |
| `splash-water` | 5 | 210×30 | 560×80 | re-export _(2.5x)_ |
| `sprinkler` | 6 | 252×27 | 672×72 | re-export _(2.4x)_ |
| `streetlight` | — | 36×138 | 96×368 | re-export _(2.4x)_ |
| `streetlight-glow` | — | 120×120 | 320×320 | re-export _(2.8x)_ |
| `sun-low` | — | 120×120 | 320×320 | re-export _(3.5x)_ |
| `trash-pile` | — | 48×24 | 136×72 | re-export _(2.5x)_ |
| `tree-street` | — | 60×96 | 160×256 | re-export _(2.9x)_ |
| `trolley-bay` | — | 108×54 | 288×144 | re-export _(3.0x)_ |
| `trolley-shopping` | 4 | 240×48 | 640×128 | re-export _(2.7x)_ |
| `utility-mast` | — | 48×48 | 128×128 | re-export _(2.4x)_ |
| `watertower-classic` | — | 60×78 | 160×208 | re-export _(2.8x)_ |
| `watertower-conical` | — | 60×78 | 160×208 | re-export _(2.8x)_ |
| `watertower-squat` | — | 60×78 | 160×208 | re-export _(2.9x)_ |
| `window-lit` | — | 30×30 | 80×80 | re-export _(2.7x)_ |
| `window-open` | 2 | 60×30 | 160×80 | re-export _(2.9x)_ |

### Skyline & rooftop

| id | frames | current | re-export at | status |
|---|---|---|---|---|
| `access-shed` | — | 48×48 | 128×128 | re-export _(2.7x)_ |
| `antenna-a` | — | 36×60 | 96×160 | re-export _(2.6x)_ |
| `antenna-b` | — | 36×60 | 96×160 | re-export _(2.4x)_ |
| `antenna-c` | — | 36×60 | 96×160 | re-export _(2.7x)_ |
| `antenna-d` | — | 36×60 | 96×160 | re-export _(2.3x)_ |
| `antenna-e` | — | 36×60 | 96×160 | re-export _(2.6x)_ |
| `antenna-f` | — | 36×60 | 96×160 | re-export _(2.5x)_ |
| `antenna-thin` | — | 48×48 | 128×128 | **keep** _(flat)_ |
| `billboard-a` | — | 78×60 | 208×160 | re-export _(2.8x)_ |
| `billboard-b` | — | 78×60 | 208×160 | re-export _(2.8x)_ |
| `billboard-c` | — | 78×60 | 208×160 | re-export _(2.8x)_ |
| `billboard-d` | — | 78×60 | 208×160 | re-export _(2.8x)_ |
| `billboard-e` | — | 78×60 | 208×160 | re-export _(2.7x)_ |
| `billboard-frame` | — | 48×48 | 128×128 | **keep** _(flat)_ |
| `exhaust-stack` | — | 48×48 | 128×128 | **keep** _(flat)_ |
| `far-lowrise-a-strip` | — | 108×78 | 288×208 | **keep** _(flat)_ |
| `far-lowrise-b-walkup` | — | 108×78 | 288×208 | **keep** _(flat)_ |
| `far-lowrise-c-industrial` | — | 108×78 | 288×208 | **keep** _(flat)_ |
| `far-lowrise-d-corner` | — | 108×78 | 288×208 | **keep** _(flat)_ |
| `far-lowrise-e-mixed` | — | 108×78 | 288×208 | **keep** _(flat)_ |
| `far-lowrise-f-rooftop` | — | 108×78 | 288×208 | **keep** _(flat)_ |
| `far-tower-a-wide` | — | 84×120 | 224×320 | **keep** _(flat)_ |
| `far-tower-b-narrow` | — | 84×120 | 224×320 | **keep** _(flat)_ |
| `far-tower-c-stepped` | — | 84×120 | 224×320 | **keep** _(flat)_ |
| `far-tower-d-box` | — | 84×120 | 224×320 | **keep** _(flat)_ |
| `far-tower-e-crown` | — | 84×120 | 224×320 | **keep** _(flat)_ |
| `far-tower-f-old` | — | 84×120 | 224×320 | **keep** _(flat)_ |
| `hvac-box` | — | 48×48 | 128×128 | re-export _(2.6x)_ |
| `lowrise-a-strip` | — | 108×78 | 288×208 | re-export _(3.0x)_ |
| `lowrise-b-walkup` | — | 108×78 | 288×208 | re-export _(2.8x)_ |
| `lowrise-c-industrial` | — | 108×78 | 288×208 | re-export _(2.8x)_ |
| `lowrise-d-corner` | — | 108×78 | 288×208 | re-export _(2.9x)_ |
| `lowrise-e-mixed` | — | 108×78 | 288×208 | re-export _(2.8x)_ |
| `lowrise-f-rooftop` | — | 108×78 | 288×208 | re-export _(2.8x)_ |
| `roof-vent` | — | 48×48 | 128×128 | **keep** _(flat)_ |
| `sky-billboard` | — | 78×60 | 208×160 | re-export _(2.8x)_ |
| `sky-hills` | — | 384×72 | 1024×192 | re-export _(2.7x)_ |
| `sky-lowrise` | — | 288×78 | 768×208 | re-export _(3.0x)_ |
| `sky-towers` | — | 288×120 | 768×320 | re-export _(2.9x)_ |
| `sky-watertower` | — | 60×78 | 160×208 | re-export _(2.8x)_ |
| `tower-a-wide` | — | 84×120 | 224×320 | re-export _(2.9x)_ |
| `tower-b-narrow` | — | 84×120 | 224×320 | re-export _(2.7x)_ |
| `tower-c-stepped` | — | 84×120 | 224×320 | re-export _(2.8x)_ |
| `tower-d-box` | — | 84×120 | 224×320 | re-export _(3.3x)_ |
| `tower-e-crown` | — | 84×120 | 224×320 | re-export _(2.7x)_ |
| `tower-f-old` | — | 84×120 | 224×320 | re-export _(2.8x)_ |
| `water-tank-small` | — | 48×48 | 128×128 | **keep** _(flat)_ |

### Surfaces (tiling)

| id | frames | current | re-export at | status |
|---|---|---|---|---|
| `fence-picket` | — | 72×30 | 192×80 | re-export _(2.8x)_ |
| `grass-verge` | — | 96×18 | 256×48 | re-export _(2.4x)_ |
| `hedge-low` | — | 72×27 | 192×72 | re-export _(2.7x)_ |
| `kerb` | — | 96×15 | 256×40 | re-export _(2.5x)_ |
| `pavement` | — | 96×24 | 256×64 | re-export _(2.6x)_ |
| `road-asphalt` | — | 192×54 | 512×144 | re-export _(3.2x)_ |
| `road-centreline` | — | 96×9 | 256×24 | **keep** _(flat)_ |
| `road-crack` | — | 72×18 | 224×56 | re-export _(2.3x)_ |
| `road-edgeline` | — | 96×6 | 256×16 | ? |
| `wall-breeze` | — | 72×36 | 192×96 | re-export _(3.2x)_ |

### Vehicles & riders

| id | frames | current | re-export at | status |
|---|---|---|---|---|
| `bike-banana-slip` | 12 | 792×52 | 2112×136 | **keep** _(1.3x)_ |
| `bike-fall-off` | 10 | 640×52 | 2880×240 | **keep** _(1.3x)_ |
| `bike-hit-chancla` | 10 | 1020×90 | 2720×240 | re-export _(3.3x)_ |
| `bike-hit-heavy` | 12 | 1224×90 | 3264×240 | re-export _(3.2x)_ |
| `bike-hit-slushie` | 10 | 1020×90 | 2720×240 | re-export _(3.2x)_ |
| `bike-look-back` | 8 | 480×48 | 1280×128 | **keep** _(1.3x)_ |
| `bike-ride` | 12 | 696×48 | 3552×248 | **keep** _(1.3x)_ |
| `bike-thumb-suck` | 8 | 480×48 | 2368×240 | **keep** _(1.3x)_ |
| `bike-wheelie-sparks` | 10 | 620×52 | 1680×136 | **keep** _(1.3x)_ |
| `car-door-open` | 3 | 180×48 | 480×128 | re-export _(3.0x)_ |
| `car-sedan` | — | 102×57 | 272×152 | re-export _(2.9x)_ |
| `car-taxi` | — | 102×57 | 360×200 | **keep** _(1.0x)_ |
| `car-van` | — | 126×69 | 352×192 | re-export _(3.1x)_ |
| `car-wreck` | — | 108×48 | 304×136 | re-export _(2.8x)_ |
| `longboard` | 4 | 264×15 | 704×40 | re-export _(2.4x)_ |
| `tiny-bicycle` | — | 464×48 | 1240×128 | **keep** _(1.3x)_ |

---

Total pixel area goes from 2.30M to 20.6M, about 9.0×. That is the
point: the screen was always able to show it.
