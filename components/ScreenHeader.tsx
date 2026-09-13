import React from 'react';
import { useGame } from '../hooks/useGame';
import { Screen } from '../types';
import NavButton from './NavButton';

interface ScreenHeaderProps {
    title: React.ReactNode;
    subtitle?: string;
    /** Where the back button goes. Pass null to hide it entirely. */
    back?: Screen | null;
    backLabel?: string;
    actions?: React.ReactNode;
}

/**
 * Every screen opens the same way: a title on the left, optional actions, and
 * a way back on the right. Previously each screen hand-rolled this and they
 * all drifted apart in size, font and spacing.
 */
const ScreenHeader: React.FC<ScreenHeaderProps> = ({
    title, subtitle, back = Screen.Dashboard, backLabel = 'Back', actions,
}) => {
    const { changeScreen } = useGame();

    return (
        <div className="flex items-start justify-between gap-3 mb-4 sm:mb-6">
            <div className="min-w-0">
                <h1 className="screen-title truncate">{title}</h1>
                {/* Wraps rather than truncating. Most subtitles are short
                    status lines ("5/10 · Day 3") that never reach the edge,
                    but four screens use theirs for a joke — "A card is safe
                    until it isn't", "Ways to make money your accountant would
                    not approve of" — and `truncate` was cutting every one of
                    them off before the punchline at phone width. Clamped at
                    two lines so a long dynamic subtitle still cannot push the
                    page around. */}
                {subtitle && <p className="label mt-1 leading-snug line-clamp-2">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                {actions}
                {back ? (
                    <NavButton variant="ghost" size="sm" onClick={() => changeScreen(back)}>
                        ← {backLabel}
                    </NavButton>
                ) : null}
            </div>
        </div>
    );
};

export default ScreenHeader;
