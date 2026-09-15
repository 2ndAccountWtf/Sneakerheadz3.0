/**
 * How many frames each delivered sheet holds.
 *
 * A sheet is sliced arithmetically — `frameWidth = width / frames` — and the
 * frame count normally comes from an `@N` in the filename. Art does not always
 * arrive named that way, and the failure is silent and total: a four-frame walk
 * cycle loaded as one frame draws the entire strip at once, so the game shows
 * four copies of the character standing in a row, all moving together. It looks
 * like a rendering bug and it is a filename.
 *
 * So the asset list is the second source of truth. Every id there with a frame
 * count is recorded below, generated from `docs/ASSETS-FLIGHT404.md`, and a
 * file with no `@N` is sliced by its entry here instead of being assumed to be
 * a single frame. An `@N` in the filename still wins, because that is the
 * artist saying something the table cannot know.
 *
 * Regenerate with `npm run art:frames` after editing the asset list.
 */
export const SHEET_FRAMES: Record<string, number> = {
    'belt-segment': 4,
    'bg-argument': 6,
    'bg-balcony': 4,
    'bg-coffee-crew': 6,
    'bg-donkey': 6,
    'bg-porter': 6,
    'bg-shawarma': 6,
    'bg-sheep': 6,
    'bg-sweeper': 6,
    'bin-swing': 5,
    'bowl-burst': 7,
    'bowl-roll': 6,
    'cart-debris': 6,
    'cart-hit': 2,
    'cooler-debris': 5,
    'cooler-hit': 2,
    'crate-debris': 5,
    'crate-hit': 2,
    'cross-bicycle': 6,
    'cross-bread': 6,
    'cross-camel': 8,
    'cross-cart': 6,
    'cross-chickens': 8,
    'cross-donkey': 6,
    'cross-goats': 6,
    'cross-rug': 6,
    'cross-sheep': 6,
    'cross-tea': 6,
    'drop-ammo': 2,
    'drop-health': 2,
    'drop-lighter': 2,
    'drop-speed': 2,
    'dust-puff': 4,
    'explosion-big': 9,
    'explosion-small': 7,
    'falafel-ball': 4,
    'falafel-bounce': 3,
    'falafel-crumb': 4,
    'falafel-recover': 6,
    'falafel-serve': 6,
    'falafel-spill': 6,
    'hostage-freed': 5,
    'hostage-tied': 3,
    'hummus-blob': 4,
    'hummus-drip': 4,
    'hummus-smear': 3,
    'hummus-splat': 5,
    'hummus-worn': 2,
    'hypebeast-charge': 4,
    'hypebeast-die': 5,
    'hypebeast-stalk': 6,
    'hypebeast-stunned': 4,
    'hypebeast-wind': 3,
    'impact-spark': 4,
    'monitor-debris': 4,
    'mook-charger-die': 5,
    'mook-charger-run': 6,
    'mook-thrower-die': 5,
    'mook-thrower-idle': 4,
    'mook-thrower-throw': 5,
    'muzzle-flash': 3,
    'owner-die': 5,
    'owner-stock': 4,
    'owner-throw': 5,
    'owner-tidy': 6,
    'pickup-shine': 6,
    'player-crouch': 2,
    'player-die': 6,
    'player-hurt': 2,
    'player-idle': 4,
    'player-jump': 4,
    'player-run': 8,
    'player-shoot': 3,
    'player-shoot-up': 3,
    'reseller-bag': 4,
    'reseller-drop': 5,
    'reseller-flee': 8,
    'reseller-seek': 8,
    'scalper-approach': 6,
    'scalper-die': 5,
    'scalper-grab': 4,
    'scalper-photo': 6,
    'scalper-throw': 5,
    'security-baton': 4,
    'security-die': 5,
    'security-patrol': 6,
    'security-radio': 5,
    'throw-basket': 2,
    'throw-display': 2,
    'throw-mannequin': 2,
    'tray-clang': 3,
    'trolley-runaway': 4,
    'yasser-charge': 6,
    'yasser-defeat': 8,
    'yasser-idle': 4,
    'yasser-throw': 6,
};

/** Frames for an id: the filename's `@N` first, then the asset list, then one. */
export const framesFor = (id: string, fromName?: number): number =>
    fromName ?? SHEET_FRAMES[id] ?? 1;
