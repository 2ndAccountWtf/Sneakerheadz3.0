/**
 * Every sprite in the game, in one list.
 *
 * The art registry needs this so that a delivered PNG can inherit the coded
 * sprite's frame count, fps and anchor instead of having to re-declare them in
 * a filename. `tools/sprite-preview.mjs` uses it to render contact sheets, and
 * `tests/` uses it to assert every frame validates.
 */
import type { SpriteDef } from '../../systems/sprites/types';
import { CHARACTER_SPRITES } from './characters';
import { CAST_SPRITES } from './cast';
import { ITEM_SPRITES } from './items';
import { SNEAKER_SPRITES } from './sneakers';

export const ALL_SPRITES: SpriteDef[] = [
    ...CHARACTER_SPRITES,
    ...CAST_SPRITES,
    ...ITEM_SPRITES,
    ...SNEAKER_SPRITES,
];

export const spriteById = (id: string): SpriteDef | undefined =>
    ALL_SPRITES.find((s) => s.id === id);
