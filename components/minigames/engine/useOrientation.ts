import { useEffect, useState } from 'react';

/**
 * Which way the phone is being held, and whether that is a problem.
 *
 * Every canvas game here is wider than it is tall — the narrowest is 320x180,
 * the widest 352x198, all of them roughly 16:9. Held upright, a phone gives
 * that shape a strip across the middle of the screen and wastes the rest: a
 * 390x844 portrait viewport fits a 352-wide picture at 198 tall and leaves 646
 * pixels of nothing. Turned sideways the same phone gives the picture the full
 * height, which is where the 2x the follow-cam can punch to actually comes
 * from.
 *
 * So fullscreen and portrait together is worth interrupting for. Fullscreen and
 * landscape is not, and neither is portrait while the game is still inline in
 * the page, where the surrounding app is the point.
 */

/** Read the current aspect. Safe before mount and in a headless test. */
function readPortrait(): boolean {
    if (typeof window === 'undefined') return false;
    // Compared as a ratio rather than asking `screen.orientation`, which is
    // absent on older iOS and reports the *device* rather than the window —
    // wrong in a split view, and wrong in a desktop browser being resized.
    return window.innerHeight > window.innerWidth;
}

/**
 * Should the game stop and ask to be turned sideways?
 *
 * Pure so it can be tested without a window. The rule is deliberately narrow:
 * only interrupt when the player has already asked for fullscreen, because
 * inline in the page a portrait phone is showing them the rest of the app and
 * that is not a mistake.
 */
export function shouldPromptRotate(fullscreen: boolean, portrait: boolean): boolean {
    return fullscreen && portrait;
}

export function useOrientation() {
    const [portrait, setPortrait] = useState(readPortrait);

    useEffect(() => {
        const sync = () => setPortrait(readPortrait());
        window.addEventListener('resize', sync);
        // `orientationchange` fires before the viewport has finished resizing on
        // iOS, so the resize listener is the one that gets it right; this is
        // here because some Android browsers fire only this one.
        window.addEventListener('orientationchange', sync);
        sync();
        return () => {
            window.removeEventListener('resize', sync);
            window.removeEventListener('orientationchange', sync);
        };
    }, []);

    return portrait;
}
