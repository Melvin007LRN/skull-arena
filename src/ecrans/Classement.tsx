// Classements : la saison (mois en cours, remise à zéro chaque mois) et le classement permanent.
import { useEffect, useState } from 'react';
import {
  chargerClassement, chargerClassementSaison, grade, niveau, nomSaison, PARTIES_AVANT_CLASSEMENT, type Profil,
} from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { useSocial } from '../lib/social.ts';

interface Ligne { id: string; pseudo: string; photo_url: string | null; cadre: string | null; xp: number; parties: number; victoires: number; pm: number }

export function EcranClassement({ profil, retour }: { profil: Profil; retour: () => void }) {
  const [onglet, setOnglet] = useState<'saison' | 'permanent'>('saison');
  const { ouvrirProfil } = useSocial();
  const [listes, setListes] = useState<{ saison: Ligne[] | null; permanent: Ligne[] | null }>({ saison: null, permanent: null });
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    chargerClassementSaison().then((l) => setListes((x) => ({ ...x, saison: l }))).catch(() => setErreur('Le classement n’a pas pu être chargé.'));
    chargerClassement().then((l) => setListes((x) => ({
      ...x, permanent: l.map((p) => ({ ...p, parties: p.parties_jouees })),
    }))).catch(() => setErreur('Le classement n’a pas pu être chargé.'));
  }, []);

  const liste = listes[onglet];
  const maPlace = liste ? liste.findIndex((l) => l.id === profil.id) : -1;
  const restantes = Math.max(0, PARTIES_AVANT_CLASSEMENT - profil.parties_jouees);

  return (
    <main className="ecran ecran-classement">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">Classement</h1>
      <div className="onglets">
        <button type="button" className={onglet === 'saison' ? 'actif' : ''} onClick={() => setOnglet('saison')}>Saison</button>
        <button type="button" className={onglet === 'permanent' ? 'actif' : ''} onClick={() => setOnglet('permanent')}>Général</button>
      </div>
      <p className="petit-texte centre">
        {onglet === 'saison'
          ? `Saison de ${nomSaison()} · classement au nombre de victoires ce mois-ci. Tout repart à zéro le 1er du mois !`
          : 'Classement général au nombre de victoires depuis toujours.'}
      </p>

      {onglet === 'permanent' && restantes > 0 && (
        <p className="message info">Encore {restantes} partie{restantes > 1 ? 's' : ''} et tu entres au classement !</p>
      )}
      {maPlace >= 0 && <p className="message info">Tu es {maPlace === 0 ? '1er' : `${maPlace + 1}e`} sur {liste!.length}.</p>}
      {erreur && <p className="message erreur">{erreur}</p>}

      <section className="parchemin">
        {liste === null && !erreur && <p className="petit-texte centre">Chargement…</p>}
        {liste?.length === 0 && (
          <p className="petit-texte centre">
            {onglet === 'saison' ? 'Personne n’a encore gagné ce mois-ci. Remporte une partie et prends la tête !' : 'Personne n’est encore classé. Joue ta première partie !'}
          </p>
        )}
        {liste && liste.length > 0 && (
          <ol className="classement">
            {liste.map((l, i) => {
              const n = niveau(l.xp);
              return (
                <li key={l.id} className={`${l.id === profil.id ? 'moi' : ''} ${i < 3 ? `top top-${i + 1}` : ''} cliquable`} onClick={() => ouvrirProfil(l.id)}>
                  <span className="cl-rang">{i === 0 ? '👑' : i + 1}</span>
                  <Avatar photo={l.photo_url} taille={i === 0 ? 56 : 44} cadre={l.cadre} />
                  <span className="cl-nom">
                    <strong>{l.pseudo}</strong>
                    <small>Niv. {n} · {grade(n)} · {l.pm} PM · {l.parties} partie{l.parties > 1 ? 's' : ''}</small>
                  </span>
                  <span className="cl-pm">{l.victoires}<small>VICT.</small></span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
