/**
 * The React <-> scene contract.
 *
 * Phaser-free on purpose: the React component imports these types and the
 * mutable input object statically, without dragging the engine into the main
 * bundle.
 *
 * Input is a single mutable object rather than props or registry writes. The
 * scene reads it 60 times a second in `update()`; React only ever writes to it
 * from TouchPad pointer handlers and the weapon rail, so there is no re-render
 * in the loop at all. (Phaser's own keyboard manager handles keys — see
 * gameScene.ts — so this object exists purely to make the phone controls real.)
 */
export interface F404Input {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
    /** Held: every weapon is hold-to-fire, gated by its own cooldown. */
    fire: boolean;
    /** Edge-triggered. The scene sets it back to false once consumed. */
    jump: boolean;
    /** Index into the loadout, driven by the AM/PM weapon rail. */
    weaponIdx: number;
}

export const blankInput = (): F404Input => ({
    left: false, right: false, up: false, down: false,
    fire: false, jump: false, weaponIdx: 0,
});

/** Cheap mirror for the React chrome: changes a handful of times per run. */
export interface F404Hud {
    section: number;
    freed: number;
    score: number;
    kos: number;
}

export interface F404Result {
    won: boolean;
    freed: number;
    kos: number;
    score: number;
    hostageHits: number;
}

/** Registry keys PhaserHost copies out of its `data` prop. */
export const REG = {
    input: 'f404.input',
    weapons: 'f404.weapons',
    hasLighter: 'f404.hasLighter',
    hasEnergy: 'f404.hasEnergy',
    seed: 'f404.seed',
    onHud: 'f404.onHud',
    onDone: 'f404.onDone',
} as const;
