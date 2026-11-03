// Accueil (provisoire pour l'étape 2) : logo, menu de gros boutons, avis de recherche.
// Les boutons de jeu seront branchés aux étapes suivantes.
import { useEffect, useState } from 'react';
import type { Profil } from '../lib/profil.ts';
import { grade, niveau } from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';

export function Accueil({ profil, ouvrirProfil }: { profil: Profil; ouvrirProfil: () => void }) {
  const [reduit, setReduit] = useState(false);
  const [bientot, setBientot] = useState<string | null>(null);

  useEffect(() => {
    const surDefilement = () => setReduit(window.scrollY > 60);
    window.addEventListener('scroll', surDefilement, { passive: true });
    return () => window.removeEventListener('scroll', surDefilement);
  }, []);

  useEffect(() => {
    if (!bientot) return;
    const t = setTimeout(() => setBientot(null), 1800);
    return () => clearTimeout(t);
  }, [bientot]);

  const n = niveau(profil.xp);
  const boutons: Array<{ libelle: string; action?: () => void; grand?: boolean }> = [
    { libelle: 'Jouer', grand: true },
    { libelle: 'Rejoindre avec un code' },
    { libelle: 'Entraînement' },
    { libelle: 'Classement' },
    { libelle: 'Profil', action: ouvrirProfil },
    { libelle: 'Règles' },
    { libelle: 'Réglages' },
  ];

  return (
    <main className="ecran ecran-accueil">
      <header className={`entete-logo ${reduit ? 'reduit' : ''}`}>
        <img src="/decor/logo.webp" alt="Skull Arena" />
      </header>

      <button type="button" className="carte-joueur" onClick={ouvrirProfil}>
        <Avatar photo={profil.photo_url} taille={64} />
        <span className="carte-joueur-texte">
          <strong>{profil.pseudo}</strong>
          <span>Niveau {n} · {grade(n)}</span>
        </span>
      </button>

      <nav className="menu">
        {boutons.map((b) => (
          <button key={b.libelle} type="button" className={`bouton-or ${b.grand ? 'bouton-jouer' : ''}`}
            onClick={b.action ?? (() => setBientot(b.libelle))}>
            {b.libelle}
          </button>
        ))}
      </nav>

      <section className="avis-recherche">
        <p className="avis-titre">AVIS DE RECHERCHE</p>
        <div className="avis-portrait"><Avatar photo={null} taille={120} /></div>
        <p className="avis-nom">Le pirate à abattre</p>
        <p className="avis-detail">Le numéro 1 du classement apparaîtra ici.</p>
      </section>

      {bientot && <div className="toast">{bientot} : bientôt disponible</div>}
    </main>
  );
}
