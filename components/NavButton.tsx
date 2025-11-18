
import React from 'react';

interface NavButtonProps {
    onClick: () => void;
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    variant?: 'primary' | 'secondary' | 'danger' | 'gold';
}

const NavButton: React.FC<NavButtonProps> = ({ onClick, children, className = '', disabled = false, variant = 'primary' }) => {
    // Variant color mappings
    const variants = {
        primary: {
            border: "border-cyan-500/50 group-hover:border-cyan-400",
            text: "text-cyan-400 group-hover:text-black",
            bg: "bg-cyan-400",
            shadow: "shadow-[0_0_10px_rgba(0,255,247,0.2)]"
        },
        secondary: {
            border: "border-gray-600 group-hover:border-gray-400",
            text: "text-gray-400 group-hover:text-white",
            bg: "bg-gray-700",
            shadow: ""
        },
        danger: {
            border: "border-red-500/50 group-hover:border-red-400",
            text: "text-red-400 group-hover:text-black",
            bg: "bg-red-500",
            shadow: "shadow-[0_0_10px_rgba(239,68,68,0.2)]"
        },
        gold: {
            border: "border-yellow-500/50 group-hover:border-yellow-400",
            text: "text-yellow-400 group-hover:text-black",
            bg: "bg-yellow-400",
            shadow: "shadow-[0_0_10px_rgba(234,179,8,0.2)]"
        }
    };

    const v = variants[variant];

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`
                relative group font-bold uppercase tracking-widest text-sm sm:text-base
                transition-all duration-200 ease-out transform active:scale-95
                ${disabled ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
                ${className}
            `}
            style={{
                padding: '0.75rem 1.5rem',
            }}
        >
            {/* Base Shape border */}
            <div className={`absolute inset-0 border-2 ${v.border} transition-colors duration-200`} 
                 style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }} 
            />
            
            {/* Hover Fill Animation */}
            <div className={`absolute inset-0 ${v.bg} translate-y-full group-hover:translate-y-0 transition-transform duration-200 ease-out`} 
                 style={{ clipPath: "polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px)" }}
            />

            {/* Content */}
            <span className={`relative z-10 flex items-center justify-center gap-2 ${v.text} transition-colors duration-200`}>
                {children}
            </span>
            
            {/* Corner Accent */}
            <div className={`absolute bottom-0 right-0 w-2 h-2 ${v.bg} opacity-50 group-hover:opacity-100 transition-opacity`} 
                 style={{ clipPath: "polygon(100% 0, 0 100%, 100% 100%)" }}
            />
        </button>
    );
};

export default NavButton;
    