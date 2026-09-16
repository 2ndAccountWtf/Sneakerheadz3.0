import React, { useEffect, useRef, useState } from 'react';
import type * as PhaserNS from 'phaser';

/**
 * React ↔ Phaser bridge.
 *
 * Three things make this non-trivial in this app, and all three are handled
 * here so individual games never have to think about them:
 *
 *  1. **Phaser is lazy-loaded.** It is ~330KB gzipped — three times the rest of
 *     the app — so it must never enter the main bundle. The dynamic import
 *     below is what makes Vite emit it as a separate chunk, fetched only when
 *     a player actually opens a Phaser game.
 *
 *  2. **StrictMode double-invokes effects in development.** Combined with an
 *     async import that means mount → cleanup → mount can all happen before the
 *     first import resolves. Without the `cancelled` guard the first resolution
 *     would construct a game into a container that React has already torn down,
 *     leaving an orphaned canvas and a second RAF loop running forever.
 *
 *  3. **Mini-games live in a modal** that opens and closes constantly, so
 *     `game.destroy(true)` on unmount is mandatory rather than housekeeping.
 */

export interface PhaserSceneFactory {
    /** Logical resolution; scaled to fit the container. */
    width: number;
    height: number;
    /**
     * Builds the scene classes. Receives the Phaser namespace so the game file
     * never imports Phaser statically (which would defeat the code-splitting).
     */
    createScenes: (phaser: typeof PhaserNS) => PhaserNS.Types.Scenes.SceneType[];
    /** Arbitrary data handed to the first scene via the registry. */
    data?: Record<string, unknown>;
    /** Enable the arcade physics plugin — the reason we are using Phaser at all. */
    physics?: { gravityY?: number; debug?: boolean };
}

interface PhaserHostProps extends PhaserSceneFactory {
    /** Called by the scene via `game.registry.get('onFinish')`. */
    onFinish: (won: boolean, note: string) => void;
    className?: string;
    /**
     * The engine could not start, or its GPU context went away mid-game.
     *
     * Without this the only thing a player gets is the red box below, which is
     * a dead end — and for the one game on Phaser there is a complete canvas
     * build of the same level sitting in the repo, already wired for the
     * no-WebGL case. A caller that passes this can send them there instead.
     *
     * Reasons this fires that no amount of testing here will predict: the chunk
     * fails to arrive on a bad connection, the browser refuses a drawing buffer
     * of the size asked for, a phone drops the context under memory pressure,
     * or a driver blocklists WebGL after `canUseWebGL` already said yes.
     */
    onEngineError?: (reason: string) => void;
}

export const PhaserHost: React.FC<PhaserHostProps> = ({
    width, height, createScenes, data, physics, onFinish, className = '', onEngineError,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<PhaserNS.Game | null>(null);

    // Through a ref for the same reason `onFinish` is: the effect below mounts
    // once on purpose, so a callback captured in its closure would go stale.
    const failRef = useRef(onEngineError);
    failRef.current = onEngineError;
    const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

    // Keep the latest callback reachable without re-creating the game, which
    // would restart the level every time the parent re-rendered.
    const finishRef = useRef(onFinish);
    finishRef.current = onFinish;

    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const phaser = await import('phaser');
                // React may have unmounted us while the chunk was downloading.
                if (cancelled || !containerRef.current) return;

                const game = new phaser.Game({
                    type: phaser.AUTO,
                    parent: containerRef.current,
                    width,
                    height,
                    backgroundColor: '#04060a',
                    pixelArt: true,
                    roundPixels: true,
                    // FIT letterboxes to the container while preserving the
                    // logical resolution, which is what keeps the pixel art crisp.
                    scale: {
                        mode: phaser.Scale.FIT,
                        autoCenter: phaser.Scale.CENTER_BOTH,
                    },
                    physics: physics
                        ? {
                            default: 'arcade',
                            arcade: { gravity: { x: 0, y: physics.gravityY ?? 0 }, debug: !!physics.debug },
                        }
                        : undefined,
                    // The modal already handles focus; let the page keep its keys
                    // for anything Phaser does not consume.
                    input: { keyboard: true, mouse: true, touch: true },
                    audio: { noAudio: true },
                    banner: false,
                    scene: createScenes(phaser),
                });

                // The scene reads these rather than receiving props.
                game.registry.set('onFinish', (won: boolean, note: string) => finishRef.current(won, note));
                for (const [k, v] of Object.entries(data ?? {})) game.registry.set(k, v);

                // A context that goes away mid-game is not an exception and
                // will not reach the catch below; the canvas simply stops
                // painting and the player is left looking at the last frame.
                const canvas = game.canvas;
                if (canvas) {
                    canvas.addEventListener('webglcontextlost', (ev) => {
                        ev.preventDefault();
                        if (cancelled) return;
                        setStatus('error');
                        failRef.current?.('the graphics context was lost');
                    }, { once: true });
                }

                gameRef.current = game;
                setStatus('ready');
            } catch (err) {
                console.error('Phaser failed to load', err);
                if (cancelled) return;
                setStatus('error');
                failRef.current?.(err instanceof Error ? err.message : String(err));
            }
        })();

        return () => {
            cancelled = true;
            // `true` also removes the canvas from the DOM.
            gameRef.current?.destroy(true);
            gameRef.current = null;
        };
        // Intentionally mount-once: changing these mid-game would mean
        // reconstructing the level underneath the player.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className={`relative w-full ${className}`} style={{ aspectRatio: `${width} / ${height}` }}>
            <div ref={containerRef} className="absolute inset-0 [&>canvas]:w-full [&>canvas]:h-full" />

            {status === 'loading' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 border border-[var(--line-bright)] bg-[var(--bg-sunken)]">
                    <div className="label animate-pulse">Loading engine…</div>
                    <div className="meter w-32"><i className="w-1/2" style={{ background: 'var(--accent)' }} /></div>
                </div>
            )}

            {status === 'error' && (
                <div className="absolute inset-0 flex items-center justify-center border border-[var(--bad)] bg-[var(--bg-sunken)] p-4">
                    <p className="text-sm text-[var(--bad)] text-center">
                        The engine failed to load. Check your connection and try again.
                    </p>
                </div>
            )}
        </div>
    );
};

export default PhaserHost;
