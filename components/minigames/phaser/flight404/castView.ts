/**
 * The six-enemy cast, on screen.
 *
 * `castDirector.ts` decides what the cast does and returns a list of effects;
 * this owns their sprites and spends those effects. Same split as
 * `layout.ts`/`platforms.ts` and `backdrop.ts`/`backdropView.ts`, for the same
 * reason: the behaviour is worth testing without a browser and the sprite
 * bookkeeping is not worth testing at all.
 *
 * Members are drawn with the same `skin.ts` machinery as the mooks, so a cast
 * member with no delivered art is a labelled block rather than nothing — which
 * matters while art is still arriving, because an enemy you cannot see is an
 * enemy that feels like a bug rather than like a missing file.
 */
import type * as PhaserNS from 'phaser';
import { T } from './textures';
import { attachSkin, type Skin } from './skin';
import { CAST, distracted, type CastState } from './cast';
import type { Member, Effect } from './castDirector';
import type { BlockFigure } from './figure';

type Fig = BlockFigure & { skin?: Skin | null; castId?: number };

export interface CastView {
    figures: Map<number, Fig>;
}

export const openCastView = (): CastView => ({ figures: new Map() });

/** How tall each kind is drawn, in world units. */
export const CAST_H: Record<string, number> = {
    scalper: 26, hypebeast: 28, reseller: 26, security: 28, shopOwner: 28, falafelGuy: 26,
};

/**
 * Which animation a member wants right now.
 *
 * Read off the machine's own phase rather than re-derived, so the drawn version
 * and the simulated one cannot disagree about whether somebody is mid-beat.
 */
export function stateOf(s: CastState): string {
    switch (s.kind) {
        case 'scalper': return s.phase === 'photo' ? 'photo' : s.phase === 'grab' ? 'grab' : 'run';
        case 'hypebeast': return s.phase;
        case 'reseller': return s.phase === 'gone' ? 'flee' : s.phase;
        case 'security': return s.phase === 'radio' ? 'radio' : 'run';
        case 'shopOwner': return s.phase === 'tidy' ? 'tidy' : 'idle';
        case 'falafelGuy': return s.phase === 'serve' ? 'idle' : s.phase;
    }
}

/**
 * Sync sprites to members: make the new ones, move the rest, drop the dead.
 *
 * Keyed by member id rather than by array index, because the director removes
 * a member the frame it dies and an index-keyed view would silently re-point
 * every sprite after it at the wrong enemy.
 */
export function syncCast(
    scene: PhaserNS.Scene,
    view: CastView,
    members: Member[],
    make: (x: number, y: number, h: number) => BlockFigure,
): void {
    const live = new Set<number>();
    for (const m of members) {
        live.add(m.id);
        let fig = view.figures.get(m.id);
        if (!fig) {
            const h = CAST_H[m.state.kind] ?? 26;
            fig = make(m.x, m.y, h) as Fig;
            fig.castId = m.id;
            fig.setDepth(8);
            fig.skin = attachSkin(scene, fig, m.state.kind, h);
            view.figures.set(m.id, fig);
        }
        fig.setPosition(m.x, m.y);
        fig.setFacing(m.facing);
        fig.skin?.play(stateOf(m.state), m.facing);
        // A member mid-beat is out of the fight, and it should be legible at a
        // glance that he is: that is the whole reason the beats cost anything.
        fig.setAlpha(distracted(m.state) ? 0.82 : 1);
    }
    for (const [id, fig] of view.figures) {
        if (live.has(id)) continue;
        fig.destroy();
        view.figures.delete(id);
    }
}

export function clearCastView(view: CastView | null): void {
    if (!view) return;
    for (const fig of view.figures.values()) fig.destroy();
    view.figures.clear();
}

/** Where a thrown item's art lives, by the owner's stock name. */
export const throwArt = (item: string): string => T(`throw-${item}`);

/** Does this kind get a health pip drawn over it? The caterer does not. */
export const isTarget = (kind: string): boolean => CAST[kind as keyof typeof CAST]?.enemy ?? false;

/** Effects the scene has to spend, grouped so the caller reads one switch. */
export type CastEffect = Effect;
