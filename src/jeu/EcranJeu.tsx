// Branche l'écran de jeu sur le serveur : état en temps réel, coups, réveil des robots, phrases rapides.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { appel, usePartie, type MembreSalon } from '../lib/jeu.ts';
import { TableJeu } from './TableJeu.tsx';
import './jeu.css';

export const PHRASES_RAPIDES = [
  'C’est très fort', 'Ah oui les jean', 'Bravo', 'Pardon', 'Masterclass', 'Tu fais chauffer', 'C’est pour moi', 'Il va la chercher',
];
const ANTI_SPAM_MS = 3000;

export function EcranJeu({ partieId, membres, moi, hote, retourAccueil }: {
  partieId: string; membres: MembreSalon[]; moi: string; hote: string; retourAccueil: () => void;
}) {
  const { vue, main } = usePartie(partieId, moi);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bulle, setBulle] = useState<{ de: string; texte: string; cle: number } | null>(null);
  const canalChat = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dernierEnvoi = useRef(0);

  const envoyer = useCallback(async (coup: Record<string, unknown>) => {
    setEnCours(true);
    setErreur(null);
    try {
      await appel('jouer', { partie_id: partieId, coup });
      return true;
    } catch (e) {
      setErreur((e as Error).message);
      setTimeout(() => setErreur(null), 3500);
      return false;
    } finally {
      setEnCours(false);
    }
  }, [partieId]);

  // Réveil toutes les 20 s : remplace les absents (2 min) et relance les robots si besoin.
  const finie = vue?.phase === 'fin_partie' || vue?.annulee;
  useEffect(() => {
    if (finie) return;
    const reveil = () => appel('reveiller', { partie_id: partieId }).catch(() => {});
    reveil();
    const t = setInterval(reveil, 20000);
    return () => clearInterval(t);
  }, [partieId, finie]);

  // Retour après une absence : on reprend la main à la manche suivante.
  const suisRemplace = !!vue?.remplaces?.includes(moi) && !vue?.definitifs?.includes(moi);
  useEffect(() => {
    if (!suisRemplace) return;
    const revenir = () => document.visibilityState === 'visible' && appel('revenir', { partie_id: partieId }).catch(() => {});
    revenir();
    document.addEventListener('visibilitychange', revenir);
    return () => document.removeEventListener('visibilitychange', revenir);
  }, [suisRemplace, partieId]);

  // Phrases rapides : diffusées en direct, la dernière remplace aussitôt la précédente.
  useEffect(() => {
    const canal = supabase.channel(`phrases-${partieId}`, { config: { broadcast: { self: true } } });
    let minuterie = 0;
    canal.on('broadcast', { event: 'phrase' }, ({ payload }) => {
      const { de, texte } = payload as { de: string; texte: string };
      if (!PHRASES_RAPIDES.includes(texte)) return;
      clearTimeout(minuterie);
      setBulle({ de, texte, cle: Date.now() });
      minuterie = window.setTimeout(() => setBulle(null), 2600);
    }).subscribe();
    canalChat.current = canal;
    return () => { clearTimeout(minuterie); supabase.removeChannel(canal); };
  }, [partieId]);

  const envoyerPhrase = useCallback((texte: string) => {
    if (Date.now() - dernierEnvoi.current < ANTI_SPAM_MS) return;
    dernierEnvoi.current = Date.now();
    canalChat.current?.send({ type: 'broadcast', event: 'phrase', payload: { de: moi, texte } });
  }, [moi]);

  // En partie, on tente le plein écran et le verrouillage en paysage (fonctionne sur Android).
  useEffect(() => {
    const verrouiller = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch { /* iPhone : on affiche « Tourne ton téléphone » à la place */ }
    };
    document.addEventListener('pointerdown', verrouiller, { once: true });
    return () => document.removeEventListener('pointerdown', verrouiller);
  }, []);

  const sortir = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    retourAccueil();
  }, [retourAccueil]);

  if (!vue || !main) {
    return <div className="jeu"><div className="jeu-decor" /><p className="jeu-chargement">Distribution des cartes…</p></div>;
  }

  return (
    <TableJeu
      vue={vue} main={main} membres={membres} moi={moi} hote={hote}
      enCours={enCours} erreur={erreur} bulle={bulle} phrases={PHRASES_RAPIDES}
      envoyer={envoyer} envoyerPhrase={envoyerPhrase}
      quitter={async () => { try { await appel('abandonner', { partie_id: partieId }); } catch { /* déjà finie */ } sortir(); }}
      exclure={(j) => appel('exclure', { salon_id: membres[0]?.salon_id, joueur_id: j }).catch((e) => setErreur((e as Error).message))}
      retourAccueil={sortir}
    />
  );
}
