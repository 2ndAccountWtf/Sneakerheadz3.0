import React, { useState } from 'react';

interface ImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    /** Shown in place of the image if it fails to load. */
    fallback?: string;
}

/**
 * Every image in the game comes from picsum.photos, a third-party placeholder
 * service. When it is slow, blocked or down, a bare <img> collapses into
 * sprawling alt text and wrecks the layout. This swaps in a styled tile
 * instead, so a failed fetch degrades quietly.
 */
const Img: React.FC<ImgProps> = ({ fallback = '👟', className = '', alt = '', ...props }) => {
    const [failed, setFailed] = useState(false);

    if (failed) {
        return (
            <div
                className={`flex items-center justify-center bg-[var(--bg-sunken)] text-[var(--ink-faint)] select-none ${className}`}
                role="img"
                aria-label={alt}
            >
                <span className="text-2xl opacity-40">{fallback}</span>
            </div>
        );
    }

    return <img {...props} alt={alt} className={className} onError={() => setFailed(true)} />;
};

export default Img;
