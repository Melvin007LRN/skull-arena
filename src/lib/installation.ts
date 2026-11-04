// Installation de l'appli sur l'écran d'accueil (PWA).
import { useEffect, useState } from 'react';

interface InvitationInstallation extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }

let invitation: InvitationInstallation | null = null;
const abonnes = new Set<() => void>();
const prevenir = () => abonnes.forEach((f) => f());

export function preparerInstallation() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // on propose l'installation nous-mêmes, au bon moment
    invitation = e as InvitationInstallation;
    prevenir();
  });
  window.addEventListener('appinstalled', () => { invitation = null; prevenir(); });
}

export const estInstallee = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.matchMedia('(display-mode: fullscreen)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const estIPhone = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** 'pret' : bouton d'installation disponible (Android/Chrome) · 'iphone' : instructions Safari · 'installee' · 'indisponible' */
export function useInstallation() {
  const [, maj] = useState(0);
  useEffect(() => {
    const f = () => maj((n) => n + 1);
    abonnes.add(f);
    return () => { abonnes.delete(f); };
  }, []);
  const etat = estInstallee() ? 'installee' : invitation ? 'pret' : estIPhone() ? 'iphone' : 'indisponible';
  const installer = async () => {
    if (!invitation) return;
    await invitation.prompt();
    await invitation.userChoice.catch(() => null);
    invitation = null;
    prevenir();
  };
  return { etat, installer } as const;
}
