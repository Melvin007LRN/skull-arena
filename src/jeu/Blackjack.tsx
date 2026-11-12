// Le Blackjack du Capitaine : une table ovale en paysage, comme les parties classiques, face au croupier.
// 5 sièges, distribution carte par carte, paris annexes (Paires parfaites, 21+3, Assurance),
// séparation et double, animations de victoire et chat transparent sur le côté.
import { BJ } from '../lib/images.ts';
import { EcranAttente } from '../composants/Attente.tsx';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Profil } from '../lib/profil.ts';
import { niveau as niveauDe } from '../lib/profil.ts';
import { appelBJ, JETONS, useTableBJ, type TableBJ } from '../lib/blackjack.ts';
import {
  couleurDe, DELAI_CARTE_CROUPIER, DELAI_CARTE_DONNE, dureeDonne, estBlackjack, miseMax, MISE_MIN_BJ, peutDoubler, peutSeparer, rangDe, valeurMain,
  type EtatBJ, type MainBJ, type SiegeBJ,
} from '../engine/blackjack.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { debloquerSon, son } from '../lib/sons.ts';
import { supabase } from '../lib/supabase.ts';
import { useBloques } from '../lib/social.ts';
import './jeu.css';
import './blackjack.css';

const SYMBOLES: Record<string, string> = { pique: '♠', coeur: '♥', carreau: '♦', trefle: '♣' };
/** Places autour de la table (en % de l'écran paysage), en arc symétrique : on se voit toujours au milieu, face au croupier. */
const SIEGES = [{ x: 13, y: 48 }, { x: 31, y: 52 }, { x: 50, y: 54 }, { x: 69, y: 52 }, { x: 87, y: 48 }];
const SABOT = { x: 66, y: 38 };
const CROUPIER = { x: 50, y: 40 };

export function EcranBlackjack({ profil, mode, retour, recharger }: {
  profil: Profil; mode: 'public' | 'solo' | 'amis'; retour: () => void; recharger: () => Promise<void>;
}) {
  const [table, setTable] = useState<TableBJ | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [enCours, setEnCours] = useState(false);

  const entrer = useCallback(async (m: string, c?: string) => {
    setEnCours(true); setErreur(null);
    try { setTable(await appelBJ<TableBJ>('rejoindre', { mode: m, code: c })); }
    catch (e) { setErreur((e as Error).message); }
    finally { setEnCours(false); }
  }, []);

  useEffect(() => { if (mode !== 'amis') entrer(mode); }, [mode, entrer]);

  if (!table && mode !== 'amis' && !erreur) return <EcranAttente texte="On t’installe à la table" decor="taverne" sous="Blackjack du Capitaine" />;
  if (!table) {
    return (
      <main className="ecran ecran-bj-entree">
        <button type="button" className="retour" onClick={retour}>‹ Retour</button>
        <img className="bj-entree-logo" src="/img/nav_blackjack.webp" alt="" />
        <h1 className="titre-pirate grand">Blackjack</h1>
        {mode === 'amis' ? (
          <section className="parchemin bj-entree">
            <p className="petit-texte centre">Crée une table privée et donne le code à tes compagnons, ou rejoins la leur.</p>
            <button type="button" className="bouton-or" disabled={enCours} onClick={() => entrer('privee')}>Créer une table privée</button>
            <div className="bj-code">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="CODE" maxLength={6} aria-label="Code de la table" />
              <button type="button" className="bouton-sombre" disabled={enCours || code.length !== 6} onClick={() => entrer('code', code)}>Rejoindre</button>
            </div>
          </section>
        ) : null}
        {erreur && <p className="message erreur">{erreur}</p>}
        {erreur && mode !== 'amis' && <button type="button" className="bouton-or" onClick={() => entrer(mode)}>Réessayer</button>}
      </main>
    );
  }
  return <TableBlackjack profil={profil} table={table} quitter={retour} recharger={recharger} />;
}

type Zone = 'mise' | 'paires' | 'vingtEtUn';

export function TableBlackjack({ profil, table, quitter, recharger }: { profil: Profil; table: TableBJ; quitter: () => void; recharger: () => Promise<void> }) {
  const etat = useTableBJ(table.id);
  const [paris, setParis] = useState<Record<Zone, number>>({ mise: 0, paires: 0, vingtEtUn: 0 });
  const [jeton, setJeton] = useState<number>(() => { try { return Number(localStorage.getItem('bj-jeton')) || 10; } catch { return 10; } });
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [chatOuvert, setChatOuvert] = useState(false);
  const [dernierPari, setDernierPari] = useState<Record<Zone, number> | null>(() => {
    try { const v = JSON.parse(localStorage.getItem('bj-dernier-pari') ?? 'null'); return v && v.mise > 0 ? v : null; } catch { return null; }
  });
  const maintenant = useHorloge();
  const taille = useTailleEcran();
  const precedent = useRef<EtatBJ | null>(null);
  const niveau = niveauDe(profil.xp);
  const max = miseMax(niveau);
  const moiIndex = etat ? etat.sieges.findIndex((s) => s?.joueur === profil.id) : -1;
  const moi = moiIndex >= 0 ? etat!.sieges[moiIndex] : null;
  const pivote = taille.l < taille.h && taille.l <= 900;
  const L = pivote ? taille.h : taille.l, H = pivote ? taille.l : taille.h;

  // Je me lève en partant.
  useEffect(() => () => { appelBJ('quitter', { table_id: table.id }).catch(() => {}); }, [table.id]);

  // Sons au fil de la donne, et solde mis à jour.
  useEffect(() => {
    if (!etat) return;
    const p = precedent.current;
    precedent.current = etat;
    if (!p) return;
    if (p.phase === 'mises' && etat.phase !== 'mises' && etat.donneA) {
      const n = 2 * ((etat.ordre?.length ?? 1) + 1);
      for (let k = 0; k < n; k++) setTimeout(() => son.carte(), Math.max(0, etat.donneA + k * DELAI_CARTE_DONNE - Date.now()));
    }
    if (p.phase !== 'resultats' && etat.phase === 'resultats') {
      const debut = (etat.revelationA ?? Date.now()) - DELAI_CARTE_CROUPIER * Math.max(1, etat.croupier.cartes.length - 1);
      for (let k = 1; k < etat.croupier.cartes.length; k++) setTimeout(() => son.carte(), Math.max(0, debut + (k - 1) * DELAI_CARTE_CROUPIER - Date.now()));
      const s = etat.sieges[moiIndex];
      setTimeout(() => {
        if (s?.mains.some((m) => m.resultat === 'blackjack')) son.exploit();
        else if ((s?.dernierGain ?? 0) > 0) { son.fanfare(); son.piece(); }
        recharger();
      }, Math.max(0, (etat.revelationA ?? Date.now()) - Date.now()) + 200);
    }
    if (p.phase === 'resultats' && etat.phase === 'mises') { setParis({ mise: 0, paires: 0, vingtEtUn: 0 }); recharger(); }
  }, [etat, moiIndex, recharger]);

  // Filet de sécurité : si une minuterie a expiré sans que le serveur avance, on le relance.
  useEffect(() => {
    if (!etat?.echeance) return;
    const t = setTimeout(() => appelBJ('avancer', { table_id: table.id }).catch(() => {}), Math.max(0, etat.echeance - Date.now() + 2500));
    return () => clearTimeout(t);
  }, [etat?.echeance, table.id]);

  async function envoyer(action: string, params: Record<string, unknown>) {
    debloquerSon();
    setEnCours(true); setMessage(null);
    try { await appelBJ(action, { table_id: table.id, ...params }); recharger(); }
    catch (e) { setMessage((e as Error).message); }
    finally { setEnCours(false); }
  }

  function miser(p: Record<Zone, number>) {
    const choix = { mise: p.mise, paires: p.paires, vingtEtUn: p.vingtEtUn };
    setDernierPari(choix);
    try { localStorage.setItem('bj-dernier-pari', JSON.stringify(choix)); } catch { /* stockage indisponible */ }
    son.piece();
    envoyer('miser', { mise: p.mise, paires: p.paires, vingt_et_un: p.vingtEtUn });
  }

  // Taille figée en pixels : le clavier du chat ne déforme plus la table (elle reste en paysage).
  const style = { ['--gh' as string]: `${H / 100}px`, ['--gw' as string]: `${L / 100}px`, ...(pivote ? { width: L, height: H } : {}) } as CSSProperties;
  if (!etat) return <div className={`jeu bj2 ${pivote ? 'pivote' : ''}`} style={style}><div className="bj2-decor" /><p className="bj2-attente"><span className="attente-piece" aria-hidden="true"><img src="/img/louidor.webp" alt="" /></span>Le croupier mélange le sabot…</p></div>;

  const finDonne = etat.donneA ? etat.donneA + dureeDonne(etat.ordre?.length ?? 1) : 0;
  const enDistribution = maintenant < finDonne;
  const revele = etat.phase !== 'resultats' || (etat.revelationA ?? 0) <= maintenant;
  const monTour = etat.phase === 'jeu' && etat.tour === moiIndex && !enDistribution;
  const maMain = moi?.mains[moi.active];
  const totalParis = paris.mise + paris.paires + paris.vingtEtUn;
  const peutPoser = !!moi && etat.phase === 'mises' && moi.mise === 0 && !enCours;
  /** Pose le jeton choisi sur une zone de mon siège (mise principale ou pari annexe). */
  const poser = (z: Zone) => {
    if (!peutPoser) return;
    debloquerSon();
    setParis((p) => {
      const n = { ...p };
      const reste = profil.louidors - (p.mise + p.paires + p.vingtEtUn);
      let ajout = Math.min(jeton, reste);
      if (z === 'mise') ajout = Math.min(ajout, max - p.mise);
      else ajout = Math.min(ajout, Math.max(0, p.mise - p[z]));
      if (ajout <= 0) { setMessage(z === 'mise' ? (p.mise >= max ? `Mise max à ton niveau : ${max.toLocaleString('fr-FR')}` : 'Pas assez de Louidors') : 'Pose d’abord ta mise : un pari annexe ne la dépasse pas'); return p; }
      setMessage(null); son.piece();
      n[z] = p[z] + ajout;
      return n;
    });
  };
  const choisirJeton = (j: number) => { setJeton(j); try { localStorage.setItem('bj-jeton', String(j)); } catch { /* */ } };
  const doublerParis = () => setParis((p) => {
    const mise = Math.min(max, p.mise * 2);
    const n = { mise, paires: Math.min(mise, p.paires * 2), vingtEtUn: Math.min(mise, p.vingtEtUn * 2) };
    return n.mise + n.paires + n.vingtEtUn <= profil.louidors ? n : p;
  });
  const restantMs = etat.echeance ? Math.max(0, etat.echeance - maintenant) : null;
  const totalMs = etat.phase === 'mises' ? 15000 : etat.phase === 'assurance' ? 10000 : 20000;
  const croupierTotal = valeurMain(etat.croupier.cartes).total;
  const croupierSaute = etat.phase === 'resultats' && revele && croupierTotal > 21;
  const monGain = moi?.dernierGain ?? 0;
  const monBJ = !!moi?.mains.some((m) => m.resultat === 'blackjack');
  const visible = (k: number, debut: number) => maintenant >= debut + k * DELAI_CARTE_DONNE;

  return (
    <div className={`jeu bj2 ${pivote ? 'pivote' : ''}`} style={style} onPointerDown={debloquerSon}>
      <div className="bj2-decor" />
      <img className="bj2-croupier" src="/decor/bj-croupier.webp" alt="Le croupier" draggable={false} />
      <div className="bj2-tapis" aria-hidden="true" />
      <div className="bj2-inscription" aria-hidden="true"><span>Blackjack paie 3 pour 2</span></div>
      <div className="bj2-sabot" style={{ left: `${SABOT.x}%`, top: `${SABOT.y}%` }} aria-hidden="true" />

      {/* Barre du haut */}
      <div className="bj2-haut gauche">
        <button type="button" className="bj2-rond" onClick={quitter} aria-label="Quitter la table">‹</button>
        <span className="bj2-titre">{table.type === 'public' ? 'Table publique' : table.type === 'solo' ? 'Table solo' : `Table privée · ${table.code}`}</span>
      </div>
      <div className="bj2-haut droite">
        {moi && <button type="button" className="bj2-rond" onClick={() => setChatOuvert(true)} aria-label="Écrire à la table"><img className="bj2-rond-img" src="/img/jeu_chat.webp" alt="" /></button>}
        <span className="bj2-solde"><span className="piece-or" aria-hidden="true" />{profil.louidors.toLocaleString('fr-FR')}</span>
      </div>

      {/* Croupier */}
      <div className="bj2-main-croupier" style={{ left: `${CROUPIER.x}%`, top: `${CROUPIER.y}%` }}>
        {etat.croupier.cartes.map((c, i) => {
          const n = etat.ordre?.length ?? 1;
          if (i === 0 && etat.donneA && !visible(n, etat.donneA)) return null;
          const retourne = etat.phase === 'resultats' && i >= 1;
          const debutRev = (etat.revelationA ?? 0) - DELAI_CARTE_CROUPIER * Math.max(1, etat.croupier.cartes.length - 1);
          if (retourne && maintenant < debutRev + (i - 1) * DELAI_CARTE_CROUPIER) return i === 1 ? <CarteBJ key={`${etat.manche}-c${i}`} carte={null} /> : null;
          return <CarteBJ key={`${etat.manche}-c${i}`} carte={c} depart={i >= 2 ? { x: (SABOT.x - CROUPIER.x) * L / 100, y: (SABOT.y - CROUPIER.y) * H / 100 } : i === 0 ? { x: (SABOT.x - CROUPIER.x) * L / 100, y: (SABOT.y - CROUPIER.y) * H / 100 } : undefined} retourne={i === 1} />;
        })}
        {etat.croupier.cachee && etat.donneA && visible(2 * (etat.ordre?.length ?? 1) + 1, etat.donneA) && <CarteBJ carte={null} depart={{ x: (SABOT.x - CROUPIER.x) * L / 100, y: (SABOT.y - CROUPIER.y) * H / 100 }} />}
        {etat.croupier.cartes.length > 0 && !enDistribution && (
          <span className={`bj2-total ${croupierSaute ? 'saute' : ''}`}>{etat.croupier.cachee ? valeurMain(etat.croupier.cartes).total : revele ? croupierTotal : '…'}</span>
        )}
        {croupierSaute && <img className="bj2-tampon-croupier img" src={BJ.saute} alt="Le croupier saute !" />}
      </div>

      {/* Sièges */}
      {etat.sieges.map((s, i) => (
        <Siege key={i} index={i} place={moiIndex >= 0 ? (i - moiIndex + 7) % 5 : i} siege={s} moi={i === moiIndex} actif={etat.phase === 'jeu' && etat.tour === i && !enDistribution}
          resultat={etat.phase === 'resultats' && revele} etat={etat} maintenant={maintenant} L={L} H={H}
          paris={i === moiIndex && moi && moi.mise === 0 ? paris : null} poser={i === moiIndex && peutPoser ? poser : undefined} />
      ))}

      {/* Grandes annonces */}
      {etat.phase === 'resultats' && revele && moi?.mains.length ? (
        monBJ ? <div className="bj2-annonce blackjack" key={`a${etat.manche}`}><span className="bj2-rayons" /><img className="bj2-banniere-bj" src={BJ.blackjack} alt="BLACKJACK !" /><em>+{monGain.toLocaleString('fr-FR')}</em><Pieces /></div>
          : monGain > 0 ? <div className="bj2-annonce gagne" key={`a${etat.manche}`}><strong>GAGNÉ</strong><em>+{monGain.toLocaleString('fr-FR')}</em><Pieces /></div>
            : monGain < 0 ? <div className="bj2-annonce perdu" key={`a${etat.manche}`}><strong>PERDU</strong><em>{monGain.toLocaleString('fr-FR')}</em></div>
              : <div className="bj2-annonce egalite" key={`a${etat.manche}`}><strong>ÉGALITÉ</strong><em>mise rendue</em></div>
      ) : null}
      {moi && !enDistribution && etat.phase !== 'mises' && (moi.resultatsAnnexes ?? []).filter((r) => r.pari !== 'assurance' && r.gain > 0).map((r) => (
        <div key={`${etat.manche}-${r.pari}`} className="bj2-annexe-gagnee">{r.pari === 'paires' ? 'Paires' : '21+3'} · {r.nom} · <b>+{(r.gain - r.mise).toLocaleString('fr-FR')}</b></div>
      ))}

      <ChatBJ tableId={table.id} moi={profil.id} ouvert={!!moi && chatOuvert} fermer={() => setChatOuvert(false)} />

      {/* Commandes : une seule barre centrée en bas */}
      {message && <p className="bj2-erreur">{message}</p>}
      <div className="bj2-barre">
        {restantMs !== null && etat.phase !== 'resultats' && !enDistribution && (
          <div className="bj2-minuterie"><i style={{ width: `${Math.min(100, (restantMs / totalMs) * 100)}%` }} /></div>
        )}
        {!moi ? <p className="bj2-info">Tu regardes la table · une place se libère ? Reviens t’asseoir.</p>
          : etat.phase === 'mises' ? (moi.mise > 0
            ? <p className="bj2-info">Mise posée : <strong>{moi.mise + moi.annexes.paires + moi.annexes.vingtEtUn}</strong> · on attend les autres pirates…</p>
            : (
              <div className="bj2-ligne">
                <div className="bj2-max" title={`Niveau ${niveau}`}><small>Mise max</small><b>{max.toLocaleString('fr-FR')}</b></div>
                <div className="bj2-jetons" role="radiogroup" aria-label="Jeton à poser">
                  {JETONS.map((j) => {
                    const bloque = j > max;
                    return (
                      <button key={j} type="button" role="radio" aria-checked={jeton === j} className={`bj2-jeton j${j} ${jeton === j ? 'choisi' : ''} ${bloque ? 'bloque' : ''}`}
                        disabled={bloque} onClick={() => choisirJeton(j)} aria-label={`Jeton de ${j}${bloque ? ' (niveau insuffisant)' : ''}`}>
                        <span>{j >= 1000 ? `${j / 1000}k` : j}</span>{bloque && <img className="bj2-cadenas" src="/img/etat_verrou.webp" alt="" />}
                      </button>
                    );
                  })}
                </div>
                {totalParis === 0 && dernierPari ? (
                  <button type="button" className="bouton-sombre c-vert bj2-rejouer" disabled={enCours || dernierPari.mise > max || dernierPari.mise + dernierPari.paires + dernierPari.vingtEtUn > profil.louidors}
                    onClick={() => miser(dernierPari)} aria-label="Rejouer la même mise">↻ Rejouer<small>{dernierPari.mise + dernierPari.paires + dernierPari.vingtEtUn}</small></button>
                ) : (
                  <>
                    <button type="button" className="bj2-effacer" disabled={totalParis === 0} onClick={doublerParis} aria-label="Doubler les jetons posés">×2</button>
                    <button type="button" className="bj2-effacer" disabled={totalParis === 0} onClick={() => setParis({ mise: 0, paires: 0, vingtEtUn: 0 })} aria-label="Effacer les jetons">↺</button>
                  </>
                )}
                <button type="button" className="bouton-or bj2-miser" disabled={enCours || paris.mise < MISE_MIN_BJ} onClick={() => miser(paris)}>{totalParis ? `Miser ${totalParis.toLocaleString('fr-FR')}` : 'Touche ton siège'}</button>
              </div>
            ))
          : enDistribution ? <p className="bj2-info">Le croupier distribue…</p>
          : etat.phase === 'assurance' ? (moi.mains.length && moi.assurance === null ? (
            <div className="bj2-ligne">
              <p className="bj2-info">Assurance pour <strong>{Math.max(1, Math.floor(moi.mise / 2))}</strong> ? <small>(paie 2 pour 1)</small></p>
              <button type="button" className="bouton-sombre c-gris" disabled={enCours} onClick={() => envoyer('assurer', { prendre: false })}>Non</button>
              <button type="button" className="bouton-or" disabled={enCours || profil.louidors < Math.floor(moi.mise / 2)} onClick={() => envoyer('assurer', { prendre: true })}>Oui</button>
            </div>
          ) : <p className="bj2-info">Assurance : on attend les pirates…</p>)
          : etat.phase === 'jeu' ? (monTour && maMain ? (
            <div className="bj2-ligne">
              {moi.mains.length > 1 && <span className="bj2-quelle-main">Main {moi.active + 1}/2</span>}
              <button type="button" className="bouton-sombre c-vert" disabled={enCours || !peutDoubler(moi) || profil.louidors < maMain.mise} onClick={() => envoyer('agir', { coup: 'doubler' })}>Doubler</button>
              <button type="button" className="bouton-or bj2-tirer" disabled={enCours} onClick={() => envoyer('agir', { coup: 'tirer' })}>Tirer</button>
              <button type="button" className="bouton-sombre c-bleu" disabled={enCours} onClick={() => envoyer('agir', { coup: 'rester' })}>Rester</button>
              {peutSeparer(moi) && <button type="button" className="bouton-sombre c-violet" disabled={enCours || profil.louidors < maMain.mise} onClick={() => envoyer('agir', { coup: 'separer' })}>Séparer</button>}
            </div>
          ) : <p className="bj2-info">{etat.tour !== null && etat.sieges[etat.tour] ? `${etat.sieges[etat.tour]!.pseudo} réfléchit…` : '…'}</p>)
          : <p className="bj2-info">{revele ? 'Nouvelle donne dans un instant…' : 'Le croupier retourne ses cartes…'}</p>}
      </div>
    </div>
  );
}

function Siege({ index, place, siege, moi, actif, resultat, etat, maintenant, L, H, paris, poser }: {
  index: number; place: number; siege: SiegeBJ | null; moi: boolean; actif: boolean; resultat: boolean; etat: EtatBJ; maintenant: number; L: number; H: number;
  paris?: Record<Zone, number> | null; poser?: (z: Zone) => void;
}) {
  const p = SIEGES[place];
  if (!siege) return <div className="bj2-siege vide" style={{ left: `${p.x}%`, top: `${p.y}%` }}><span className="bj2-place">Libre</span></div>;
  const pos = etat.ordre?.indexOf(index) ?? -1;
  const n = etat.ordre?.length ?? 1;
  const depart = { x: (SABOT.x - p.x) * L / 100, y: (SABOT.y - p.y) * H / 100 };
  const misesTotales = siege.mains.reduce((t, m) => t + m.mise, 0) || siege.mise;
  return (
    <div className={`bj2-siege ${moi ? 'moi' : ''} ${actif ? 'actif' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
      {etat.phase === 'mises' ? (
        <div className={`bj2-cercles ${poser ? 'actifs' : ''}`}>
          {([['paires', 'P'], ['mise', 'Mise'], ['vingtEtUn', '21+3']] as Array<[Zone, string]>).map(([z, nom]) => {
            const v = paris ? paris[z] : z === 'mise' ? siege.mise : siege.annexes[z];
            return (
              <button key={z} type="button" className={`bj2-cercle ${z}`} disabled={!poser} onClick={() => poser?.(z)}
                aria-label={`${z === 'mise' ? 'Mise' : z === 'paires' ? 'Paires parfaites' : '21+3'} : ${v}`}>
                {v > 0 ? <><img src={imageJeton(v)} alt="" /><b>{v >= 10000 ? `${Math.round(v / 1000)}k` : v.toLocaleString('fr-FR')}</b></> : <small>{nom}</small>}
              </button>
            );
          })}
        </div>
      ) : (
      <div className={`bj2-mains ${siege.mains.length > 1 ? 'deux' : ''}`}>
        {siege.mains.map((m, k) => (
          <Main key={k} main={m} active={actif && siege.active === k && siege.mains.length > 1} resultat={resultat}
            donne={!m.separee && etat.donneA && pos >= 0 ? { debut: etat.donneA, indices: [pos, n + 1 + pos] } : null} maintenant={maintenant} depart={depart} />
        ))}
      </div>
      )}
      <div className="bj2-joueur" onClick={() => poser?.('mise')} role={poser ? 'button' : undefined}>
        <Avatar photo={siege.photo} taille={moi ? 38 : 32} cadre={siege.cadre} />
        <div className="bj2-infos">
          <span className="bj2-pseudo">{misesTotales >= 1000 && <img className="bj2-vip" src={BJ.vip} alt="VIP" />}{siege.pseudo}</span>
          <span className="bj2-sous">
            {misesTotales > 0 && <span className="bj2-mise"><span className="piece-or" aria-hidden="true" />{misesTotales}</span>}
            {siege.annexes.paires > 0 && <i title="Paires parfaites">P{siege.annexes.paires}</i>}
            {siege.annexes.vingtEtUn > 0 && <i title="21+3">21+3</i>}
            {(siege.assurance ?? 0) > 0 && <i title="Assurance">A</i>}
          </span>
        </div>
      </div>
    </div>
  );
}

function Main({ main, active, resultat, donne, maintenant, depart }: {
  main: MainBJ; active: boolean; resultat: boolean; donne: { debut: number; indices: number[] } | null; maintenant: number; depart: { x: number; y: number };
}) {
  const cartes = main.cartes.filter((_, i) => !donne || i >= 2 || maintenant >= donne.debut + donne.indices[i] * DELAI_CARTE_DONNE);
  const v = valeurMain(cartes).total;
  const etiquette = main.etat === 'saute' && cartes.length === main.cartes.length ? 'SAUTÉ' : main.etat === 'blackjack' && !resultat && cartes.length === 2 ? 'BLACKJACK !' : main.etat === 'double' && !resultat ? 'DOUBLÉ' : null;
  return (
    <div className={`bj2-main ${active ? 'active' : ''}`}>
      <div className="bj2-cartes">{cartes.map((c, i) => <CarteBJ key={i} carte={c} depart={depart} />)}</div>
      {cartes.length > 0 && <span className={`bj2-total ${v > 21 ? 'saute' : ''}`}>{estBlackjack(cartes) && !main.separee ? 'BJ' : v}</span>}
      {etiquette && <span className={`bj2-etiquette ${main.etat}`}>{etiquette}</span>}
      {resultat && main.resultat && (
        <span className={`bj2-resultat ${main.resultat}`}>
          {main.resultat === 'blackjack' ? 'BLACKJACK' : main.resultat === 'gagne' ? 'GAGNÉ' : main.resultat === 'egalite' ? 'ÉGALITÉ' : 'PERDU'}
        </span>
      )}
    </div>
  );
}

/** Le plus gros jeton qui tient dans le montant (pour l'afficher sur la table). */
function imageJeton(v: number) {
  const j = [...JETONS].reverse().find((x) => x <= v) ?? 10;
  return `/img/jeton_${j}.webp`;
}

/** Une carte : elle part du sabot et glisse jusqu'à sa place (ou se retourne pour la carte cachée). */
export function CarteBJ({ carte, depart, retourne }: { carte: string | null; depart?: { x: number; y: number }; retourne?: boolean }) {
  const style = depart ? { ['--sx' as string]: `${depart.x}px`, ['--sy' as string]: `${depart.y}px` } as CSSProperties : undefined;
  if (!carte) return <span className={`bj2-carte dos ${depart ? 'vole' : ''}`} style={style} aria-label="Carte cachée" />;
  const c = couleurDe(carte), r = rangDe(carte);
  const rouge = c === 'coeur' || c === 'carreau';
  return (
    <span className={`bj2-carte ${rouge ? 'rouge' : 'noire'} ${retourne ? 'retourne' : depart ? 'vole' : ''}`} style={style} aria-label={`${r} de ${c}`}>
      <b>{r}</b><i>{SYMBOLES[c]}</i><em>{SYMBOLES[c]}</em>
    </span>
  );
}

/** Pluie de pièces pour une main gagnée. */
function Pieces() {
  const [pieces] = useState(() => Array.from({ length: 26 }, (_, k) => ({ k, x: Math.random() * 100, dl: Math.random() * 0.8, du: 1.1 + Math.random() * 0.8, s: 0.6 + Math.random() * 0.7 })));
  return <span className="bj2-pieces" aria-hidden="true">{pieces.map((p) => <i key={p.k} style={{ left: `${p.x}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.du}s`, ['--s' as string]: p.s }} />)}</span>;
}

/** Chat de la table : transparent, sur le côté ; chaque message reste 4 secondes puis s'efface. */
function ChatBJ({ tableId, moi, ouvert, fermer }: { tableId: string; moi: string; ouvert: boolean; fermer: () => void }) {
  const [messages, setMessages] = useState<Array<{ id: number; de: string; pseudo: string; texte: string }>>([]);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const bloques = useBloques();
  useEffect(() => {
    const canal = supabase.channel(`bj-chat-${tableId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bj_messages', filter: `table_id=eq.${tableId}` }, ({ new: m }) => {
        const msg = m as { id: number; de: string; pseudo: string; texte: string };
        setMessages((l) => [...l.filter((x) => x.id !== msg.id), msg].slice(-6));
        setTimeout(() => setMessages((l) => l.filter((x) => x.id !== msg.id)), 4000);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [tableId]);
  async function envoyer() {
    const t = texte.trim();
    if (!t) return;
    setTexte(''); setErreur(null);
    const { error } = await supabase.rpc('envoyer_message_bj', { p_table: tableId, p_texte: t });
    if (error) setErreur(error.message);
  }
  return (
    <>
      <div className="bj2-chat" aria-live="polite">
        {messages.filter((m) => !bloques.has(m.de)).map((m) => (
          <p key={m.id} className={m.de === moi ? 'moi' : ''}><b>{m.pseudo}</b> {m.texte}</p>
        ))}
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
      {ouvert && (
        <form className="bj2-chat-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
          <input autoFocus onFocus={() => setTimeout(() => window.scrollTo(0, 0), 50)} value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={120} placeholder="Écris à la table…" enterKeyHint="send" autoComplete="off" />
          <button type="submit" disabled={!texte.trim()} aria-label="Envoyer">➤</button>
          <button type="button" onClick={fermer} aria-label="Fermer le chat">×</button>
        </form>
      )}
    </>
  );
}

/** L'heure, rafraîchie 5 fois par seconde (minuteries, distribution). */
function useHorloge() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), 200); return () => clearInterval(i); }, []);
  return t;
}
function useTailleEcran() {
  const [t, setT] = useState(() => ({ l: window.innerWidth, h: window.innerHeight }));
  useEffect(() => {
    // Pendant qu'on écrit, le clavier réduit l'écran : on garde la table en paysage sans la redessiner.
    const f = () => { const a = document.activeElement; if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA')) return; setT({ l: window.innerWidth, h: window.innerHeight }); };
    const sortie = () => setTimeout(f, 350);
    window.addEventListener('resize', f); window.addEventListener('orientationchange', f); document.addEventListener('focusout', sortie);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); document.removeEventListener('focusout', sortie); };
  }, []);
  return t;
}
