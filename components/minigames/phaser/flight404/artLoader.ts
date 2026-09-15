/**
 * Hand-drawn art, into the Phaser scene.
 *
 * `systems/sprites/registry.ts` does this for the canvas games: drop a PNG in
 * `assets/art/` and it replaces the coded sprite of the same id. That registry
 * is consulted by `bakeSprite`, and **nothing in this folder calls
 * `bakeSprite`** — Flight 404 bakes its own textures from Graphics calls
 * straight into Phaser's texture manager. So until this file existed, art
 * delivered for this game landed in a folder that the game never read, and the
 * asset document said otherwise. That is the worst kind of pipeline bug: the
 * files are correct, the build is green, and nothing appears.
 *
 * This is the missing half. It globs the same folder, loads every PNG, and
 * registers it in Phaser's texture manager under the *same key* the procedural
 * bake uses — so a delivered file silently replaces the placeholder and
 * everything that draws it keeps working unchanged.
 *
 * ## Order matters
 *
 * `bakeTextures` runs first and fills the cache with placeholders; this runs
 * second and overwrites the ones it has art for. That way a half-delivered set
 * is not a broken game, it is a game where six things look better than they did
 * yesterday — which is the whole promise of the pipeline.
 *
 * ## Frame counts
 *
 * `<id>@8.png` is eight frames in one row. Without the suffix a file is a
 * single frame. The frames must be equal width with no padding, because the
 * sheet is sliced arithmetically: `frameWidth = image.width / frames`. A sheet
 * with a gutter slices off-centre and every frame after the first drifts.
 */
import type * as PhaserNS from 'phaser';
import { T } from './textures';

/**
 * Build-time file listing, resolved by Vite into path -> url. Wrapped because
 * `import.meta.glob` does not exist under plain Node, where the tests run.
 */
let ART: Record<string, string> = {};
try {
    ART = import.meta.glob('../../../../assets/art/flight404/**/*.png', {
        eager: true,
        query: '?url',
        import: 'default',
    }) as Record<string, string>;
} catch {
    ART = {};
}

export interface ArtEntry {
    /** Sprite id, which is also the texture key once prefixed by `T`. */
    id: string;
    url: string;
    frames: number;
}

/**
 * Parse `<id>.png` and `<id>@N.png` into entries.
 *
 * Exported and pure so the naming rules can be tested without a browser: the
 * filename convention is the entire interface an artist has to this codebase,
 * and it is worth more than a comment.
 */
export function parseArt(files: Record<string, string>): ArtEntry[] {
    const seen = new Map<string, ArtEntry>();
    for (const [path, url] of Object.entries(files)) {
        const file = path.split('/').pop() ?? '';
        const base = file.replace(/\.png$/i, '');
        const m = base.match(/^(.+?)@(\d+)$/);
        const id = m ? m[1] : base;
        const frames = m ? Math.max(1, Number(m[2])) : 1;
        if (seen.has(id)) {
            // Two files claiming one id is a delivery mistake, and resolving it
            // by directory order would make which one wins depend on the
            // filesystem. Say so and keep the first.
            console.warn(`[f404 art] two files claim "${id}" — using the first`);
            continue;
        }
        seen.set(id, { id, url, frames });
    }
    return [...seen.values()];
}

export const artEntries = (): ArtEntry[] => parseArt(ART);

/** How many PNGs are waiting in the folder, whether or not they loaded. */
export const artCount = (): number => artEntries().length;

/**
 * Queue every delivered PNG for loading. Call from a scene's `preload`.
 *
 * Each is loaded under a temporary key, because a sheet cannot be sliced until
 * its dimensions are known and Phaser wants `frameWidth` up front for
 * `load.spritesheet`. `installArt` does the slicing once the loader is done.
 */
export function queueArt(scene: PhaserNS.Scene): ArtEntry[] {
    const entries = artEntries();
    for (const e of entries) scene.load.image(tmpKey(e.id), e.url);
    return entries;
}

const tmpKey = (id: string): string => `f404-art-raw-${id}`;

export interface InstallReport {
    installed: string[];
    skipped: { id: string; why: string }[];
    /** Loaded fine, but no texture of that id is drawn anywhere. */
    orphans: string[];
}

/**
 * Turn the loaded images into textures under the game's own keys, replacing the
 * procedural placeholders.
 *
 * A file that does not divide evenly into its declared frame count is installed
 * as a single frame rather than dropped: one wrong filename should cost the
 * animation, not the sprite.
 */
export function installArt(scene: PhaserNS.Scene, entries: ArtEntry[]): InstallReport {
    const report: InstallReport = { installed: [], skipped: [], orphans: [] };

    for (const e of entries) {
        const raw = tmpKey(e.id);
        if (!scene.textures.exists(raw)) {
            report.skipped.push({ id: e.id, why: 'failed to load' });
            continue;
        }
        const src = scene.textures.get(raw).getSourceImage() as HTMLImageElement;
        const w = src.width;
        const h = src.height;
        if (!w || !h) {
            report.skipped.push({ id: e.id, why: 'zero-sized image' });
            continue;
        }

        let frames = e.frames;
        if (w % frames !== 0) {
            console.warn(
                `[f404 art] ${e.id}: ${w}px does not divide into ${frames} frames — ` +
                'treating it as one. Frames must be equal width with no padding.',
            );
            frames = 1;
        }

        const key = T(e.id);
        // If there was no placeholder under this key, nothing in the game draws
        // this id and the file will load perfectly and never appear. That is the
        // quietest way for delivered art to be wasted, so it is said out loud.
        // It has already happened once: the asset list published `seat-row` and
        // the scene baked `seatrow`.
        if (!scene.textures.exists(key)) {
            report.orphans.push(e.id);
        } else {
            // Phaser will not overwrite a key in place, so the placeholder goes.
            scene.textures.remove(key);
        }
        scene.textures.addSpriteSheet(key, src as unknown as HTMLImageElement, {
            frameWidth: w / frames,
            frameHeight: h,
        });
        scene.textures.remove(raw);
        report.installed.push(e.id);
    }

    return report;
}

/**
 * Register a looping animation for every delivered sheet that has more than one
 * frame, keyed `<textureKey>-play`, so a walk cycle animates without every
 * caller knowing whether its sprite is one frame or eight.
 */
export const animKey = (id: string): string => `${T(id)}-play`;

export function buildAnims(scene: PhaserNS.Scene, entries: ArtEntry[], fps = 10): void {
    for (const e of entries) {
        const key = T(e.id);
        if (!scene.textures.exists(key)) continue;
        const count = scene.textures.get(key).frameTotal - 1; // Phaser counts __BASE
        if (count < 2) continue;
        if (scene.anims.exists(animKey(e.id))) continue;
        scene.anims.create({
            key: animKey(e.id),
            frames: scene.anims.generateFrameNumbers(key, { start: 0, end: count - 1 }),
            frameRate: fps,
            repeat: -1,
        });
    }
}

/** Does this id have delivered art with a running animation? */
export const hasAnim = (scene: PhaserNS.Scene, id: string): boolean =>
    scene.anims.exists(animKey(id));
