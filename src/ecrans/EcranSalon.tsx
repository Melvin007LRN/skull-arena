// Aiguillage d'un salon : salle d'attente tant que la partie n'a pas commencé, puis table de jeu.
import { EcranAttente } from '../composants/Attente.tsx';
import { useEffect } from 'react';
import { useSalon } from '../lib/jeu.ts';
import { SalleAttente } from './SalleAttente.tsx';
import { EcranJeu } from '../jeu/EcranJeu.tsx';

export function EcranSalon({ salonId, moi, sortir }: { salonId: string; moi: string; sortir: () => void }) {
  const { salon, membres, partieId, suisDedans } = useSalon(salonId, moi);

  // Salon supprimé ou exclusion : retour au port.
  const perdu = salon === null || (salon !== undefined && membres.length > 0 && !suisDedans);
  useEffect(() => {
    if (!perdu) return;
    const t = setTimeout(sortir, 2500);
    return () => clearTimeout(t);
  }, [perdu, sortir]);

  if (salon === undefined) return <EcranAttente texte="Montée à bord" decor="taverne" />;
  if (perdu) {
    return (
      <main className="ecran ecran-centre">
        <section className="parchemin"><p className="message erreur">Tu n'es plus dans ce salon. Retour au port…</p></section>
      </main>
    );
  }
  if (salon.statut === 'attente') return <SalleAttente salon={salon} membres={membres} moi={moi} quitter={sortir} />;
  if (!partieId) return <EcranAttente texte="Distribution des cartes" decor="taverne" />;
  return <EcranJeu key={partieId} partieId={partieId} membres={membres} moi={moi} hote={salon.hote} retourAccueil={sortir} />;
}
