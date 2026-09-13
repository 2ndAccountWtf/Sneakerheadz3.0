
import './styles/theme.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loadArt } from './systems/sprites/registry';
import { ALL_SPRITES } from './data/sprites';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);

const mount = (): void => {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

// Hand-drawn PNGs in `assets/art` override the code-defined sprites of the same
// id. Loading them before the first paint means a store card never flashes the
// coded fallback and then swaps. With no art delivered this resolves on the
// next microtask, so it costs nothing until it costs something — and a failed
// image must never keep the game from mounting, hence the catch.
loadArt(ALL_SPRITES).catch(() => undefined).then(mount);
