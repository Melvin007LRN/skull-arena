// Table de jeu PROVISOIRE (étape 3) : sert à tester le multijoueur avec de vrais joueurs.
// Le bel écran façon Uno mobile (paysage, glisser vers l'arène, animations) arrive à l'étape 5.
import { useEffect, useMemo, useRef, useState } from 'react';
import { appel, usePartie, type MembreSalon } from '../lib/jeu.ts';
import { carteParId, NOMS_PIRATES } from '../engine/cards.ts';
import { Avatar } from '../composants/Avatar.tsx';

const REVELATION_MS = 2500;
const GAGNANT_MS = 2000;

export function TableTest({ partieId, membres, moi, hote, retourAccueil }: {
  partieId: string; membres: MembreSalon[]; moi: string; hote: string; retourAccueil: () => void;
}) {
  const { vue, main } = usePartie(partieId, moi);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [tigresse, setTigresse] = useState(false);
  const [defausse, setDefausse] = useState<string[]>([]);
  const [decompte, setDecompte] = useState(0);
  const [confirmQuitter, setConfirmQuitter] = useState(false);
  const [etapePli, setEtapePli] = useState<'aucune' | 'revelation' | 'gagnant'>('aucune');
  const mancheVue = useRef(0);
  const pliVu = useRef(0);

  const pseudo = useMemo(() => {
    const m = new Map(membres.map((x) => [x.joueur_id, x]));
    return (id: string) => m.get(id)?.pseudo ?? 'Pirate';
  }, [membres]);
  const photo = (id: string) => membres.find((m) => m.joueur_id === id)?.photo_url ?? null;

  // Décompte de 3 secondes au début de chaque manche.
  useEffect(() => {
    if (!vue || vue.manche === mancheVue.current) return;
    mancheVue.current = vue.manche;
    setDecompte(3);
  }, [vue]);
  useEffect(() => {
    if (decompte <= 0) return;
    const t = setTimeout(() => setDecompte((d) => d - 1), decompte === 1 ? 900 : 1000);
    return () => clearTimeout(t);
  }, [decompte]);

  // Fin de pli : la dernière carte reste visible 2,5 s, puis la carte gagnante est mise en avant 2 s.
  // Les minuteries ne dépendent que du numéro du pli : une mise à jour de la partie pendant la pause
  // (un robot qui rejoue, par exemple) ne doit surtout pas les annuler, sinon la main resterait bloquée.
  const clePli = vue?.dernierPli ? vue.numeroPli + vue.manche * 100 : 0;
  useEffect(() => {
    if (!clePli || clePli === pliVu.current) return;
    pliVu.current = clePli;
    setEtapePli('revelation');
    const t1 = setTimeout(() => setEtapePli('gagnant'), REVELATION_MS);
    const t2 = setTimeout(() => setEtapePli('aucune'), REVELATION_MS + GAGNANT_MS);
    return () => { clearTimeout(t1); clearTimeout(t2); setEtapePli('aucune'); };
  }, [clePli]);

  useEffect(() => { setDefausse([]); }, [vue?.pouvoir?.type, vue?.numeroPli]);

  // Toutes les 20 s, on signale au serveur qu'on est là : il remplace les absents (2 min) et relance les robots.
  const finie = vue?.phase === 'fin_partie' || vue?.annulee;
  useEffect(() => {
    if (finie) return;
    const reveil = () => appel('reveiller', { partie_id: partieId }).catch(() => {});
    reveil();
    const t = setInterval(reveil, 20000);
    return () => clearInterval(t);
  }, [partieId, finie]);

  // Si un robot jouait à ma place, je signale mon retour : je reprends la main à la manche suivante.
  const suisRemplace = !!vue?.remplaces?.includes(moi) && !vue?.definitifs?.includes(moi);
  useEffect(() => {
    if (!suisRemplace) return;
    const revenir = () => document.visibilityState === 'visible' && appel('revenir', { partie_id: partieId }).catch(() => {});
    revenir();
    document.addEventListener('visibilitychange', revenir);
    return () => document.removeEventListener('visibilitychange', revenir);
  }, [suisRemplace, partieId]);

  if (!vue || !main) return <main className="ecran ecran-centre"><p className="petit-texte">Chargement de la partie…</p></main>;

  async function coup(c: Record<string, unknown>) {
    setEnCours(true);
    setErreur(null);
    try {
      await appel('jouer', { partie_id: partieId, coup: c });
    } catch (e) {
      setErreur((e as Error).message);
    } finally {
      setEnCours(false);
    }
  }

  const pliAffiche = etapePli !== 'aucune';
  const piloteParRobot = (j: string) => vue.robots?.includes(j) || vue.remplaces?.includes(j);
  const aMoi = vue.joueurActif === moi && !pliAffiche && decompte === 0 && !piloteParRobot(moi);
  const pouvoirMoi = vue.phase === 'pouvoir' && vue.pouvoir?.joueur === moi ? vue.pouvoir : null;
  const pliMontre = pliAffiche && vue.dernierPli ? vue.dernierPli.cartes : vue.pliEnCours;
  const gagnantMontre = pliAffiche && etapePli === 'gagnant' ? vue.dernierPli?.resultat : null;

  function toucherCarte(id: string) {
    if (pouvoirMoi?.type === 'bendt' && !pliAffiche) {
      setDefausse((d) => (d.includes(id) ? d.filter((x) => x !== id) : d.length < pouvoirMoi.aDefausser ? [...d, id] : d));
      return;
    }
    if (!aMoi || !main!.jouables.includes(id)) return;
    if (carteParId(id).type === 'tigresse') return setTigresse(true);
    coup({ type: 'jouer', carteId: id });
  }

  const classement = [...vue.joueurs].sort((a, b) => vue.scores[b] - vue.scores[a]);

  return (
    <main className="ecran ecran-table">
      <header className="barre-jeu">
        <span>Manche {vue.manche} / 10{vue.entrainement ? ' · entraînement' : ''}</span>
        <span>{vue.mises ? `Ma mise : ${vue.mises[moi] + (vue.harry[moi] ?? 0)}` : 'Mises secrètes'}</span>
        {!finie && <button type="button" className="lien quitter" onClick={() => setConfirmQuitter(true)}>Quitter</button>}
      </header>

      {suisRemplace && (
        <p className="message info">🤖 Un robot a joué à ta place pendant ton absence. Tu reprends la main au début de la prochaine manche.</p>
      )}
      {vue.definitifs?.includes(moi) && !finie && (
        <p className="message erreur">Un robot joue à ta place jusqu’à la fin de cette partie.</p>
      )}

      <section className="joueurs-table">
        {vue.joueurs.map((j, i) => (
          <div key={j} className={`joueur-table ${vue.joueurActif === j ? 'actif' : ''} ${j === moi ? 'moi' : ''}`}>
            {i === vue.couronne && <span className="couronne">👑</span>}
            <Avatar photo={photo(j)} taille={46} />
            <span className="jt-nom">{pseudo(j)}</span>
            {vue.remplaces?.includes(j) && <span className="jt-robot">🤖 joue pour lui</span>}
            {hote === moi && j !== moi && !vue.robots?.includes(j) && !vue.definitifs?.includes(j) && !finie && (
              <button type="button" className="exclure" aria-label={`Exclure ${pseudo(j)}`}
                onClick={() => { if (confirm(`Exclure ${pseudo(j)} ? Un robot finira la partie à sa place.`)) appel('exclure', { salon_id: membres[0]?.salon_id, joueur_id: j }).catch((e) => setErreur((e as Error).message)); }}>✕</button>
            )}
            <span className="jt-ruban">
              {vue.mises ? `${vue.plisGagnes[j]}/${vue.mises[j] + (vue.harry[j] ?? 0)}` : vue.aMise[j] ? '✓ a misé' : '…'}
            </span>
            <span className="jt-score">{vue.scores[j]} pts</span>
          </div>
        ))}
      </section>

      <section className="arene">
        {pliMontre.length === 0 && vue.phase === 'jeu' && (
          <p className="petit-texte">{vue.joueurActif === moi ? 'À toi d’ouvrir le pli !' : `${pseudo(vue.joueurActif ?? '')} ouvre le pli…`}</p>
        )}
        <div className="pli">
          {pliMontre.map((c, i) => (
            <figure key={c.carteId} className={gagnantMontre && gagnantMontre.indexGagnant === i ? 'gagnante' : ''}>
              <img src={`/cartes/${c.carteId}.webp`} alt={c.carteId} />
              <figcaption>{pseudo(c.joueur)}{c.tigresse ? ` (${c.tigresse})` : ''}</figcaption>
            </figure>
          ))}
        </div>
        {gagnantMontre && (
          <p className="annonce">
            {gagnantMontre.effet === 'kraken' ? 'Le Kraken engloutit le pli !'
              : gagnantMontre.gagnant ? `${pseudo(gagnantMontre.gagnant)} remporte le pli${gagnantMontre.bonus ? ` (+${gagnantMontre.bonus} de bonus)` : ''}`
              : 'La Baleine blanche disperse le pli !'}
          </p>
        )}
        {!pliAffiche && vue.phase === 'jeu' && vue.joueurActif !== moi && pliMontre.length > 0 && (
          <p className="petit-texte">Au tour de {pseudo(vue.joueurActif ?? '')}…</p>
        )}
        {vue.juanitaRegarde && vue.juanitaRegarde !== moi && <p className="petit-texte">Juanita ({pseudo(vue.juanitaRegarde)}) consulte les cartes non distribuées…</p>}
      </section>

      {erreur && <p className="message erreur">{erreur}</p>}

      {/* Mises */}
      {vue.phase === 'mise' && decompte === 0 && (
        <section className="parchemin fenetre">
          {vue.aMise[moi] ? (
            <p className="centre">Mise verrouillée. En attente des autres pirates…</p>
          ) : (
            <>
              <h2 className="titre-pirate">Combien de plis vas-tu gagner ?</h2>
              <div className="boutons-mise">
                {Array.from({ length: vue.cartesParJoueur + 1 }, (_, n) => (
                  <button key={n} type="button" className="bouton-or petit" disabled={enCours} onClick={() => coup({ type: 'miser', mise: n })}>{n}</button>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Pouvoirs */}
      {!pliAffiche && vue.phase === 'pouvoir' && vue.pouvoir && !pouvoirMoi && (
        <p className="centre petit-texte">{NOMS_PIRATES[vue.pouvoir.type]} ({pseudo(vue.pouvoir.joueur)}) choisit…</p>
      )}
      {!pliAffiche && pouvoirMoi?.type === 'rosie' && (
        <section className="parchemin fenetre">
          <h2 className="titre-pirate">Rosie : choisis qui commence</h2>
          <div className="boutons-mise">
            {vue.joueurs.map((j) => (
              <button key={j} type="button" className="bouton-or petit" disabled={enCours} onClick={() => coup({ type: 'rosie', choix: j })}>{j === moi ? 'Moi' : pseudo(j)}</button>
            ))}
          </div>
        </section>
      )}
      {!pliAffiche && pouvoirMoi?.type === 'rascal' && (
        <section className="parchemin fenetre">
          <h2 className="titre-pirate">Rascal : ton pari</h2>
          <p className="petit-texte centre">Gagné si ta mise est exacte, perdu sinon.</p>
          <div className="boutons-mise">
            {[0, 10, 20].map((p) => (
              <button key={p} type="button" className="bouton-or petit" disabled={enCours} onClick={() => coup({ type: 'rascal', pari: p })}>{p} pts</button>
            ))}
          </div>
        </section>
      )}
      {!pliAffiche && pouvoirMoi?.type === 'bendt' && (
        <section className="parchemin fenetre">
          <h2 className="titre-pirate">Bendt : défausse {pouvoirMoi.aDefausser} carte{pouvoirMoi.aDefausser > 1 ? 's' : ''}</h2>
          <p className="petit-texte centre">Touche les cartes de ta main à défausser ({defausse.length}/{pouvoirMoi.aDefausser}).</p>
          <button type="button" className="bouton-or" disabled={enCours || defausse.length !== pouvoirMoi.aDefausser}
            onClick={() => coup({ type: 'bendt', defausse })}>Défausser</button>
        </section>
      )}
      {!pliAffiche && vue.phase === 'harry' && vue.harryEnAttente.includes(moi) && (
        <section className="parchemin fenetre">
          <h2 className="titre-pirate">Harry : modifie ta mise</h2>
          <div className="boutons-mise">
            {[-1, 0, 1].map((a) => (
              <button key={a} type="button" className="bouton-or petit" disabled={enCours} onClick={() => coup({ type: 'harry', ajustement: a })}>
                {a > 0 ? '+1' : a < 0 ? '-1' : 'Garder'}
              </button>
            ))}
          </div>
        </section>
      )}
      {!pliAffiche && vue.phase === 'harry' && !vue.harryEnAttente.includes(moi) && <p className="centre petit-texte">Harry réfléchit…</p>}

      {/* Juanita : cartes non distribuées */}
      {main.revelationJuanita && (
        <section className="parchemin fenetre">
          <h2 className="titre-pirate">Juanita : cartes non distribuées</h2>
          <div className="mini-cartes">{main.revelationJuanita.map((c) => <img key={c} src={`/cartes/${c}.webp`} alt={c} />)}</div>
        </section>
      )}

      {/* Tigresse */}
      {tigresse && (
        <div className="voile">
          <section className="parchemin fenetre">
            <h2 className="titre-pirate">Tigresse</h2>
            <div className="boutons-mise">
              <button type="button" className="bouton-or" onClick={() => { setTigresse(false); coup({ type: 'jouer', carteId: 'tigresse', tigresse: 'pirate' }); }}>En Pirate</button>
              <button type="button" className="bouton-sombre" onClick={() => { setTigresse(false); coup({ type: 'jouer', carteId: 'tigresse', tigresse: 'fuite' }); }}>En Fuite</button>
            </div>
            <button type="button" className="lien" onClick={() => setTigresse(false)}>Annuler</button>
          </section>
        </div>
      )}

      {/* Fin de manche / de partie */}
      {!pliAffiche && !vue.annulee && (vue.phase === 'fin_manche' || vue.phase === 'fin_partie') && (
        <div className="voile">
          <section className="parchemin fenetre">
            <h2 className="titre-pirate">{vue.phase === 'fin_partie' ? 'Fin de la partie' : `Fin de la manche ${vue.manche}`}</h2>
            <table className="scores">
              <thead><tr><th>Pirate</th><th>Mise</th><th>Plis</th><th>Manche</th><th>Total</th></tr></thead>
              <tbody>
                {classement.map((j) => {
                  const r = vue.historique.at(-1)?.find((x) => x.joueur === j);
                  return (
                    <tr key={j} className={j === moi ? 'moi' : ''}>
                      <td>{pseudo(j)}</td><td>{r?.mise}</td><td>{r?.plis}</td>
                      <td className={r && r.total >= 0 ? 'positif' : 'negatif'}>{r && r.total > 0 ? '+' : ''}{r?.total}</td>
                      <td><strong>{vue.scores[j]}</strong></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {vue.phase === 'fin_manche' ? (
              vue.continuer.includes(moi) || piloteParRobot(moi)
                ? <p className="centre petit-texte">En attente des autres pirates…</p>
                : <button type="button" className="bouton-or" disabled={enCours} onClick={() => coup({ type: 'continuer' })}>Continuer</button>
            ) : (
              <>
                <p className="centre annonce">🏆 {pseudo(classement[0])} remporte la partie !</p>
                <button type="button" className="bouton-or" onClick={retourAccueil}>Retour au port</button>
              </>
            )}
          </section>
        </div>
      )}

      {confirmQuitter && (
        <div className="voile">
          <section className="parchemin fenetre">
            <h2 className="titre-pirate">Quitter la partie ?</h2>
            <p className="centre">{vue.entrainement ? 'Ta partie d’entraînement sera abandonnée.' : 'Quitter = défaite. Un robot finira la partie à ta place. Tu es sûr ?'}</p>
            <button type="button" className="bouton-danger" disabled={enCours}
              onClick={async () => { try { await appel('abandonner', { partie_id: partieId }); } catch { /* déjà finie */ } retourAccueil(); }}>
              Oui, je quitte
            </button>
            <button type="button" className="lien" onClick={() => setConfirmQuitter(false)}>Non, je reste</button>
          </section>
        </div>
      )}

      {vue.annulee && (
        <div className="voile">
          <section className="parchemin fenetre">
            <h2 className="titre-pirate">Partie annulée</h2>
            <p className="centre">Plus aucun pirate humain à bord : cette partie ne compte pas.</p>
            <button type="button" className="bouton-or" onClick={retourAccueil}>Retour au port</button>
          </section>
        </div>
      )}

      {/* Décompte */}
      {decompte > 0 && vue.phase === 'mise' && (
        <div className="voile decompte"><span key={decompte}>{decompte}</span></div>
      )}

      {/* Ma main */}
      <section className="main-joueur">
        {main.main.map((id) => {
          const jouable = aMoi && main.jouables.includes(id);
          const choisie = defausse.includes(id);
          return (
            <button key={id} type="button" className={`carte-main ${jouable ? 'jouable' : ''} ${aMoi && !jouable ? 'interdite' : ''} ${choisie ? 'choisie' : ''}`}
              onClick={() => toucherCarte(id)} disabled={enCours}>
              <img src={`/cartes/${id}.webp`} alt={id} draggable={false} />
            </button>
          );
        })}
      </section>
      <p className="petit-texte centre">Version de test du multijoueur · le bel écran de jeu arrive à l’étape 5</p>
    </main>
  );
}
