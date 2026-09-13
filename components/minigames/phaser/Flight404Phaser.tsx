/**
 * FLIGHT 404 — Phaser build.
 * =========================
 * The Phaser pilot. Same game as `components/minigames/Flight404.tsx` (a
 * Contra/Metal Slug run-and-gun through a hijacked airliner) rebuilt on Phaser 4
 * Arcade Physics, with the same sections, the same cast, the same darkness
 * mechanic and the same boss pattern, so the two can be compared directly.
 *
 * This file is the React half and it is deliberately thin: shell chrome, the
 * AM/PM weapon rail, on-screen controls, and the result card. Everything else
 * lives in `./flight404/`.
 *
 * ## The one rule
 *
 * **Phaser is never imported at module scope, anywhere in this subtree.** It is
 * ~382KB gzipped — roughly twice the entire rest of the app — and it is
 * code-split so it downloads only when a player opens this specific game. A
 * single `import Phaser from 'phaser'` here or in any module this file reaches
 * would pull it into the main chunk and defeat the point of the experiment.
 *
 * The only Phaser reference in the whole game is the `await import('phaser')`
 * inside PhaserHost; everything downstream receives the namespace as an
 * argument (`createScenes(phaser)`) and uses `import type * as PhaserNS` for
 * types, which the compiler erases.
 *
 * ## Why the input object instead of props
 *
 * Phaser owns the keyboard (see `gameScene.ts:readInput`), but a mini-game that
 * only works with a keyboard is unplayable for most of this game's players, so
 * the on-screen TouchPad has to feed the scene too. It does that by mutating one
 * plain object that the scene reads in `update()`. No React state changes during
 * play, so no re-render ever lands inside a frame.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as PhaserNS from 'phaser';
import PhaserHost from './PhaserHost';
import { MiniGameShell, MiniGameResult } from '../MiniGameShell';
import { TouchPad } from '../engine/TouchPad';
import type { Btn } from '../engine/useInput';
import { useGame } from '../../../hooks/useGame';
import { armsFor, hasWeapon, FISTS } from '../../../systems/weapons';
import type { Weapon } from '../../../systems/weapons';
import { VIEW_W, VIEW_H, SECTIONS, HELP_TEXT } from './flight404/content';
import { blankInput, REG, type F404Hud, type F404Result } from './flight404/bridge';

/**
 * The scene factory is loaded lazily *as a module* too. `createFlight404Scenes`
 * lives in a file that only type-imports Phaser, so importing it statically
 * would be safe — but keeping it behind the same dynamic boundary means the
 * game's own code (textures, scenes, level data) also stays out of the main
 * chunk, which is another ~20KB the Arcade screen does not need to download.
 */
const loadScenes = () => import('./flight404');

const Flight404Phaser: React.FC<{
    onFinish: (won: boolean, note: string) => void;
    onQuit: () => void;
}> = ({ onFinish, onQuit }) => {
    const { gameState } = useGame();
    const { player } = gameState;

    // The loadout comes straight out of the weapons registry: everything the
    // player is carrying that works in this game, plus bare hands so an empty
    // Dog Launcher never leaves them with nothing to press.
    const loadout = useMemo<Weapon[]>(() => {
        const arms = armsFor(player, 'flight-404');
        return arms.length ? [...arms, FISTS] : [FISTS];
    }, [player]);
    const hasLighter = useMemo(() => hasWeapon(player, 'itm-haunted-lighter'), [player]);
    const hasEnergy = useMemo(() => hasWeapon(player, 'itm-energy-drink'), [player]);

    // --- input bridge. One mutable object, written by pointer handlers, read by
    // the scene 60 times a second.
    const inputRef = useRef(blankInput());

    const [sel, setSel] = useState(0);
    const [hud, setHud] = useState<F404Hud>({ section: 0, freed: 0, score: 0, kos: 0 });
    const [done, setDone] = useState<F404Result | null>(null);
    const [showHelp, setShowHelp] = useState(false);
    const finished = useRef(false);

    const onPad = useCallback((btn: Btn, down: boolean) => {
        const i = inputRef.current;
        switch (btn) {
            case 'left': i.left = down; break;
            case 'right': i.right = down; break;
            case 'up': i.up = down; break;
            case 'down': i.down = down; break;
            case 'a': i.fire = down; break;
            // Edge-triggered; the scene clears it once it has jumped.
            case 'b': if (down) i.jump = true; break;
        }
    }, []);

    const selectWeapon = useCallback((id: string) => {
        const idx = loadout.findIndex(w => w.id === id);
        if (idx < 0) return;
        setSel(idx);
        inputRef.current.weaponIdx = idx;
    }, [loadout]);

    /**
     * Handed to the scene through PhaserHost's `data` prop and read back out of
     * `game.registry`. Built once: PhaserHost mounts the game a single time, and
     * re-creating this object would not reach the running scene anyway.
     */
    const data = useMemo(() => ({
        [REG.input]: inputRef.current,
        [REG.weapons]: loadout,
        [REG.hasLighter]: hasLighter,
        [REG.hasEnergy]: hasEnergy,
        [REG.seed]: (Math.random() * 0xffffffff) >>> 0,
        // Cheap HUD mirror for the chrome. The in-canvas HUD is a separate
        // Phaser scene; this only feeds the subtitle line.
        [REG.onHud]: (h: F404Hud) => setHud(h),
        [REG.onDone]: (r: F404Result) => setDone(prev => prev ?? r),
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);

    /**
     * PhaserHost calls `createScenes` synchronously the moment its own dynamic
     * import of the engine resolves, so the scene *module* has to be resolved
     * first. Rather than race the two imports, PhaserHost is not mounted until
     * this one has landed. It is ~20KB against Phaser's ~382KB, so in practice
     * this costs nothing: the engine chunk is still the long pole.
     */
    type SceneFactory = (phaser: typeof PhaserNS) => PhaserNS.Types.Scenes.SceneType[];
    const [createScenes, setCreateScenes] = useState<SceneFactory | null>(null);
    useEffect(() => {
        let cancelled = false;
        void loadScenes().then(mod => {
            // Wrapped in a thunk: a bare function passed to a setter would be
            // treated as a state updater.
            if (!cancelled) setCreateScenes(() => mod.createFlight404Scenes);
        });
        return () => { cancelled = true; };
    }, []);

    /** Exactly once, when the player dismisses the card. */
    const finish = useCallback(() => {
        if (finished.current || !done) return;
        finished.current = true;
        const note = done.won
            ? `You cleared Flight 404 — ${done.freed} passengers freed, ${done.kos} brothers horizontal, Yasser duct-taped to a jump seat.`
            : 'You went down somewhere over Cyprus. Yasser is still shouting about the pigeons.';
        onFinish(done.won, note);
    }, [done, onFinish]);

    const sectionName = SECTIONS[hud.section]?.name ?? SECTIONS[0].name;

    return (
        <MiniGameShell
            title="Flight 404"
            subtitle={done ? 'Result' : `${sectionName} — ${hud.freed} saved`}
            onQuit={done ? undefined : onQuit}
            quitLabel="Pull Chute"
            hud={
                <div className="flex items-center gap-3 label">
                    <span>Sec {hud.section + 1}/{SECTIONS.length}</span>
                    <span className="text-[var(--accent)]">🧍 {hud.freed}</span>
                    <span className="text-[var(--legend)] numeric">{hud.score}</span>
                    {hasLighter
                        ? <span className="text-[var(--warn)]">🔦 lighter</span>
                        : <span className="text-[var(--ink-faint)]">no lighter</span>}
                </div>
            }
        >
            <div className="relative">
                {createScenes ? (
                    <PhaserHost
                        width={VIEW_W}
                        height={VIEW_H}
                        createScenes={createScenes}
                        data={data}
                        // Arcade physics, world gravity in px/s². The whole point
                        // of the pilot: real bodies rather than hand-written AABB.
                        physics={{ gravityY: 620 }}
                        onFinish={finish}
                    />
                ) : (
                    <div
                        className="flex items-center justify-center border border-[var(--line-bright)] bg-[var(--bg-sunken)]"
                        style={{ aspectRatio: `${VIEW_W} / ${VIEW_H}` }}
                    >
                        <div className="label animate-pulse">Boarding…</div>
                    </div>
                )}
                {done && (
                    <div className="absolute inset-0 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]">
                        <MiniGameResult
                            won={done.won}
                            headline={done.won ? 'Cabin Secured' : 'Cabin Lost'}
                            detail={done.won
                                ? `${done.freed} passengers freed, ${done.kos} brothers asleep in the aisle. Yasser is taped to a jump seat still insisting the clouds are CGI. Score ${done.score}.`
                                : 'You slide down the aisle. A passenger films it. Yasser announces a victory over the PA and then asks how the PA works.'}
                            onClose={finish}
                            closeLabel={done.won ? 'Collect' : 'Deplane'}
                        />
                    </div>
                )}
            </div>

            {/* AM/PM weapon rail — same chrome as the canvas games. */}
            <div className="flex items-center gap-1.5 mt-2.5 overflow-x-auto scrollbar-hide">
                <span className="label flex-shrink-0">Kit</span>
                {loadout.map((w, i) => (
                    <button
                        key={w.id}
                        onClick={() => selectWeapon(w.id)}
                        title={`${w.name} — ${w.flavor}`}
                        className={`chip flex-shrink-0 ${sel === i ? 'chip-accent' : ''}`}
                    >
                        <span>{w.glyph}</span>
                        <span>{w.short}</span>
                    </button>
                ))}
            </div>

            {/* Always rendered: this game is mostly played on a phone. */}
            <TouchPad onDown={onPad} actions={['Fire', 'Jump']} vertical />

            <div className="mt-2">
                <button className="label hover:text-[var(--ink)]" onClick={() => setShowHelp(h => !h)}>
                    {showHelp ? '▾ Controls' : '▸ Controls'}
                </button>
                {showHelp && (
                    <p className="text-[11px] text-[var(--ink-dim)] font-mono mt-1 leading-snug">{HELP_TEXT}</p>
                )}
            </div>
        </MiniGameShell>
    );
};

export default Flight404Phaser;
