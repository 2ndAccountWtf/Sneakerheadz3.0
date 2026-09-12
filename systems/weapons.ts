/**
 * AM/PM Weapons
 * =============
 * The AM/PM clerks have always talked about the chancla, the baguette and the
 * Chicago dog launcher ("out of stock — someone used it on a scooter gang").
 * This is the registry that makes those lines real: it maps storage items onto
 * combat behaviour, and the mini-games read from here.
 *
 * A weapon the player is carrying is automatically available in any game whose
 * id appears in `games`. Nothing needs equipping — if it's in the cache, it's
 * in your hands.
 */
import type { Player } from '../types';
import type { MiniGameId } from '../types/game';

export type WeaponClass =
    | 'melee'    // swung; short reach, high damage
    | 'thrown'   // arcs, consumed on use, can be picked back up if it returns
    | 'ranged'   // fires projectiles, has ammo
    | 'utility'; // does something other than damage

export interface Weapon {
    /** Matches a StorageItem id, so owning the item grants the weapon. */
    id: string;
    name: string;
    short: string;
    glyph: string;
    klass: WeaponClass;
    damage: number;
    /** Seconds between uses. */
    cooldown: number;
    /** Projectile speed in logical px/sec. Ignored for melee. */
    speed?: number;
    /** Uses per game. Undefined means unlimited. */
    uses?: number;
    /** Comes back to you — the chancla is a homing weapon and always has been. */
    returns?: boolean;
    /** Passes through enemies instead of stopping at the first. */
    piercing?: boolean;
    /** Applies a slow to whatever it hits. */
    slows?: boolean;
    /** Which mini-games this is usable in. */
    games: MiniGameId[];
    flavor: string;
}

export const WEAPONS: Weapon[] = [
    {
        id: 'itm-chanclas',
        name: 'Chanclas (Homing)',
        short: 'Chancla',
        glyph: '🩴',
        klass: 'thrown',
        damage: 34,
        cooldown: 0.55,
        speed: 190,
        returns: true,
        games: ['street-brawl', 'flight-404', 'cart-race', 'sneaker-chase'],
        flavor: 'Ancient guidance system, zero latency. It comes back.',
    },
    {
        id: 'itm-baguette',
        name: 'Paris Baguette',
        short: 'Baguette',
        glyph: '🥖',
        klass: 'melee',
        damage: 26,
        cooldown: 0.38,
        games: ['street-brawl', 'flight-404'],
        flavor: 'Crust does crit damage at close range.',
    },
    {
        id: 'itm-crowbar',
        name: '3 AM Crowbar',
        short: 'Crowbar',
        glyph: '🔧',
        klass: 'melee',
        damage: 38,
        cooldown: 0.62,
        games: ['street-brawl', 'flight-404'],
        flavor: 'Someone bought this with chocolate milk at 3 AM. Nobody saw them again.',
    },
    {
        id: 'itm-frisbee',
        name: 'Beach Frisbee',
        short: 'Frisbee',
        glyph: '🥏',
        klass: 'thrown',
        damage: 20,
        cooldown: 0.34,
        speed: 240,
        returns: true,
        piercing: true,
        games: ['street-brawl', 'flight-404', 'cart-race', 'sneaker-chase'],
        flavor: 'Cuts through a whole row of people and comes home. Physics-adjacent.',
    },
    {
        id: 'itm-dog-launcher',
        name: 'Chicago Dog Launcher',
        short: 'Dog Launcher',
        glyph: '🌭',
        klass: 'ranged',
        damage: 17,
        cooldown: 0.16,
        speed: 300,
        uses: 40,
        games: ['flight-404', 'cart-race'],
        flavor: 'Back in stock. The scooter gang has not recovered.',
    },
    {
        id: 'itm-slushie',
        name: 'Blue Slushie (Weaponised)',
        short: 'Slushie',
        glyph: '🥤',
        klass: 'thrown',
        damage: 10,
        cooldown: 0.45,
        speed: 175,
        slows: true,
        uses: 12,
        games: ['street-brawl', 'flight-404', 'cart-race'],
        flavor: 'The machine knows things. It wants this.',
    },
    {
        id: 'itm-chocmilk-bag',
        name: 'Chocolate Milk (Bag)',
        short: 'Choc Milk',
        glyph: '🥛',
        klass: 'thrown',
        damage: 22,
        cooldown: 0.5,
        speed: 165,
        uses: 8,
        games: ['street-brawl', 'flight-404', 'cart-race'],
        flavor: 'Bursts on impact. Deeply upsetting to be hit by.',
    },
    {
        id: 'itm-burekas',
        name: 'Bureka (Still Hot)',
        short: 'Bureka',
        glyph: '🥟',
        klass: 'thrown',
        damage: 14,
        cooldown: 0.3,
        speed: 200,
        uses: 15,
        games: ['street-brawl', 'flight-404', 'cart-race'],
        flavor: 'Burns your tongue but heals your soul. Also burns their face.',
    },
    {
        id: 'itm-haunted-lighter',
        name: 'Glow-in-the-Dark Lighter',
        short: 'Lighter',
        glyph: '🔦',
        klass: 'utility',
        damage: 0,
        cooldown: 0,
        games: ['flight-404'],
        flavor: 'Lights the dark sections of the cabin. Trust me, you NEED this.',
    },
    {
        id: 'itm-longboard',
        name: 'Venice Longboard',
        short: 'Longboard',
        glyph: '🛹',
        klass: 'utility',
        damage: 0,
        cooldown: 0,
        games: ['cart-race', 'sneaker-chase'],
        flavor: 'The difference between chasing a shopping cart and catching one.',
    },
    {
        id: 'itm-energy-drink',
        name: 'Energy Drink',
        short: 'Energy',
        glyph: '⚡',
        klass: 'utility',
        damage: 0,
        cooldown: 0,
        games: ['street-brawl', 'flight-404', 'cart-race', 'sneaker-chase', 'street-ball'],
        flavor: 'Everything moves faster, including your mistakes.',
    },
];

const BY_ID = new Map(WEAPONS.map(w => [w.id, w]));

export const getWeapon = (id: string): Weapon | undefined => BY_ID.get(id);

/** Every weapon the player is carrying that works in this game. */
export function loadoutFor(player: Player, game: MiniGameId): Weapon[] {
    return player.storage
        .filter(item => item.qty > 0)
        .map(item => BY_ID.get(item.id))
        .filter((w): w is Weapon => !!w && w.games.includes(game));
}

/** The offensive weapons only — what a game actually gives you to attack with. */
export function armsFor(player: Player, game: MiniGameId): Weapon[] {
    return loadoutFor(player, game).filter(w => w.klass !== 'utility');
}

export const hasWeapon = (player: Player, id: string): boolean =>
    player.storage.some(item => item.id === id && item.qty > 0);

/** Bare hands, so no game ever leaves the player with nothing to press. */
export const FISTS: Weapon = {
    id: 'fists',
    name: 'Bare Hands',
    short: 'Fists',
    glyph: '👊',
    klass: 'melee',
    damage: 12,
    cooldown: 0.3,
    games: ['street-brawl', 'flight-404', 'cart-race', 'sneaker-chase'],
    flavor: 'You brought nothing. Classic.',
};
