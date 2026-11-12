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

// iPhone, appli ajoutée à l'écran d'accueil : iOS annonce parfois une hauteur plus courte que l'écran
// (la barre d'état est retirée du calcul), ce qui laisse une bande noire en bas. On prend la vraie hauteur.
function hauteurEcran() {
  const nav = navigator as Navigator & { standalone?: boolean };
  const appli = nav.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  const portrait = window.innerHeight > window.innerWidth;
  const h = appli && portrait ? Math.max(window.innerHeight, screen.height) : window.innerHeight;
  document.documentElement.style.setProperty('--hauteur-ecran', `${h}px`);
}
hauteurEcran();
window.addEventListener('resize', hauteurEcran);
window.addEventListener('orientationchange', () => setTimeout(hauteurEcran, 300));
