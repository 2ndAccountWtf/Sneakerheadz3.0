/**
 * A shot flies the way it was thrown.
 *
 * `fire()` is careful that the house only ever throws a plain shoe — it never
 * carries your AM/PM kit — and then the flight step read the profile back off
 * the world instead of off the projectile, so the opponent's shoe inherited
 * whatever *you* had equipped. Bring the frisbee and the AI's shoe became
 * piercing at a fifth of the gravity; bring the chancla and it homed on you.
 * The AI got harder the better your loadout was, silently.
 *
 * `profileId` was on the projectile the whole time. These checks are about why
 * that matters: if the profiles all flew the same way the bug would have been
 * harmless, and they very much do not.
 */
import assert from 'node:assert/strict';
import {
    PROFILES, launchProjectile, tickProjectile, GRAVITY,
} from '../components/minigames/RooftopArtillery.tsx';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

/** Fly a shot for a second and report where it ended up. */
const fly = (profileId: string, wind = 20, target = { x: 300, y: 100 }) => {
    const p = launchProjectile(40, 100, 45, 60, 1, PROFILES[profileId]);
    for (let i = 0; i < 60; i++) tickProjectile(p, 1 / 60, GRAVITY, wind, PROFILES[profileId], target);
    return p;
};

console.log('\na shot flies the way it was thrown');

t('a projectile remembers which profile launched it', () => {
    // The fix has to read this rather than the world's current selection, so it
    // had better be set and it had better be right.
    for (const id of Object.keys(PROFILES)) {
        assert.equal(launchProjectile(0, 0, 45, 50, 1, PROFILES[id]).profileId, id);
    }
});

t('the profiles are not interchangeable', () => {
    // If they all flew alike, using the wrong one would not matter. Every
    // profile has to land somewhere meaningfully different from a plain shoe,
    // or it is not a distinct weapon in the first place.
    const shoe = fly('shoe');
    for (const id of Object.keys(PROFILES)) {
        if (id === 'shoe') continue;
        const other = fly(id);
        const apart = Math.hypot(other.x - shoe.x, other.y - shoe.y);
        assert.ok(apart > 8, `${id} lands ${apart.toFixed(1)}px from a shoe — indistinguishable`);
    }
});

t('gravity, wind and speed each actually do something', () => {
    // The three multipliers the mix-up swapped. Each is checked on its own so a
    // profile that differs only by a flag still proves the machinery works.
    const light = launchProjectile(0, 0, 45, 60, 1, { ...PROFILES.shoe, gravityMul: 0.2 });
    const heavy = launchProjectile(0, 0, 45, 60, 1, { ...PROFILES.shoe, gravityMul: 1 });
    for (let i = 0; i < 60; i++) {
        tickProjectile(light, 1 / 60, GRAVITY, 0, { ...PROFILES.shoe, gravityMul: 0.2 }, { x: 9e9, y: 0 });
        tickProjectile(heavy, 1 / 60, GRAVITY, 0, { ...PROFILES.shoe, gravityMul: 1 }, { x: 9e9, y: 0 });
    }
    assert.ok(light.y < heavy.y, 'low gravity should still be higher after a second');

    const still = fly('shoe', 0, { x: 9e9, y: 0 });
    const blown = fly('shoe', 50, { x: 9e9, y: 0 });
    assert.notEqual(Math.round(still.x), Math.round(blown.x), 'wind moved nothing');
});

t('homing only happens to the profile that asked for it', () => {
    // The nastiest half of the mix-up: with the chancla selected, the house's
    // shoe steered toward the player.
    const near = { x: 60, y: 40 };
    const plain = launchProjectile(40, 100, 45, 60, 1, PROFILES.shoe);
    const chased = launchProjectile(40, 100, 45, 60, 1, { ...PROFILES.shoe, homing: 400 });
    for (let i = 0; i < 30; i++) {
        tickProjectile(plain, 1 / 60, GRAVITY, 0, PROFILES.shoe, near);
        tickProjectile(chased, 1 / 60, GRAVITY, 0, { ...PROFILES.shoe, homing: 400 }, near);
    }
    const dPlain = Math.hypot(plain.x - near.x, plain.y - near.y);
    const dChased = Math.hypot(chased.x - near.x, chased.y - near.y);
    assert.ok(dChased < dPlain, `homing ended ${dChased.toFixed(1)}px away, plain ${dPlain.toFixed(1)}px`);
    assert.equal(PROFILES.shoe.homing, 0, 'a plain shoe must never steer');
});

console.log(`\n${pass} rooftop projectile checks passed\n`);
