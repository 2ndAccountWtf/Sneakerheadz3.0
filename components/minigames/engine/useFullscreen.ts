import type { RefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';

/**
 * Put one element into real fullscreen, and try to get the phone landscape.
 *
 * The games are 320x180 and 352x198 — sixteen-by-nine, near enough — and they
 * were being drawn into a column of a scrolling page, so on a phone held
 * upright the picture was a letterbox strip about a fifth of the screen tall
 * with the controls under it and the rest of the arcade listing below that.
 * Turning the phone sideways did nothing useful, because the page was still a
 * page. This makes the cabinet the whole screen instead.
 *
 * ## Orientation
 *
 * `screen.orientation.lock` is the part browsers disagree about. Chrome on
 * Android honours it while an element is fullscreen; Safari on iOS has no such
 * method at all, and iPhones additionally refuse rotation entirely when the
 * system rotation lock is on. So the lock is attempted and its failure ignored:
 * on Android the phone turns itself, and everywhere else the layout simply
 * works in whichever orientation it finds itself, which it has to do anyway.
 *
 * Nothing here throws. A browser with no Fullscreen API at all — or a user who
 * denies it — leaves `active` false and the caller keeps its inline layout.
 */

type FsElement = HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
};
type FsDocument = Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
    webkitFullscreenElement?: Element | null;
};
type LockableOrientation = ScreenOrientation & {
    lock?: (o: string) => Promise<void>;
};

/** Is anything currently fullscreen? Covers the older WebKit spelling. */
function fullscreenElement(): Element | null {
    if (typeof document === 'undefined') return null;
    const d = document as FsDocument;
    return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
}

export function useFullscreen(target: RefObject<HTMLElement | null>) {
    const [active, setActive] = useState(false);

    // The browser can leave fullscreen without us — Escape, the back gesture,
    // a phone call — so the flag has to follow the document rather than our own
    // last request, or the layout stays stretched over a page that is no longer
    // fullscreen.
    useEffect(() => {
        const sync = () => setActive(Boolean(fullscreenElement()));
        document.addEventListener('fullscreenchange', sync);
        document.addEventListener('webkitfullscreenchange', sync);
        sync();
        return () => {
            document.removeEventListener('fullscreenchange', sync);
            document.removeEventListener('webkitfullscreenchange', sync);
        };
    }, []);

    const enter = useCallback(async () => {
        const el = target.current as FsElement | null;
        if (!el) return;
        try {
            if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
            else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
            else return;                 // no API: the caller stays inline
        } catch {
            return;                      // denied, or not allowed from this gesture
        }
        // Best effort, and genuinely optional — see the note above.
        try {
            await (screen.orientation as LockableOrientation | undefined)?.lock?.('landscape');
        } catch { /* iOS, desktop, and anything that says no */ }
    }, [target]);

    const exit = useCallback(async () => {
        try {
            (screen.orientation as LockableOrientation | undefined)?.unlock?.();
        } catch { /* same browsers, same shrug */ }
        try {
            const d = document as FsDocument;
            if (!fullscreenElement()) return;
            if (d.exitFullscreen) await d.exitFullscreen();
            else if (d.webkitExitFullscreen) await d.webkitExitFullscreen();
        } catch { /* already gone */ }
    }, []);

    const toggle = useCallback(() => { void (active ? exit() : enter()); }, [active, enter, exit]);

    /**
     * Whether fullscreen is worth offering at all. Checked at call time rather
     * than at import, because it is a DOM question and these modules are also
     * loaded by the test suite under plain Node.
     */
    const supported = typeof document !== 'undefined'
        && (Boolean(document.documentElement.requestFullscreen)
            || Boolean((document.documentElement as FsElement).webkitRequestFullscreen));

    return { active, supported, enter, exit, toggle };
}
