# Flight 404 — re-export list

**Correction.** `docs/ASSETS-EXPORT-V2.md` said the Flight 404 set was fine and
needed nothing. It is clean of the enlargement defect — nothing here was drawn
small and blown up — but it has the other one worse than any other folder in the
project.

**All 115 files with a size in the brief are delivered at 1× world size.**
`aisle-cart.png` is 22 × 26 for something the game places at 22 × 26 world units:
one pixel per unit. A phone held sideways shows the game across 2080 device
pixels over a 352-unit world, which is **5.9 pixels per unit**, so every one of
these is magnified about six times.

That was invisible for two reasons, both now fixed. `scripts/check-art.mjs`
derived its scale with a regex that stopped matching when `content.ts` was
refactored, so it silently fell back to 1 and then agreed with every file it
measured. And the run-length check it does have only finds art that was
*enlarged*, which none of this was.

## What changed in code

- The Phaser canvas renders at **2112 × 1188** (was 1056 × 594). At ×3 the
  compositor was stretching the finished picture 1.97× to reach the phone — a
  fractional nearest-neighbour magnify, the exact artefact `content.ts` warns
  about, moved one step later where nothing in that file could see it.
- `ZOOM` and `ART_SCALE` are now **separate constants**. They were one number
  because both happened to be 3. Raising the render multiple with them joined
  would have made every delivered file read as half its size, silently.
- `fitScale()` reads the delivery multiple off the texture instead of guessing
  between two. The set is already mixed — the aisle props are 1×, the new
  `side-view-seat-rows` are 3× — and a re-export lands one folder at a time, so
  a file at any of 1×, 2×, 3×, 4×, 6× or 8× now draws at the right size beside
  one at any other.

**So this list can be worked through gradually.** Each file is correct the moment
it lands; nothing has to change at the same time.

## The rules

Same as the street set, in `docs/ASSETS-EXPORT-V2.md`:

1. **One reduction, from the master, straight to the target size.** Never reduce
   then enlarge.
2. **No posterising or palette indexing.**
3. **Real alpha at the silhouette.** Transparent background.
4. **`@N` frame count stays in the filename.** It is the only thing the loader
   reads; the manifest is ignored.
5. **Same id, same folder.** Overwrite in place.

Check before sending:

```
node scripts/check-art.mjs assets/art/flight404
```

## Sizes

The frame column is one frame; the strip is that times the frame count, laid
left to right. The 41 files not listed here have no size in the brief — they
load and draw, but nothing declares what they should be, so measure those
against what the game puts next to them.

| file | frames | current frame | **re-export frame at 6×** | full strip |
|---|---|---|---|---|
| `aisle-cart.png` | — | 22×26 | **132×156** | 132×156 |
| `aisle-crate-broken@4.png` | 4 | 24×20 | **144×120** | 576×120 |
| `aisle-crate.png` | — | 20×20 | **120×120** | 120×120 |
| `aisle-luggage-open@4.png` | 4 | 28×18 | **168×108** | 672×108 |
| `aisle-luggage.png` | — | 24×18 | **144×108** | 144×108 |
| `aisle-spill@3.png` | 3 | 30×8 | **180×48** | 540×48 |
| `belt-segment.png` | 4 | 16×10 | **96×60** | 384×60 |
| `bg-argument@6.png` | 6 | 28×26 | **168×156** | 1008×156 |
| `bg-balcony.png` | 4 | 30×24 | **180×144** | 720×144 |
| `bg-coffee-crew@6.png` | 6 | 34×26 | **204×156** | 1224×156 |
| `bg-donkey@6.png` | 6 | 26×22 | **156×132** | 936×132 |
| `bg-porter@6.png` | 6 | 20×32 | **120×192** | 720×192 |
| `bg-shawarma.png` | 6 | 24×30 | **144×180** | 864×180 |
| `bg-sheep@6.png` | 6 | 30×18 | **180×108** | 1080×108 |
| `bg-sweeper.png` | 6 | 18×26 | **108×156** | 648×156 |
| `bin-closed.png` | — | 48×16 | **288×96** | 288×96 |
| `bin-open.png` | — | 48×22 | **288×132** | 288×132 |
| `bin-swing.png` | 5 | 48×22 | **288×132** | 1440×132 |
| `bowl-burst.png` | 7 | 28×22 | **168×132** | 1176×132 |
| `bowl-roll.png` | 6 | 16×12 | **96×72** | 576×72 |
| `bulkhead-ledge.png` | — | 40×20 | **240×120** | 240×120 |
| `cart-debris.png` | 6 | 32×28 | **192×168** | 1152×168 |
| `cart-hit.png` | 2 | 22×26 | **132×156** | 264×156 |
| `cart.png` | — | 22×26 | **132×156** | 132×156 |
| `cooler-debris.png` | 5 | 30×26 | **180×156** | 900×156 |
| `cooler-hit.png` | 2 | 24×22 | **144×132** | 288×132 |
| `cooler.png` | — | 24×22 | **144×132** | 144×132 |
| `crate-debris.png` | 5 | 24×24 | **144×144** | 720×144 |
| `crate-hit.png` | 2 | 20×20 | **120×120** | 240×120 |
| `crate.png` | — | 20×20 | **120×120** | 120×120 |
| `cross-bicycle@6.png` | 6 | 26×24 | **156×144** | 936×144 |
| `cross-bread@6.png` | 6 | 22×30 | **132×180** | 792×180 |
| `cross-camel@8.png` | 8 | 32×34 | **192×204** | 1536×204 |
| `cross-cart@6.png` | 6 | 30×24 | **180×144** | 1080×144 |
| `cross-chickens@8.png` | 8 | 26×12 | **156×72** | 1248×72 |
| `cross-donkey@6.png` | 6 | 26×22 | **156×132** | 936×132 |
| `cross-goats@6.png` | 6 | 30×18 | **180×108** | 1080×108 |
| `cross-rug@6.png` | 6 | 44×26 | **264×156** | 1584×156 |
| `cross-sheep@6.png` | 6 | 34×18 | **204×108** | 1224×108 |
| `cross-tea@6.png` | 6 | 20×28 | **120×168** | 720×168 |
| `dress-aisle-wrecked.png` | — | 64×40 | **384×240** | 384×240 |
| `dress-aisle.png` | — | 64×40 | **384×240** | 384×240 |
| `drop-ammo.png` | 2 | 12×12 | **72×72** | 144×72 |
| `drop-health.png` | 2 | 12×12 | **72×72** | 144×72 |
| `drop-lighter.png` | 2 | 10×12 | **60×72** | 120×72 |
| `drop-speed.png` | 2 | 12×14 | **72×84** | 144×84 |
| `dust-puff.png` | 4 | 12×8 | **72×48** | 288×48 |
| `explosion-big.png` | 9 | 40×40 | **240×240** | 2160×240 |
| `explosion-small.png` | 7 | 24×24 | **144×144** | 1008×144 |
| `falafel-ball.png` | 4 | 8×8 | **48×48** | 192×48 |
| `falafel-bounce.png` | 3 | 10×10 | **60×60** | 180×60 |
| `falafel-crumb.png` | 4 | 12×8 | **72×48** | 288×48 |
| `falafel-recover.png` | 6 | 26×26 | **156×156** | 936×156 |
| `falafel-serve.png` | 6 | 22×26 | **132×156** | 792×156 |
| `falafel-spill.png` | 6 | 30×26 | **180×156** | 1080×156 |
| `galley-counter.png` | — | 48×26 | **288×156** | 288×156 |
| `hostage-freed.png` | 5 | 18×26 | **108×156** | 540×156 |
| `hostage-tied.png` | 3 | 16×26 | **96×156** | 288×156 |
| `hummus-blob.png` | 4 | 10×10 | **60×60** | 240×60 |
| `hummus-drip.png` | 4 | 8×16 | **48×96** | 192×96 |
| `hummus-smear.png` | 3 | 20×14 | **120×84** | 360×84 |
| `hummus-splat.png` | 5 | 16×12 | **96×72** | 480×72 |
| `hummus-worn.png` | 2 | 14×10 | **84×60** | 168×60 |
| `hypebeast-charge.png` | 4 | 26×28 | **156×168** | 624×168 |
| `hypebeast-die.png` | 5 | 26×28 | **156×168** | 780×168 |
| `hypebeast-stalk.png` | 6 | 22×28 | **132×168** | 792×168 |
| `hypebeast-stunned.png` | 4 | 28×22 | **168×132** | 672×132 |
| `hypebeast-wind.png` | 3 | 24×28 | **144×168** | 432×168 |
| `impact-spark.png` | 4 | 10×10 | **60×60** | 240×60 |
| `monitor-debris.png` | 4 | 14×12 | **84×72** | 336×72 |
| `monitor.png` | — | 12×10 | **72×60** | 72×60 |
| `mook-charger-die.png` | 5 | 24×26 | **144×156** | 720×156 |
| `mook-charger-run.png` | 6 | 20×26 | **120×156** | 720×156 |
| `mook-thrower-die.png` | 5 | 24×24 | **144×144** | 720×144 |
| `mook-thrower-idle.png` | 4 | 20×24 | **120×144** | 480×144 |
| `mook-thrower-throw.png` | 5 | 22×24 | **132×144** | 660×144 |
| `muzzle-flash.png` | 3 | 12×10 | **72×60** | 216×60 |
| `owner-die.png` | 5 | 26×28 | **156×168** | 780×168 |
| `owner-stock.png` | 4 | 22×28 | **132×168** | 528×168 |
| `owner-throw.png` | 5 | 24×28 | **144×168** | 720×168 |
| `owner-tidy.png` | 6 | 22×28 | **132×168** | 792×168 |
| `pickup-shine.png` | 6 | 16×16 | **96×96** | 576×96 |
| `player-crouch.png` | 2 | 20×16 | **120×96** | 240×96 |
| `player-die.png` | 6 | 26×28 | **156×168** | 936×168 |
| `player-hurt.png` | 2 | 22×28 | **132×168** | 264×168 |
| `player-idle.png` | 4 | 20×28 | **120×168** | 480×168 |
| `player-jump.png` | 4 | 22×28 | **132×168** | 528×168 |
| `player-run.png` | 8 | 22×28 | **132×168** | 1056×168 |
| `player-shoot-up.png` | 3 | 22×30 | **132×180** | 396×180 |
| `player-shoot.png` | 3 | 24×28 | **144×168** | 432×168 |
| `reseller-bag.png` | 4 | 20×26 | **120×156** | 480×156 |
| `reseller-drop.png` | 5 | 24×26 | **144×156** | 720×156 |
| `reseller-flee.png` | 8 | 22×26 | **132×156** | 1056×156 |
| `reseller-seek.png` | 8 | 20×26 | **120×156** | 960×156 |
| `scalper-approach.png` | 6 | 20×26 | **120×156** | 720×156 |
| `scalper-die.png` | 5 | 24×26 | **144×156** | 720×156 |
| `scalper-grab.png` | 4 | 20×26 | **120×156** | 480×156 |
| `scalper-photo.png` | 6 | 22×26 | **132×156** | 792×156 |
| `scalper-throw.png` | 5 | 22×26 | **132×156** | 660×156 |
| `seat-row-wrecked.png` | — | 34×30 | **204×180** | 204×180 |
| `seat-row.png` | — | 34×30 | **204×180** | 204×180 |
| `security-baton.png` | 4 | 24×28 | **144×168** | 576×168 |
| `security-die.png` | 5 | 26×28 | **156×168** | 780×168 |
| `security-patrol.png` | 6 | 22×28 | **132×168** | 792×168 |
| `security-radio.png` | 5 | 22×28 | **132×168** | 660×168 |
| `throw-basket.png` | 2 | 14×10 | **84×60** | 168×60 |
| `throw-display.png` | 2 | 14×12 | **84×72** | 168×72 |
| `throw-mannequin.png` | 2 | 10×26 | **60×156** | 120×156 |
| `throw-shoebox.png` | — | 12×8 | **72×48** | 72×48 |
| `tray-clang.png` | 3 | 20×16 | **120×96** | 360×96 |
| `trolley-runaway.png` | 4 | 22×26 | **132×156** | 528×156 |
| `yasser-charge.png` | 6 | 40×40 | **240×240** | 1440×240 |
| `yasser-defeat.png` | 8 | 44×40 | **264×240** | 2112×240 |
| `yasser-idle.png` | 4 | 34×40 | **204×240** | 816×240 |
| `yasser-throw.png` | 6 | 40×40 | **240×240** | 1440×240 |
