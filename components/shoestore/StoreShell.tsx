import React from 'react';

/** Backwards-compatible wrapper; the store now lays itself out in flow. */
const StoreShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="relative">{children}</div>
);

export default StoreShell;
