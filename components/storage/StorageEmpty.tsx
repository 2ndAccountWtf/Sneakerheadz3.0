import React from 'react';
import { storageTheme } from './storage.theme';

const emptyStyle: React.CSSProperties = {
    minHeight: '40vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    padding: '2rem',
    background: 'rgba(0,0,0,0.2)',
    border: `2px dashed ${storageTheme.colors.gold}55`,
    borderRadius: storageTheme.radii.card,
    marginTop: '2rem'
};

const titleStyle: React.CSSProperties = {
    fontFamily: "'Bungee', cursive",
    color: storageTheme.colors.gold,
    textShadow: '1px 1px 3px rgba(0,0,0,0.5)'
};

const ctaStyle: React.CSSProperties = {
    fontFamily: "'Bungee', cursive",
    backgroundColor: storageTheme.colors.gold,
    color: '#111',
    padding: '0.75rem 1.5rem',
    borderRadius: storageTheme.radii.button,
    marginTop: '1.5rem',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    transition: 'transform 0.2s ease',
};


export const StorageEmpty: React.FC = () => {
    return (
        <div style={emptyStyle}>
            <h2 style={titleStyle} className="text-3xl">Vault's clean.</h2>
            <p className="text-gray-400 mt-2" style={{fontFamily: "'Oxanium', sans-serif"}}>Go make it messy.</p>
            <button style={ctaStyle} className="hover:scale-105" onClick={() => alert("Routing to AM/PM...")}>
                Go to AM/PM
            </button>
        </div>
    );
};
