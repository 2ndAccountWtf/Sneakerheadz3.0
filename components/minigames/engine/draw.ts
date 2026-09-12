/**
 * Canvas drawing primitives shared by every mini-game.
 *
 * There are no sprite assets in this project, so everything is drawn
 * procedurally from rectangles plus emoji glyphs. Keeping the primitives in one
 * place is what makes four independently built games look related.
 */
import { PAL } from './palette';

export type Ctx = CanvasRenderingContext2D;

export const clear = (ctx: Ctx, w: number, h: number, color: string = PAL.void) => {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
};

export const rect = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
};

export const outline = (ctx: Ctx, x: number, y: number, w: number, h: number, color: string, lw = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.strokeRect(Math.round(x) + lw / 2, Math.round(y) + lw / 2, Math.round(w) - lw, Math.round(h) - lw);
};

export const circle = (ctx: Ctx, x: number, y: number, r: number, color: string) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
};

export const line = (ctx: Ctx, x1: number, y1: number, x2: number, y2: number, color: string, lw = 1) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
};

export interface TextOpts {
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    mono?: boolean;
    bold?: boolean;
}

export const text = (ctx: Ctx, str: string, x: number, y: number, opts: TextOpts = {}) => {
    const { size = 8, color = PAL.ink, align = 'left', baseline = 'top', mono = true, bold = false } = opts;
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.font = `${bold ? 'bold ' : ''}${size}px ${mono ? "'IBM Plex Mono', ui-monospace, monospace" : "'Rajdhani', system-ui, sans-serif"}`;
    ctx.fillText(str, Math.round(x), Math.round(y));
};

/** Emoji or any glyph, drawn centred on (x, y). */
export const glyph = (ctx: Ctx, ch: string, x: number, y: number, size: number, rotation = 0, alpha = 1) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    if (rotation) ctx.rotate(rotation);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${size}px system-ui, 'Apple Color Emoji', 'Segoe UI Emoji', sans-serif`;
    ctx.fillText(ch, 0, 0);
    ctx.restore();
};

/** Soft elliptical ground shadow. */
export const shadow = (ctx: Ctx, x: number, y: number, rx: number, ry = rx * 0.35, alpha = 0.4) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = PAL.black;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
};

/** Health / stamina / charge bar. */
export const bar = (
    ctx: Ctx, x: number, y: number, w: number, h: number,
    pct: number, color: string, bg: string = PAL.panel, flip = false,
) => {
    const clamped = Math.max(0, Math.min(1, pct));
    rect(ctx, x, y, w, h, bg);
    const fw = Math.round(w * clamped);
    rect(ctx, flip ? x + w - fw : x, y, fw, h, color);
    outline(ctx, x, y, w, h, PAL.line);
};

/**
 * A humanoid figure built from blocks. Used for every character in every game
 * so the cast looks like it belongs to one world.
 */
export interface FigureOpts {
    kit: { main: string; trim: string; skin: string };
    /** -1 faces left, 1 faces right. */
    facing?: 1 | -1;
    /** 0..1 within a walk cycle; drives leg swing. */
    stride?: number;
    /** Raises the arms — punching, shooting, shooting a basketball. */
    armUp?: number;
    crouch?: boolean;
    /** Flashes white when hit. */
    hurt?: boolean;
}

export const figure = (ctx: Ctx, x: number, y: number, h: number, opts: FigureOpts) => {
    const { kit, facing = 1, stride = 0, armUp = 0, crouch = false, hurt = false } = opts;
    const u = h / 16;                      // one "pixel" unit of the 16-unit tall figure
    const bodyColor = hurt ? PAL.white : kit.main;
    const skinColor = hurt ? PAL.white : kit.skin;
    const trimColor = hurt ? PAL.white : kit.trim;

    const baseY = crouch ? y - u * 1.5 : y;
    const swing = Math.sin(stride * Math.PI * 2);

    shadow(ctx, x, y + u * 0.5, u * 3);

    // Legs
    rect(ctx, x - u * 2.2 + swing * u, baseY - u * 5, u * 1.8, u * 5, trimColor);
    rect(ctx, x + u * 0.4 - swing * u, baseY - u * 5, u * 1.8, u * 5, trimColor);
    // Shoes — the whole point of the game
    rect(ctx, x - u * 2.6 + swing * u, baseY - u * 1.2, u * 2.6, u * 1.2, PAL.white);
    rect(ctx, x + u * 0.2 - swing * u, baseY - u * 1.2, u * 2.6, u * 1.2, PAL.white);

    // Torso
    const torsoH = crouch ? u * 4 : u * 5;
    rect(ctx, x - u * 2.6, baseY - u * 5 - torsoH, u * 5.2, torsoH, bodyColor);

    // Arms
    const armY = baseY - u * 5 - torsoH + u * 0.6;
    const reach = armUp * u * 3;
    rect(ctx, x + facing * u * 2.6, armY - reach, u * 1.4 * facing, u * 3.4, skinColor);
    rect(ctx, x - facing * u * 3.4, armY - reach * 0.35, u * 1.4 * facing, u * 3.2, skinColor);

    // Head
    const headY = baseY - u * 5 - torsoH - u * 3.4;
    rect(ctx, x - u * 1.8, headY, u * 3.6, u * 3.4, skinColor);
    // Hair / cap
    rect(ctx, x - u * 2, headY - u * 0.6, u * 4, u * 1.4, trimColor);
    // Eye
    if (!hurt) rect(ctx, x + facing * u * 0.6, headY + u * 1.2, u * 0.7, u * 0.7, PAL.black);
};

/** Scrolling parallax band — sky, skyline, road, whatever. */
export const band = (
    ctx: Ctx, y: number, h: number, w: number,
    offset: number, spacing: number, color: string,
    draw: (ctx: Ctx, x: number, y: number, h: number) => void,
) => {
    const start = -((offset % spacing) + spacing) % spacing;
    for (let x = start; x < w + spacing; x += spacing) {
        draw(ctx, x, y, h);
    }
};

/** Screen shake offset helper; call inside ctx.save()/restore(). */
export const shakeOffset = (intensity: number): [number, number] =>
    intensity <= 0 ? [0, 0] : [(Math.random() - 0.5) * intensity, (Math.random() - 0.5) * intensity];

/** Big centred arcade banner ("KO!", "DUNK!", "MISSION COMPLETE"). */
export const banner = (ctx: Ctx, str: string, w: number, y: number, color: string, size = 20) => {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${size}px 'Bungee', Impact, system-ui, sans-serif`;
    ctx.lineWidth = Math.max(2, size / 7);
    ctx.strokeStyle = PAL.black;
    ctx.strokeText(str, w / 2, y);
    ctx.fillStyle = color;
    ctx.fillText(str, w / 2, y);
    ctx.restore();
};

export { PAL };
