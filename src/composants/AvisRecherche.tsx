// L'avis de recherche : le pirate qui a le plus de victoires de tous les temps, placardé au lancement
// (une fois par jour, après les actualités) et rouvrable depuis l'accueil.
import { useEffect, useState } from 'react';
import { chargerRecordVictoires } from '../lib/profil.ts';
import { Avatar } from './Avatar.tsx';
import { actualitesVues } from './Actualites.tsx';

const EVENEMENT = 'skull-avis';
export const ACTU_FERMEE = 'skull-actu-fermee';
const CLE = 'skull-avis-jour';
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** L'avis du jour a-t-il déjà été vu ? */
export function avisVuAujourdhui(): boolean { try { return localStorage.getItem(CLE) === aujourdhui(); } catch { return true; } }

/** Rouvre l'avis de recherche (bouton « Avis » de l'accueil). */
export function ouvrirAvis() { window.dispatchEvent(new Event(EVENEMENT)); }

type Record = { id: string; pseudo: string; photo_url: string | null; cadre: string | null; victoires: number; parties_jouees: number };

export function AvisRecherche({ moi, defier }: { moi: string; defier: () => void }) {
  const [ouvert, setOuvert] = useState(false);
  const [r, setR] = useState<Record | null>(null);
  useEffect(() => {
    chargerRecordVictoires().then(setR).catch(() => {});
    const ouvrir = () => setOuvert(true);
    const auto = () => { let vu = false; try { vu = localStorage.getItem(CLE) === aujourdhui(); } catch { /* sans stockage */ } if (!vu) setOuvert(true); };
    window.addEventListener(EVENEMENT, ouvrir);
    window.addEventListener(ACTU_FERMEE, auto);
    let t: ReturnType<typeof setTimeout> | undefined;
    if (actualitesVues()) t = setTimeout(auto, 600);
    return () => { window.removeEventListener(EVENEMENT, ouvrir); window.removeEventListener(ACTU_FERMEE, auto); if (t) clearTimeout(t); };
  }, []);
  if (!ouvert) return null;
  const fermer = () => { try { localStorage.setItem(CLE, aujourdhui()); } catch { /* sans stockage */ } setOuvert(false); };
  const cestMoi = r?.id === moi;
  const taux = r && r.parties_jouees > 0 ? Math.round((100 * r.victoires) / r.parties_jouees) : 0;
  return (
    <div className="voile avis-voile" onClick={fermer}>
      <div className="avis-affiche" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Avis de recherche">
        <span className="avis-clou" aria-hidden="true" />
        <p className="avis-wanted">WANTED</p>
        <p className="avis-entete">Avis de recherche · Mort ou vif</p>
        <div className="avis-cadre">
          <Avatar photo={r?.photo_url ?? null} taille={150} cadre={r?.cadre} />
        </div>
        <p className="avis-pseudo">{r ? r.pseudo : 'Inconnu'}</p>
        <p className="avis-crime">{r ? `Coupable de ${r.victoires} victoire${r.victoires > 1 ? 's' : ''} en ${r.parties_jouees} partie${r.parties_jouees > 1 ? 's' : ''} (${taux} %)` : 'Le pirate qui a le plus de victoires sera placardé ici.'}</p>
        <p className="avis-prime"><small>Prime</small><strong>{((r?.victoires ?? 0) * 1000).toLocaleString('fr-FR')}</strong><small>Louidors</small></p>
        <p className="avis-mot">{cestMoi ? 'C’est toi ! Toute l’Arena veut ta tête.' : 'Bats-le et prends sa place au sommet.'}</p>
        <div className="avis-boutons">
          <button type="button" className="avis-bouton secondaire" onClick={fermer}>Plus tard</button>
          <button type="button" className="avis-bouton" onClick={() => { fermer(); defier(); }}>{cestMoi ? 'Défendre mon titre' : 'Le défier !'}</button>
        </div>
      </div>
    </div>
  );
}
