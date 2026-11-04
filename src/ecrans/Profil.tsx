import { useEffect, useRef, useState } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import {
  BADGES, CHANGEMENTS_PSEUDO_MAX, PARTIES_AVANT_CLASSEMENT, PSEUDO_REGEX,
  chargerHistorique, envoyerPhoto, grade, niveau, pointsMoyens, precisionMises, progressionBadge, supprimerMonCompte,
  type LigneHistorique, type Profil,
} from '../lib/profil.ts';
import { Avatar } from '../composants/Avatar.tsx';

export function EcranProfil({ profil, retour, recharger }: { profil: Profil; retour: () => void; recharger: () => Promise<void> }) {
  const [pseudo, setPseudo] = useState(profil.pseudo);
  const [modePseudo, setModePseudo] = useState(false);
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  const [historique, setHistorique] = useState<LigneHistorique[] | null>(null);
  useEffect(() => { chargerHistorique(profil.id).then(setHistorique).catch(() => setHistorique([])); }, [profil.id, profil.parties_jouees]);

  const n = niveau(profil.xp);
  const xpDansNiveau = profil.xp % 100;
  const restants = CHANGEMENTS_PSEUDO_MAX - profil.changements_pseudo;
  const avantClassement = Math.max(0, PARTIES_AVANT_CLASSEMENT - profil.parties_jouees);
  const pm = pointsMoyens(profil);
  const precision = precisionMises(profil);

  async function action(fn: () => Promise<void>, succes?: string) {
    setEnCours(true);
    setErreur(null);
    setInfo(null);
    try {
      await fn();
      if (succes) setInfo(succes);
    } catch (e) {
      setErreur(messageErreur(e));
    } finally {
      setEnCours(false);
    }
  }

  const changerPhoto = (f: File) =>
    action(async () => {
      await envoyerPhoto(profil.id, f, profil.photo_url);
      await recharger();
    }, 'Photo mise à jour.');

  const validerPseudo = () =>
    action(async () => {
      const p = pseudo.trim();
      if (p === profil.pseudo) return setModePseudo(false);
      if (!PSEUDO_REGEX.test(p)) throw new Error('Pseudo : 3 à 16 caractères (lettres, chiffres, - ou _).');
      const { error } = await supabase.rpc('changer_pseudo', { nouveau: p });
      if (error) throw error;
      setModePseudo(false);
      await recharger();
    }, 'Pseudo changé.');

  const supprimer = () => action(() => supprimerMonCompte(profil.id));

  return (
    <main className="ecran ecran-profil">
      <button type="button" className="retour" onClick={retour}>‹ Retour</button>

      <section className="parchemin profil-entete">
        <button type="button" className="photo-modifiable" onClick={() => fichier.current?.click()} disabled={enCours}>
          <Avatar photo={profil.photo_url} taille={128} alt={profil.pseudo} cadre={profil.cadre} />
          <span className="photo-crayon">Changer la photo</span>
        </button>
        <input ref={fichier} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) changerPhoto(f); e.target.value = ''; }} />

        {!modePseudo ? (
          <h1 className="titre-pirate pseudo">{profil.pseudo}</h1>
        ) : (
          <div className="ligne-pseudo">
            <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} autoFocus />
            <button type="button" className="bouton-or petit" onClick={validerPseudo} disabled={enCours}>OK</button>
          </div>
        )}
        {!modePseudo && restants > 0 && (
          <button type="button" className="lien" onClick={() => { setPseudo(profil.pseudo); setModePseudo(true); }}>
            Changer de pseudo ({restants} {restants > 1 ? 'changements restants' : 'changement restant'})
          </button>
        )}
        {profil.est_admin && <p className="etiquette-admin">Capitaine du navire · Admin</p>}

        <p className="grade">Niveau {n} · {grade(n)}</p>
        <div className="barre-xp" aria-label={`${xpDansNiveau} XP sur 100`}><span style={{ width: `${xpDansNiveau}%` }} /></div>
        <p className="petit-texte">{xpDansNiveau} / 100 XP avant le niveau {n + 1}</p>

        {erreur && <p className="message erreur">{erreur}</p>}
        {info && <p className="message info">{info}</p>}
      </section>

      <section className="parchemin">
        <h2 className="titre-pirate">Statistiques</h2>
        <div className="stats">
          <Stat libelle="Parties jouées" valeur={profil.parties_jouees} />
          <Stat libelle="Victoires" valeur={profil.victoires} />
          <Stat libelle="PM" valeur={pm ?? '—'} aide="Points moyens par partie" />
          <Stat libelle="Meilleur score" valeur={profil.meilleur_score ?? '—'} />
          <Stat libelle="Mises réussies" valeur={precision === null ? '—' : `${precision} %`} />
          <Stat libelle="Louidors" valeur={profil.louidors ?? 0} />
        </div>
        {avantClassement > 0 && (
          <p className="petit-texte centre">
            Encore {avantClassement} partie{avantClassement > 1 ? 's' : ''} pour apparaître au classement.
          </p>
        )}
      </section>

      <section className="parchemin">
        <h2 className="titre-pirate">Badges</h2>
        <ul className="badges">
          {BADGES.map((b) => {
            const pr = progressionBadge(profil, b.id);
            return (
              <li key={b.id} className={`badge ${pr.obtenu ? 'obtenu' : 'verrouille'}`}>
                <span className="badge-icone">{b.icone}</span>
                <span className="badge-texte">
                  <strong>{b.nom}</strong>{pr.obtenu && <em> · obtenu !</em>}<br /><small>{b.condition}</small>
                  {!pr.obtenu && pr.objectif > 1 && (
                    <span className="badge-barre"><span style={{ width: `${(100 * pr.actuel) / pr.objectif}%` }} /><b>{pr.actuel}/{pr.objectif}</b></span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="parchemin">
        <h2 className="titre-pirate">Dernières parties</h2>
        {historique === null ? <p className="petit-texte centre">Chargement…</p>
          : historique.length === 0 ? <p className="petit-texte centre">Aucune partie comptée pour l’instant. Les parties d’entraînement ne comptent pas.</p>
          : (
            <ul className="historique">
              {historique.map((h) => (
                <li key={h.partie_id} className={h.victoire ? 'victoire' : h.abandon ? 'abandon' : ''}>
                  <span className="hist-rang">{h.victoire ? '👑' : h.abandon ? '🏳' : `${h.rang}e`}</span>
                  <span className="hist-texte">
                    <strong>{h.victoire ? 'Victoire' : h.abandon ? 'Abandon' : `${h.rang}e sur ${h.nb_joueurs}`}</strong>
                    <small>{new Date(h.joue_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {h.mises_reussies}/10 mises réussies</small>
                  </span>
                  <span className="hist-score">{h.score} pts<small>+{h.xp_gagne} XP</small></span>
                </li>
              ))}
            </ul>
          )}
      </section>

      <section className="parchemin actions-compte">
        <button type="button" className="bouton-sombre" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
        {!confirmSuppression ? (
          <button type="button" className="lien danger" onClick={() => setConfirmSuppression(true)}>Supprimer mon compte</button>
        ) : (
          <div className="confirmation">
            <p>Ton compte, ta photo et toutes tes statistiques seront effacés définitivement. Tu es sûr ?</p>
            <button type="button" className="bouton-danger" onClick={supprimer} disabled={enCours}>Oui, tout supprimer</button>
            <button type="button" className="lien" onClick={() => setConfirmSuppression(false)}>Annuler</button>
          </div>
        )}
      </section>
    </main>
  );
}

function Stat({ libelle, valeur, aide }: { libelle: string; valeur: number | string; aide?: string }) {
  return (
    <div className="stat" title={aide}>
      <span className="stat-valeur">{valeur}</span>
      <span className="stat-libelle">{libelle}</span>
    </div>
  );
}
