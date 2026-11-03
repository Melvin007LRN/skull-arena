// Salle d'attente : les joueurs s'installent autour de la table, se déclarent prêts, l'hôte lance.
import { useState } from 'react';
import { appel, partagerInvitation, type MembreSalon, type Salon } from '../lib/jeu.ts';
import { Avatar } from '../composants/Avatar.tsx';

export function SalleAttente({ salon, membres, moi, quitter }: {
  salon: Salon; membres: MembreSalon[]; moi: string; quitter: () => void;
}) {
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const suisHote = salon.hote === moi;
  const moiMembre = membres.find((m) => m.joueur_id === moi);
  const tousPrets = membres.length >= 2 && membres.every((m) => m.joueur_id === salon.hote || m.pret);

  async function faire(fn: () => Promise<unknown>) {
    setEnCours(true);
    setErreur(null);
    try {
      await fn();
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const partager = async () => {
    const r = await partagerInvitation(salon.code);
    if (r === 'copie') {
      setInfo('Lien copié, colle-le à tes amis !');
      setTimeout(() => setInfo(null), 2500);
    }
  };

  return (
    <main className="ecran ecran-attente">
      <button type="button" className="retour" onClick={() => faire(async () => { await appel('quitter', { salon_id: salon.id }); quitter(); })}>
        ‹ Quitter le salon
      </button>

      <section className="parchemin code-salon">
        <p className="sous-titre">{salon.public ? 'Salon public' : 'Salon privé'} · code</p>
        <p className="code">{salon.code}</p>
        <button type="button" className="bouton-sombre" onClick={partager}>Partager le lien</button>
        {info && <p className="message info">{info}</p>}
      </section>

      <section className="table-attente" aria-label="Joueurs autour de la table">
        <div className="table-ronde" />
        {Array.from({ length: 8 }, (_, i) => {
          const m = membres[i];
          const angle = (i / 8) * 2 * Math.PI - Math.PI / 2;
          const style = { left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 41 * Math.sin(angle)}%` };
          if (!m) return <div key={i} className="siege vide" style={style}><span>+</span></div>;
          return (
            <div key={m.joueur_id} className={`siege ${m.pret || m.joueur_id === salon.hote ? 'pret' : ''}`} style={style}>
              <Avatar photo={m.photo_url} taille={58} alt={m.pseudo} />
              <span className="siege-nom">{m.joueur_id === salon.hote && '👑 '}{m.pseudo}</span>
              {suisHote && m.joueur_id !== moi && (
                <button type="button" className="exclure" onClick={() => faire(() => appel('exclure', { salon_id: salon.id, joueur_id: m.joueur_id }))}
                  aria-label={`Exclure ${m.pseudo}`}>✕</button>
              )}
            </div>
          );
        })}
        <div className="table-centre">
          <strong>{membres.length} / 8</strong>
          <small>pirates à bord</small>
        </div>
      </section>

      {erreur && <p className="message erreur">{erreur}</p>}

      {suisHote ? (
        <button type="button" className="bouton-or bouton-jouer" disabled={enCours || !tousPrets}
          onClick={() => faire(() => appel('lancer', { salon_id: salon.id }))}>
          {membres.length < 2 ? 'En attente de pirates…' : tousPrets ? 'Lever l’ancre !' : 'En attente des retardataires…'}
        </button>
      ) : (
        <button type="button" className={moiMembre?.pret ? 'bouton-sombre' : 'bouton-or bouton-jouer'} disabled={enCours}
          onClick={() => faire(() => appel('pret', { salon_id: salon.id, pret: !moiMembre?.pret }))}>
          {moiMembre?.pret ? 'Prêt ✓ (toucher pour annuler)' : 'Je suis prêt !'}
        </button>
      )}
      <p className="petit-texte centre">
        {suisHote ? 'Tu es le capitaine : lance la partie quand tout l’équipage est prêt.' : 'Le capitaine lancera la partie quand tout le monde sera prêt.'}
      </p>
    </main>
  );
}
