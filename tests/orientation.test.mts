/**
 * When to interrupt the game and ask for the phone to be turned.
 *
 * `screen.orientation.lock` is honoured by Chrome on Android and does not exist
 * on iOS, so a phone cannot be made to rotate — it has to be asked, and asking
 * at the wrong moment is worse than not asking. The rule lives in a pure
 * function precisely so it can be checked without a browser.
 */
import assert from 'node:assert/strict';
import { shouldPromptRotate } from '../components/minigames/engine/useOrientation.ts';

let pass = 0;
const t = (n: string, f: () => void) => { f(); pass++; console.log('  ok  ' + n); };

t('fullscreen and upright is the only case worth interrupting', () => {
    assert.equal(shouldPromptRotate(true, true), true);
});

t('inline and upright is not a mistake', () => {
    // Portrait in the page is the player looking at the rest of the app, which
    // is the whole point of the game being embedded in it. Interrupting there
    // would fire on the Arcade list, the venue screen, everywhere.
    assert.equal(shouldPromptRotate(false, true), false);
});

t('sideways is never interrupted', () => {
    assert.equal(shouldPromptRotate(true, false), false);
    assert.equal(shouldPromptRotate(false, false), false);
});

t('the prompt depends on nothing else', () => {
    // Two booleans, four cases, all four pinned. If this ever needs a third
    // input, this check is the thing that has to change first.
    const cases: Array<[boolean, boolean, boolean]> = [
        [true, true, true],
        [true, false, false],
        [false, true, false],
        [false, false, false],
    ];
    for (const [fs, portrait, want] of cases) {
        assert.equal(shouldPromptRotate(fs, portrait), want, `fullscreen=${fs} portrait=${portrait}`);
    }
});

console.log(`\n${pass} orientation checks passed.`);
