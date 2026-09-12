import React from 'react';

interface NavButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'gold' | 'ghost';
    size?: 'sm' | 'md';
    title?: string;
}

const VARIANTS: Record<NonNullable<NavButtonProps['variant']>, string> = {
    primary: 'btn btn-primary',
    secondary: 'btn',
    danger: 'btn btn-danger',
    gold: 'btn btn-gold',
    ghost: 'btn btn-ghost',
};

/**
 * The one button in the game. Variants map straight onto the design-system
 * classes in index.html so nothing re-invents its own hover state.
 */
const NavButton: React.FC<NavButtonProps> = ({
    onClick, children, className = '', disabled = false, variant = 'secondary', size = 'md', title,
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`${VARIANTS[variant]} ${size === 'sm' ? 'btn-sm' : ''} no-tap-highlight ${className}`}
    >
        {children}
    </button>
);

export default NavButton;
