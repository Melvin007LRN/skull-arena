import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.tsx';
import './style.css';
import './perso.css';
import './nuit.css';
import './maquette.css';
import { preparerInstallation } from './lib/installation.ts';

preparerInstallation();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
