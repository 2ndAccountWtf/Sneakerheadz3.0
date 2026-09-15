/**
 * Just enough PNG to read and write 8-bit RGBA, with no dependencies.
 *
 * Adding an image library to this project in order to check and repack image
 * files would be a worse trade than the filter arithmetic below, which is the
 * only genuinely fiddly part and is ninety lines.
 */
import { inflateSync, deflateSync } from 'node:zlib';

const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

const paeth = (a, b, c) => {
    const p = a + b - c;
    const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
};

/** Returns { width, height, rgba } where rgba is a width*height*4 Uint8Array. */
export function decodePng(buf) {
    if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
    let pos = 8, hdr = null, palette = null, trns = null;
    const idat = [];
    while (pos < buf.length) {
        const len = buf.readUInt32BE(pos);
        const type = buf.toString('ascii', pos + 4, pos + 8);
        const data = buf.subarray(pos + 8, pos + 8 + len);
        if (type === 'IHDR') {
            hdr = {
                width: data.readUInt32BE(0), height: data.readUInt32BE(4),
                depth: data[8], colour: data[9], interlace: data[12],
            };
        } else if (type === 'PLTE') palette = data;
        else if (type === 'tRNS') trns = data;
        else if (type === 'IDAT') idat.push(data);
        else if (type === 'IEND') break;
        pos += 12 + len;
    }
    if (!hdr) throw new Error('no IHDR');
    if (hdr.interlace !== 0) throw new Error('interlaced PNGs are not supported — re-export without Adam7');
    if (hdr.depth !== 8) throw new Error(`${hdr.depth}-bit PNG — re-export at 8 bits per channel`);
    const bpp = CHANNELS[hdr.colour];
    if (!bpp) throw new Error(`unsupported colour type ${hdr.colour}`);

    const raw = inflateSync(Buffer.concat(idat));
    const stride = hdr.width * bpp;
    const out = Buffer.alloc(hdr.height * stride);
    let ri = 0;
    for (let y = 0; y < hdr.height; y++) {
        const filter = raw[ri++];
        const line = raw.subarray(ri, ri + stride); ri += stride;
        const cur = out.subarray(y * stride, (y + 1) * stride);
        const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
        for (let x = 0; x < stride; x++) {
            const a = x >= bpp ? cur[x - bpp] : 0;
            const b = prev ? prev[x] : 0;
            const c = prev && x >= bpp ? prev[x - bpp] : 0;
            const v = line[x];
            cur[x] = (filter === 0 ? v : filter === 1 ? v + a : filter === 2 ? v + b
                : filter === 3 ? v + ((a + b) >> 1) : filter === 4 ? v + paeth(a, b, c) : v) & 0xff;
        }
    }

    const rgba = new Uint8Array(hdr.width * hdr.height * 4);
    for (let i = 0; i < hdr.width * hdr.height; i++) {
        const o = i * bpp;
        if (hdr.colour === 6) { rgba.set(out.subarray(o, o + 4), i * 4); }
        else if (hdr.colour === 2) { rgba.set(out.subarray(o, o + 3), i * 4); rgba[i * 4 + 3] = 255; }
        else if (hdr.colour === 0) { const g = out[o]; rgba.set([g, g, g, 255], i * 4); }
        else if (hdr.colour === 4) { const g = out[o]; rgba.set([g, g, g, out[o + 1]], i * 4); }
        else if (hdr.colour === 3 && palette) {
            const idx = out[o];
            rgba.set([palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2],
                trns && idx < trns.length ? trns[idx] : 255], i * 4);
        }
    }
    return { width: hdr.width, height: hdr.height, rgba, colour: hdr.colour };
}

const crcTable = [...Array(256)].map((_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});
const crc = b => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
};

export function encodePng(width, height, rgba) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 6;
    const raw = Buffer.alloc(height * (1 + width * 4));
    for (let y = 0; y < height; y++) {
        raw[y * (1 + width * 4)] = 0;
        raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (1 + width * 4) + 1);
    }
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0)),
    ]);
}

export const alphaAt = (img, x, y) => img.rgba[(y * img.width + x) * 4 + 3];
