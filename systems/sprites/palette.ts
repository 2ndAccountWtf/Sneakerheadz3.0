/**
 * The sprite palette.
 *
 * Every sprite in the game indexes into this one table by single character, so
 * the whole cast is guaranteed to share a colour language no matter who drew
 * which sheet. It also makes palette-swapping trivial: the same mook sprite
 * becomes three different people by remapping four characters.
 *
 * Characters are chosen to be legible while authoring — lowercase is the base
 * tone, uppercase is the darker shade of the same hue.
 */
export const SPRITE_PALETTE: Record<string, string | null> = {
    // Nothing
    '.': null,
    ' ': null,

    // Structure
    'o': '#05070a', // outline / near-black
    'O': '#12171f', // soft outline for interior lines

    // Neutrals
    'W': '#ffffff',
    'w': '#d7dee6',
    'g': '#8b98a6',
    'G': '#5a6672',
    'd': '#2b333c',

    // Skin tones
    's': '#f0c49a',
    'S': '#c98f63',
    'k': '#8d5a38',
    'K': '#5d3a22',

    // Hair
    'h': '#2a2119',
    'H': '#584434',
    'z': '#c9ac6a', // blonde / grey-gold

    // Phosphor accent (matches --accent)
    'c': '#00e5c0',
    'C': '#0b8d78',

    // Magenta (matches --accent-2)
    'm': '#ff2e88',
    'M': '#a81255',

    // Warn / gold
    'y': '#ffb400',
    'Y': '#a06f00',
    'l': '#ffcc4d', // legendary gold highlight

    // Good / bad
    'n': '#46e06a',
    'N': '#23803c',
    'r': '#ff4747',
    'R': '#992424',

    // Denim / navy
    'b': '#3c5a8a',
    'B': '#22334f',

    // Violet
    'p': '#8C52FF',
    'P': '#4d2c94',

    // Earth / cardboard / bread
    'e': '#c89a5b',
    'E': '#8a6534',
    't': '#6b4a2f', // dark tan / leather
};

/**
 * A recolour map applied at bake time, e.g. `{ c: 'm', C: 'M' }` turns a
 * teal-kitted figure magenta. This is how one 24-line sprite yields a whole
 * crowd without authoring a second one.
 */
export type PaletteSwap = Record<string, string>;

export function resolveColor(char: string, swap?: PaletteSwap): string | null {
    const mapped = swap?.[char] ?? char;
    return SPRITE_PALETTE[mapped] ?? null;
}
