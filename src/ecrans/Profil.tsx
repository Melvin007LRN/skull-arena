// Mon pirate : portrait encadré, grade et niveau, chiffres clés, puis onglets
// Profil · Cadres · Badges · Stats · Historique. La gestion du compte est en bas de l'onglet Profil.
import { IMAGE_GRADE } from '../lib/images.ts';
import { Visuel } from '../composants/Visuel.tsx';
import { Patience } from '../composants/Attente.tsx';
import { styleNeon } from '../lib/neons.ts';
import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import {
  BADGES, CHANGEMENTS_PSEUDO_MAX, PARTIES_AVANT_CLASSEMENT, PSEUDO_REGEX,
  chargerHistorique, envoyerPhoto, grade, niveau, pointsMoyens, precisionMises, progressionBadge, supprimerMonCompte,
  type LigneHistorique, type Profil,
} from '../lib/profil.ts';
import { CADRES_GAGNES, chargerBoutique, chargerCadresPossedes, equiperCadre, type Article } from '../lib/boutique.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { Louidors } from './Boutique.tsx';
import { Icone } from '../composants/Icone.tsx';
import { Titre } from '../composants/Perso.tsx';
import { chargerPaliers, gainPalier, PALIER, reclamerPalier } from '../lib/perso.ts';

type Onglet = 'profil' | 'cadres' | 'badges' | 'stats' | 'historique';
const ONGLETS: Array<{ id: Onglet; icone: string; nom: string }> = [
  { id: 'profil', icone: 'tete', nom: 'Profil' },
  { id: 'cadres', icone: 'cadre', nom: 'Cadres' },
  { id: 'badges', icone: 'bouclier', nom: 'Badges' },
  { id: 'stats', icone: 'stats', nom: 'Stats' },
  { id: 'historique', icone: 'sablier', nom: 'Historique' },
];

/** Emblème de chaque grade. */
const EMBLEMES: Record<string, string> = { Mousse: '⚓', Matelot: '🪢', 'Quartier-maître': '🧭', Capitaine: '🏴‍☠️', Amiral: '⚔️', Légende: '👑' };

export function EcranProfil({ profil, retour, recharger, ouvrirBoutique }: {
  profil: Profil; retour: () => void; recharger: () => Promise<void>; ouvrirBoutique?: () => void;
}) {
  const [onglet, setOnglet] = useState<Onglet>('profil');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [historique, setHistorique] = useState<LigneHistorique[] | null>(null);
  const fichier = useRef<HTMLInputElement>(null);
  useEffect(() => { chargerHistorique(profil.id, 20).then(setHistorique).catch(() => setHistorique([])); }, [profil.id, profil.parties_jouees]);

  const n = niveau(profil.xp);
  const g = grade(n);
  const xpDansNiveau = profil.xp % 100;
  const tauxVictoire = profil.parties_jouees > 0 ? Math.round((100 * profil.victoires) / profil.parties_jouees) : null;
  const precision = precisionMises(profil);
  const badgesObtenus = BADGES.filter((b) => progressionBadge(profil, b.id).obtenu).length;

  async function action(fn: () => Promise<unknown>, succes?: string) {
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

  const changerPhoto = (f: File) => action(async () => { await envoyerPhoto(profil.id, f, profil.photo_url); await recharger(); }, 'Photo mise à jour.');

  return (
    <main className="ecran ecran-profil profil2">
      <div className="profil-barre">
        <button type="button" className="retour" onClick={retour}>‹ Retour</button>
        <span className="titre-pirate">Mon pirate</span>
        <span />
      </div>

      {/* Carte d'identité */}
      <section className={`profil-heros neon ${profil.perso?.banniere ? `banniere-perso ${profil.perso.banniere}` : ''}`}>
        <button type="button" className="heros-portrait" onClick={() => fichier.current?.click()} disabled={enCours} aria-label="Changer la photo">
          <span className="heros-aura" aria-hidden="true" />
          <Avatar photo={profil.photo_url} taille={124} alt={profil.pseudo} cadre={profil.cadre} compagnon={profil.perso?.compagnon} />
          <span className="heros-photo">📷</span>
        </button>
        <input ref={fichier} type="file" accept="image/*" hidden
          onChange={(e) => { const f = e.target.files?.[0]; if (f) changerPhoto(f); e.target.value = ''; }} />
        {(() => { const n = styleNeon(profil.couleur_nom); return <h1 className={`heros-pseudo ${profil.couleur_nom ? n.className : ''}`} style={n.style}>{profil.pseudo}</h1>; })()}
        <Titre perso={profil.perso} className="heros-titre" />
        <div className="heros-grade">
          <span className="heros-embleme">{IMAGE_GRADE[g] ? <img className="embleme-img" src={IMAGE_GRADE[g]} alt="" /> : EMBLEMES[g]}</span>
          <span>{g}</span>
          {profil.est_admin && <em>⚓ Capitaine du navire</em>}
        </div>
        <div className="heros-niveau">
          <span className="hexa">{n}</span>
          <div className="heros-xp">
            <div className="heros-xp-ligne"><strong>Niveau {n}</strong><small>{xpDansNiveau} / 100 XP</small></div>
            <div className="barre-xp"><span style={{ width: `${xpDansNiveau}%` }} /></div>
          </div>
        </div>
        <button type="button" className="heros-louidors" onClick={ouvrirBoutique} disabled={!ouvrirBoutique}>
          <Louidors montant={profil.louidors ?? 0} />
        </button>
      </section>

      {/* Chiffres clés */}
      <div className="chiffres-cles">
        <Chiffre icone="trophee" valeur={profil.victoires} libelle="Victoires" />
        <Chiffre icone="epees" valeur={profil.parties_jouees} libelle="Parties" />
        <Chiffre icone="cible" valeur={tauxVictoire === null ? '—' : `${tauxVictoire} %`} libelle="Taux de victoire" />
        <Chiffre icone="feu" valeur={profil.meilleur_score ?? '—'} libelle="Record" />
      </div>

      {erreur && <p className="message erreur">{erreur}</p>}
      {info && <p className="message info">{info}</p>}

      {/* Onglets */}
      <nav className="profil-onglets" aria-label="Sections du profil">
        {ONGLETS.map((o) => (
          <button key={o.id} type="button" className={onglet === o.id ? 'actif' : ''} onClick={() => setOnglet(o.id)}>
            <Icone nom={o.icone} taille={22} /><small>{o.nom}</small>
          </button>
        ))}
      </nav>

      {onglet === 'profil' && (
        <>
          <CoffresNiveau profil={profil} recharger={recharger} />
          {ouvrirBoutique && (
            <button type="button" className="bouton-sombre bouton-tenue" onClick={ouvrirBoutique}><img className="icone-img" src="/img/nav_profil.webp" width={26} height={26} alt="" /> Personnaliser mon pirate</button>
          )}
          <section className="parchemin neon profil-bloc">
            <div className="bloc-titre"><h2 className="titre-pirate">Mes badges</h2><button type="button" className="lien" onClick={() => setOnglet('badges')}>{badgesObtenus}/{BADGES.length} · tout voir ›</button></div>
            <div className="medailles">
              {BADGES.map((b) => {
                const pr = progressionBadge(profil, b.id);
                return (
                  <button key={b.id} type="button" className={`medaille ${pr.obtenu ? 'obtenue' : ''}`} onClick={() => setOnglet('badges')} title={b.nom}>
                    <Visuel v={b.icone} />
                    {!pr.obtenu && pr.objectif > 1 && <i style={{ ['--p' as string]: `${(100 * pr.actuel) / pr.objectif}%` }} />}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="parchemin neon profil-bloc">
            <div className="bloc-titre"><h2 className="titre-pirate">Dernières parties</h2><button type="button" className="lien" onClick={() => setOnglet('historique')}>tout voir ›</button></div>
            <Historique lignes={historique?.slice(0, 3) ?? null} />
          </section>
          <Compte profil={profil} enCours={enCours} action={action} recharger={recharger} />
        </>
      )}

      {onglet === 'cadres' && <Cadres profil={profil} enCours={enCours} action={action} recharger={recharger} ouvrirBoutique={ouvrirBoutique} />}

      {onglet === 'badges' && (
        <section className="parchemin neon profil-bloc">
          <ul className="badges">
            {BADGES.map((b) => {
              const pr = progressionBadge(profil, b.id);
              return (
                <li key={b.id} className={`badge ${pr.obtenu ? 'obtenu' : 'verrouille'}`}>
                  <span className="badge-icone"><Visuel v={b.icone} /></span>
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
          <p className="petit-texte centre">Chaque badge débloque aussi un cadre (onglet Cadres).</p>
        </section>
      )}

      {onglet === 'stats' && <Statistiques profil={profil} historique={historique} precision={precision} />}

      {onglet === 'historique' && (
        <section className="parchemin neon profil-bloc">
          <Historique lignes={historique} />
          <p className="petit-texte centre">Les 20 dernières parties comptées. L’entraînement ne compte pas.</p>
        </section>
      )}
    </main>
  );
}

function Chiffre({ icone, valeur, libelle }: { icone: string; valeur: number | string; libelle: string }) {
  return (
    <div className="chiffre neon">
      <Icone nom={icone} taille={22} className="chiffre-icone" />
      <strong>{valeur}</strong>
      <small>{libelle}</small>
    </div>
  );
}

function Historique({ lignes }: { lignes: LigneHistorique[] | null }) {
  if (lignes === null) return <Patience />;
  if (lignes.length === 0) return <p className="petit-texte centre">Aucune partie comptée pour l’instant. Les parties d’entraînement ne comptent pas.</p>;
  return (
    <ul className="historique">
      {lignes.map((h) => (
        <li key={h.partie_id} className={h.victoire ? 'victoire' : h.abandon ? 'abandon' : ''}>
          <span className="hist-rang">{h.victoire ? '👑' : h.abandon ? '🏳' : `${h.rang}e`}</span>
          <span className="hist-texte">
            <strong>{h.victoire ? 'Victoire' : h.abandon ? 'Abandon' : `${h.rang}e sur ${h.nb_joueurs}`}</strong>
            <small>{new Date(h.joue_le).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} · {h.nb_joueurs} pirates · {h.mises_reussies}/10 mises</small>
          </span>
          <span className="hist-score">{h.score} pts<small>+{h.xp_gagne} XP</small></span>
        </li>
      ))}
    </ul>
  );
}

function Statistiques({ profil, historique, precision }: { profil: Profil; historique: LigneHistorique[] | null; precision: number | null }) {
  const pm = pointsMoyens(profil);
  const avantClassement = Math.max(0, PARTIES_AVANT_CLASSEMENT - profil.parties_jouees);
  const recentes = useMemo(() => [...(historique ?? [])].reverse(), [historique]);
  const max = Math.max(100, ...recentes.map((h) => h.score));
  const min = Math.min(0, ...recentes.map((h) => h.score));
  const podiums = (historique ?? []).filter((h) => !h.abandon && h.rang <= 3).length;
  return (
    <>
      <section className="parchemin neon profil-bloc">
        <h2 className="titre-pirate">Forme du moment</h2>
        {recentes.length === 0 ? <p className="petit-texte centre">Joue quelques parties pour voir ta courbe.</p> : (
          <div className="courbe" role="img" aria-label="Scores des dernières parties">
            {recentes.map((h, i) => {
              const etendue = max - min;
              const zero = (100 * -min) / etendue;
              const haut = (100 * Math.max(Math.abs(h.score), 2)) / etendue;
              return (
                <span key={h.partie_id} className={`barre ${h.victoire ? 'victoire' : ''} ${h.score < 0 ? 'negatif' : ''}`}
                  style={{ left: `${(100 * (i + 0.15)) / recentes.length}%`, width: `${70 / recentes.length}%`, height: `${haut}%`, bottom: `${h.score < 0 ? zero - haut : zero}%` }}
                  title={`${h.score} pts`} />
              );
            })}
            <span className="ligne-zero" style={{ bottom: `${(100 * -min) / (max - min)}%` }} />
          </div>
        )}
        <p className="petit-texte centre">Tes {recentes.length} dernières parties · 👑 en or = victoire</p>
      </section>
      <section className="parchemin neon profil-bloc">
        <h2 className="titre-pirate">En détail</h2>
        <div className="stats">
          <Stat libelle="Points moyens (PM)" valeur={pm ?? '—'} />
          <Stat libelle="Meilleur score" valeur={profil.meilleur_score ?? '—'} />
          <Stat libelle="Mises réussies" valeur={precision === null ? '—' : `${precision} %`} />
          <Stat libelle="Podiums récents" valeur={historique ? `${podiums}/${historique.length}` : '—'} />
          <Stat libelle="Régicides" valeur={profil.regicides ?? 0} />
          <Stat libelle="Mises de 0 en manche 10" valeur={profil.fantomes ?? 0} />
          <Stat libelle="Points au total" valeur={profil.points_total ?? 0} />
          <Stat libelle="XP au total" valeur={profil.xp} />
        </div>
        {precision !== null && (
          <div className="jauge">
            <span>Précision des mises</span>
            <div className="barre-xp"><span style={{ width: `${precision}%` }} /></div>
            <small>{profil.mises_reussies} réussies sur {profil.mises_total}</small>
          </div>
        )}
        {avantClassement > 0 && (
          <p className="petit-texte centre">Encore {avantClassement} partie{avantClassement > 1 ? 's' : ''} pour apparaître au classement.</p>
        )}
      </section>
    </>
  );
}

function Stat({ libelle, valeur }: { libelle: string; valeur: number | string }) {
  return (
    <div className="stat">
      <span className="stat-valeur">{valeur}</span>
      <span className="stat-libelle">{libelle}</span>
    </div>
  );
}

type Action = (fn: () => Promise<unknown>, succes?: string) => Promise<void>;

/** Tous mes cadres (gagnés ou achetés), à équiper d'un toucher. */
function Cadres({ profil, enCours, action, recharger, ouvrirBoutique }: {
  profil: Profil; enCours: boolean; action: Action; recharger: () => Promise<void>; ouvrirBoutique?: () => void;
}) {
  const [achetables, setAchetables] = useState<Article[]>([]);
  const [possedes, setPossedes] = useState<string[]>([]);
  useEffect(() => {
    Promise.all([chargerBoutique(), chargerCadresPossedes()])
      .then(([a, p]) => { setAchetables(a.filter((x) => x.type === 'cadre' && !x.id.startsWith('neon_'))); setPossedes(p); })
      .catch(() => {});
  }, []);
  const actuel = profil.cadre || 'or';
  const liste = [
    ...CADRES_GAGNES.map((c) => ({ id: c.id, nom: c.nom, ok: profil.est_admin || c.obtenu(profil), aide: c.condition })),
    ...achetables.map((c) => ({ id: c.id, nom: c.nom, ok: possedes.includes(c.id), aide: `${c.prix} Louidors à la boutique` })),
  ];
  const debloques = liste.filter((c) => c.ok);
  const verrouilles = liste.filter((c) => !c.ok);
  const equiper = (id: string, nom: string) => action(async () => { await equiperCadre(id); await recharger(); }, `${nom} équipé !`);
  return (
    <>
      <section className="parchemin neon profil-bloc">
        <h2 className="titre-pirate">Mes cadres · {debloques.length}</h2>
        <ul className="grille-cadres compacte">
          {debloques.map((c) => (
            <li key={c.id} className={actuel === c.id ? 'equipe' : ''}>
              <button type="button" className="cadre-choix" disabled={enCours || actuel === c.id} onClick={() => equiper(c.id, c.nom)}>
                <Avatar photo={profil.photo_url} taille={72} cadre={c.id} />
                <strong>{c.nom}</strong>
                <small>{actuel === c.id ? '✓ Équipé' : 'Toucher pour équiper'}</small>
              </button>
            </li>
          ))}
        </ul>
      </section>
      {verrouilles.length > 0 && (
        <section className="parchemin neon profil-bloc">
          <div className="bloc-titre"><h2 className="titre-pirate">À débloquer</h2>{ouvrirBoutique && <button type="button" className="lien" onClick={ouvrirBoutique}>Boutique ›</button>}</div>
          <ul className="grille-cadres compacte">
            {verrouilles.map((c) => (
              <li key={c.id} className="verrouille">
                <Avatar photo={profil.photo_url} taille={72} cadre={c.id} />
                <strong>{c.nom}</strong>
                <small>🔒 {c.aide}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Pseudo, déconnexion et suppression du compte. */
function Compte({ profil, enCours, action, recharger }: { profil: Profil; enCours: boolean; action: Action; recharger: () => Promise<void> }) {
  const [pseudo, setPseudo] = useState(profil.pseudo);
  const [modePseudo, setModePseudo] = useState(false);
  const [confirmSuppression, setConfirmSuppression] = useState(false);
  const restants = CHANGEMENTS_PSEUDO_MAX - profil.changements_pseudo;
  const validerPseudo = () => action(async () => {
    const p = pseudo.trim();
    if (p === profil.pseudo) return setModePseudo(false);
    if (!PSEUDO_REGEX.test(p)) throw new Error('Pseudo : 3 à 16 caractères (lettres, chiffres, - ou _).');
    const { error } = await supabase.rpc('changer_pseudo', { nouveau: p });
    if (error) throw error;
    setModePseudo(false);
    await recharger();
  }, 'Pseudo changé.');
  return (
    <section className="parchemin neon profil-bloc compte">
      <h2 className="titre-pirate">Mon compte</h2>
      <div className="ligne-compte">
        <span><small>Pseudo</small><strong>{profil.pseudo}</strong></span>
        {restants > 0 && !modePseudo && (
          <button type="button" className="bouton-sombre petit" onClick={() => { setPseudo(profil.pseudo); setModePseudo(true); }}>✏️ Modifier</button>
        )}
      </div>
      {modePseudo && (
        <div className="ligne-pseudo">
          <input value={pseudo} onChange={(e) => setPseudo(e.target.value)} maxLength={16} autoFocus />
          <button type="button" className="bouton-or petit" onClick={validerPseudo} disabled={enCours}>OK</button>
          <button type="button" className="lien" onClick={() => setModePseudo(false)}>Annuler</button>
        </div>
      )}
      <p className="petit-texte">{restants > 0 ? `${restants} changement${restants > 1 ? 's' : ''} de pseudo restant${restants > 1 ? 's' : ''}.` : 'Tu as utilisé tes 3 changements de pseudo.'}</p>
      <button type="button" className="bouton-sombre c-rouge" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      {!confirmSuppression ? (
        <button type="button" className="lien danger" onClick={() => setConfirmSuppression(true)}>Supprimer mon compte</button>
      ) : (
        <div className="confirmation">
          <p>Ton compte, ta photo et toutes tes statistiques seront effacés définitivement. Tu es sûr ?</p>
          <button type="button" className="bouton-danger" onClick={() => action(() => supprimerMonCompte(profil.id))} disabled={enCours}>Oui, tout supprimer</button>
          <button type="button" className="lien" onClick={() => setConfirmSuppression(false)}>Annuler</button>
        </div>
      )}
    </section>
  );
}

/** Coffres de niveau : un coffre de Louidors tous les 5 niveaux. */
function CoffresNiveau({ profil, recharger }: { profil: Profil; recharger: () => Promise<void> }) {
  const [ouverts, setOuverts] = useState<number[] | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; texte: string } | null>(null);
  const [enCours, setEnCours] = useState(false);
  useEffect(() => { chargerPaliers().then(setOuverts).catch(() => setOuverts([])); }, []);
  const n = niveau(profil.xp);
  const prochain = (Math.floor(n / PALIER) + 1) * PALIER;
  const paliers = Array.from({ length: Math.floor(n / PALIER) }, (_, i) => (i + 1) * PALIER);
  const aOuvrir = paliers.filter((p) => !ouverts?.includes(p));
  async function ouvrir(p: number) {
    setEnCours(true); setMessage(null);
    try { await reclamerPalier(p); setOuverts((o) => [...(o ?? []), p]); await recharger(); setMessage({ ok: true, texte: `Coffre du niveau ${p} ouvert : +${gainPalier(p)} Louidors !` }); }
    catch (e) { setMessage({ ok: false, texte: messageErreur(e) }); }
    finally { setEnCours(false); }
  }
  return (
    <section className="parchemin neon profil-bloc coffres-niveau">
      <div className="bloc-titre"><h2 className="titre-pirate">Coffres de niveau</h2></div>
      {message && <p className={`message ${message.ok ? 'info' : 'erreur'}`}>{message.texte}</p>}
      {ouverts === null ? <Patience /> : (
        <div className="coffres">
          {aOuvrir.map((p) => (
            <button key={p} type="button" className="coffre-niveau pret" disabled={enCours} onClick={() => ouvrir(p)}>
              <img className="coffre-img" src="/img/coffre_niveau.webp" alt="" /><strong>Niv. {p}</strong><small>Ouvrir · +{gainPalier(p)}</small>
            </button>
          ))}
          <div className="coffre-niveau">
            <img className="coffre-img verrou" src="/img/coffre_niveau.webp" alt="" /><img className="coffre-cadenas" src="/img/etat_verrou.webp" alt="" /><strong>Niv. {prochain}</strong><small>+{gainPalier(prochain)} Louidors</small>
          </div>
        </div>
      )}
      <p className="petit-texte">Un coffre de Louidors tous les {PALIER} niveaux. Encore {prochain - n} niveau{prochain - n > 1 ? 'x' : ''} avant le prochain.</p>
    </section>
  );
}
