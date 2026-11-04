// Classement permanent : les pirates ayant joué au moins 5 parties, triés par points moyens (PM).
import { useEffect, useState } from 'react';
import { chargerClassement, grade, niveau, PARTIES_AVANT_CLASSEMENT, type LigneClassement, type Profil } from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';

export function EcranClassement({ profil, retour }: { profil: Profil; retour: () => void }) {
  const [liste, setListe] = useState<LigneClassement[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  useEffect(() => {
    chargerClassement().then(setListe).catch(() => setErreur('Le classement n’a pas pu être chargé. Réessaie.'));
  }, []);

  const maPlace = liste ? liste.findIndex((l) => l.id === profil.id) : -1;
  const restantes = Math.max(0, PARTIES_AVANT_CLASSEMENT - profil.parties_jouees);

  return (
    <main className="ecran ecran-classement">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>
      <h1 className="titre-pirate grand">Classement</h1>
      <p className="petit-texte centre">Points moyens par partie (PM), à partir de {PARTIES_AVANT_CLASSEMENT} parties jouées.</p>

      {restantes > 0 && (
        <p className="message info">Encore {restantes} partie{restantes > 1 ? 's' : ''} et tu entres au classement !</p>
      )}
      {maPlace >= 0 && <p className="message info">Tu es {maPlace === 0 ? '1er' : `${maPlace + 1}e`} sur {liste!.length}.</p>}
      {erreur && <p className="message erreur">{erreur}</p>}

      <section className="parchemin">
        {liste === null && !erreur && <p className="petit-texte centre">Chargement…</p>}
        {liste?.length === 0 && <p className="petit-texte centre">Personne n’est encore classé. Sois le premier à jouer {PARTIES_AVANT_CLASSEMENT} parties !</p>}
        {liste && liste.length > 0 && (
          <ol className="classement">
            {liste.map((l, i) => {
              const n = niveau(l.xp);
              return (
                <li key={l.id} className={`${l.id === profil.id ? 'moi' : ''} ${i < 3 ? `top top-${i + 1}` : ''}`}>
                  <span className="cl-rang">{i === 0 ? '👑' : i + 1}</span>
                  <Avatar photo={l.photo_url} taille={i === 0 ? 56 : 44} />
                  <span className="cl-nom">
                    <strong>{l.pseudo}</strong>
                    <small>Niv. {n} · {grade(n)} · {l.victoires} victoire{l.victoires > 1 ? 's' : ''} / {l.parties_jouees}</small>
                  </span>
                  <span className="cl-pm">{l.pm}<small>PM</small></span>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </main>
  );
}
