export { GameCanvas, viewWidth } from './GameCanvas';
export { STREET_CAST, STREET_STUFF, NEAR_SWAP, NEAR_PX, castAt } from './streetCast';
export { ArcadeShell } from './ArcadeShell';
export { TouchPad } from './TouchPad';
export { useGameLoop } from './useGameLoop';
export { useInput } from './useInput';
export type { Btn, InputState } from './useInput';
export { PAL, KIT } from './palette';
export * from './draw';

/**
 * Hand-drawn art for the street games, shared by Downhill Racer and Pizza Run.
 * `art.sprite(...)` is a drop-in for `glyph(...)` that uses a delivered PNG
 * when one exists and the emoji when it does not.
 */
export * as art from './streetArt';

/**
 * Playback rules for those sheets: per-asset frame rates, the one-shots that
 * hold on their last frame, and speed-derived cycle rates. The canvas games'
 * stand-in for Phaser's animation system, which they cannot use.
 */
export * as anim from './streetAnim';

/**
 * One-shot effect sheets — dust, impact stars, water — with their own tiny
 * simulation, kept apart from the emoji spark particles for the reasons in the
 * module header.
 */
export * from './burst';
