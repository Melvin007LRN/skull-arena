// Le Blackjack du Capitaine : une table ovale en paysage, comme les parties classiques, face au croupier.
// 5 sièges, distribution carte par carte, paris annexes (Paires parfaites, 21+3, Assurance),
// séparation et double, animations de victoire et chat transparent sur le côté.
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
/** Position des sièges et du sabot sur la table (en % de l'écran paysage). */
const SIEGES = [{ x: 8, y: 60 }, { x: 21, y: 74 }, { x: 36, y: 80 }, { x: 51, y: 74 }, { x: 64, y: 60 }];
const SABOT = { x: 54, y: 40 };
const CROUPIER = { x: 36, y: 43 };

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

  if (!table) {
    return (
      <main className="ecran ecran-bj-entree">
        <button type="button" className="retour" onClick={retour}>‹ Retour</button>
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
        ) : <p className="petit-texte centre">{enCours ? 'On t’installe à la table…' : ''}</p>}
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
  const [zone, setZone] = useState<Zone>('mise');
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
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
    if (p.phase === 'resultats' && etat.phase === 'mises') { setParis({ mise: 0, paires: 0, vingtEtUn: 0 }); setZone('mise'); recharger(); }
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

  const style = { ['--gh' as string]: `${H / 100}px`, ['--gw' as string]: `${L / 100}px` } as CSSProperties;
  if (!etat) return <div className={`jeu bj2 ${pivote ? 'pivote' : ''}`} style={style}><div className="bj2-decor" /><p className="bj2-attente">Préparation de la table…</p></div>;

  const finDonne = etat.donneA ? etat.donneA + dureeDonne(etat.ordre?.length ?? 1) : 0;
  const enDistribution = maintenant < finDonne;
  const revele = etat.phase !== 'resultats' || (etat.revelationA ?? 0) <= maintenant;
  const monTour = etat.phase === 'jeu' && etat.tour === moiIndex && !enDistribution;
  const maMain = moi?.mains[moi.active];
  const totalParis = paris.mise + paris.paires + paris.vingtEtUn;
  const ajouter = (j: number) => {
    son.piece();
    setParis((p) => {
      const n = { ...p, [zone]: p[zone] + j };
      if (n.mise > max) n.mise = max;
      if (zone !== 'mise' && n[zone] > Math.max(n.mise, 0)) n[zone] = n.mise;
      return n;
    });
  };
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
      <div className="bj2-inscription" aria-hidden="true"><span>Blackjack paie 3 pour 2</span><small>Le croupier reste sur 17 · Assurance paie 2 pour 1</small></div>
      <div className="bj2-sabot" style={{ left: `${SABOT.x}%`, top: `${SABOT.y}%` }} aria-hidden="true" />

      {/* Barre du haut */}
      <button type="button" className="bj2-rond bj2-quitter" onClick={quitter} aria-label="Quitter la table">‹</button>
      <span className="bj2-titre">{table.type === 'public' ? 'Table publique' : table.type === 'solo' ? 'Table solo' : `Table privée · ${table.code}`}</span>
      <span className="bj2-solde"><span className="piece-or" aria-hidden="true" />{profil.louidors.toLocaleString('fr-FR')}</span>

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
        {croupierSaute && <span className="bj2-tampon-croupier">Le croupier saute !</span>}
      </div>

      {/* Sièges */}
      {etat.sieges.map((s, i) => (
        <Siege key={i} index={i} siege={s} moi={i === moiIndex} actif={etat.phase === 'jeu' && etat.tour === i && !enDistribution}
          resultat={etat.phase === 'resultats' && revele} etat={etat} maintenant={maintenant} L={L} H={H} />
      ))}

      {/* Grandes annonces */}
      {etat.phase === 'resultats' && revele && moi?.mains.length ? (
        monBJ ? <div className="bj2-annonce blackjack" key={`a${etat.manche}`}><span className="bj2-rayons" /><strong>BLACKJACK !</strong><em>+{monGain.toLocaleString('fr-FR')}</em><Pieces /></div>
          : monGain > 0 ? <div className="bj2-annonce gagne" key={`a${etat.manche}`}><strong>GAGNÉ</strong><em>+{monGain.toLocaleString('fr-FR')}</em><Pieces /></div>
            : monGain < 0 ? <div className="bj2-annonce perdu" key={`a${etat.manche}`}><strong>PERDU</strong><em>{monGain.toLocaleString('fr-FR')}</em></div>
              : <div className="bj2-annonce egalite" key={`a${etat.manche}`}><strong>ÉGALITÉ</strong><em>mise rendue</em></div>
      ) : null}
      {moi && !enDistribution && etat.phase !== 'mises' && (moi.resultatsAnnexes ?? []).filter((r) => r.pari !== 'assurance' && r.gain > 0).map((r) => (
        <div key={`${etat.manche}-${r.pari}`} className="bj2-annexe-gagnee">{r.pari === 'paires' ? 'Paires' : '21+3'} · {r.nom} · <b>+{(r.gain - r.mise).toLocaleString('fr-FR')}</b></div>
      ))}

      <ChatBJ tableId={table.id} moi={profil.id} assis={!!moi} />

      {/* Commandes */}
      <div className="bj2-commandes">
        {restantMs !== null && etat.phase !== 'resultats' && !enDistribution && (
          <div className="bj2-minuterie"><i style={{ width: `${Math.min(100, (restantMs / totalMs) * 100)}%` }} /></div>
        )}
        {etat.phase === 'mises' && moi && (moi.mise > 0
          ? <p className="bj2-info">Mise posée : <strong>{moi.mise}</strong>{moi.annexes.paires + moi.annexes.vingtEtUn > 0 ? ` + ${moi.annexes.paires + moi.annexes.vingtEtUn} en paris annexes` : ''} · on attend les autres pirates…</p>
          : (
            <div className="bj2-mises">
              <div className="bj2-zones">
                {([['mise', 'Mise'], ['paires', 'Paires parfaites'], ['vingtEtUn', '21+3']] as Array<[Zone, string]>).map(([z, nom]) => (
                  <button key={z} type="button" className={zone === z ? 'actif' : ''} disabled={z !== 'mise' && paris.mise === 0} onClick={() => setZone(z)}>
                    <small>{nom}</small><b>{paris[z]}</b>
                  </button>
                ))}
              </div>
              <div className="bj2-jetons">
                {JETONS.filter((j) => j <= max).map((j) => (
                  <button key={j} type="button" className={`bj2-jeton j${j}`} disabled={enCours || totalParis + j > profil.louidors || (zone === 'mise' && paris.mise >= max) || (zone !== 'mise' && paris[zone] >= paris.mise)}
                    onClick={() => ajouter(j)}>{j >= 1000 ? `${j / 1000}k` : j}</button>
                ))}
                <button type="button" className="bouton-sombre bj2-petit" disabled={totalParis === 0} onClick={() => { setParis({ mise: 0, paires: 0, vingtEtUn: 0 }); setZone('mise'); }}>Effacer</button>
                <button type="button" className="bouton-or bj2-miser" disabled={enCours || paris.mise < MISE_MIN_BJ} onClick={() => envoyer('miser', { mise: paris.mise, paires: paris.paires, vingt_et_un: paris.vingtEtUn })}>Miser {totalParis || ''}</button>
              </div>
              <p className="bj2-info petit">Mise de {MISE_MIN_BJ} à {max.toLocaleString('fr-FR')} à ton niveau · paris annexes jusqu’à ta mise</p>
            </div>
          ))}
        {etat.phase === 'assurance' && !enDistribution && (moi?.mains.length && moi.assurance === null ? (
          <div className="bj2-actions">
            <p className="bj2-info">Le croupier montre un As. Assurance pour <strong>{Math.max(1, Math.floor(moi.mise / 2))}</strong> ? (paie 2 pour 1)</p>
            <button type="button" className="bouton-sombre bj2-petit" disabled={enCours} onClick={() => envoyer('assurer', { prendre: false })}>Non</button>
            <button type="button" className="bouton-or bj2-petit" disabled={enCours || profil.louidors < Math.floor(moi.mise / 2)} onClick={() => envoyer('assurer', { prendre: true })}>Oui</button>
          </div>
        ) : <p className="bj2-info">Assurance : on attend la décision des pirates…</p>)}
        {etat.phase === 'jeu' && !enDistribution && (monTour && moi && maMain ? (
          <div className="bj2-actions">
            {moi.mains.length > 1 && <span className="bj2-quelle-main">Main {moi.active + 1}/2</span>}
            <button type="button" className="bouton-or" disabled={enCours} onClick={() => envoyer('agir', { coup: 'tirer' })}>Tirer</button>
            <button type="button" className="bouton-sombre c-bleu" disabled={enCours} onClick={() => envoyer('agir', { coup: 'rester' })}>Rester</button>
            <button type="button" className="bouton-sombre c-vert" disabled={enCours || !peutDoubler(moi) || profil.louidors < maMain.mise} onClick={() => envoyer('agir', { coup: 'doubler' })}>Doubler</button>
            {peutSeparer(moi) && <button type="button" className="bouton-sombre c-violet" disabled={enCours || profil.louidors < maMain.mise} onClick={() => envoyer('agir', { coup: 'separer' })}>Séparer</button>}
          </div>
        ) : <p className="bj2-info">{etat.tour !== null && etat.sieges[etat.tour] ? `${etat.sieges[etat.tour]!.pseudo} réfléchit…` : '…'}</p>)}
        {enDistribution && etat.phase !== 'mises' && <p className="bj2-info">Le croupier distribue…</p>}
        {etat.phase === 'resultats' && <p className="bj2-info">{revele ? 'Nouvelle donne dans un instant…' : 'Le croupier retourne ses cartes…'}</p>}
        {!moi && <p className="bj2-info">Tu regardes la table. Une place se libère ? Reviens pour t’asseoir.</p>}
        {message && <p className="bj2-erreur">{message}</p>}
      </div>
    </div>
  );
}

function Siege({ index, siege, moi, actif, resultat, etat, maintenant, L, H }: {
  index: number; siege: SiegeBJ | null; moi: boolean; actif: boolean; resultat: boolean; etat: EtatBJ; maintenant: number; L: number; H: number;
}) {
  const p = SIEGES[index];
  if (!siege) return <div className="bj2-siege vide" style={{ left: `${p.x}%`, top: `${p.y}%` }}><span className="bj2-place">Libre</span></div>;
  const pos = etat.ordre?.indexOf(index) ?? -1;
  const n = etat.ordre?.length ?? 1;
  const depart = { x: (SABOT.x - p.x) * L / 100, y: (SABOT.y - p.y) * H / 100 };
  const misesTotales = siege.mains.reduce((t, m) => t + m.mise, 0) || siege.mise;
  return (
    <div className={`bj2-siege ${moi ? 'moi' : ''} ${actif ? 'actif' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }}>
      <div className={`bj2-mains ${siege.mains.length > 1 ? 'deux' : ''}`}>
        {siege.mains.map((m, k) => (
          <Main key={k} main={m} active={actif && siege.active === k && siege.mains.length > 1} resultat={resultat}
            donne={!m.separee && etat.donneA && pos >= 0 ? { debut: etat.donneA, indices: [pos, n + 1 + pos] } : null} maintenant={maintenant} depart={depart} />
        ))}
      </div>
      <div className="bj2-joueur">
        <Avatar photo={siege.photo} taille={moi ? 44 : 38} cadre={siege.cadre} />
        <span className="bj2-pseudo">{siege.pseudo}</span>
        {misesTotales > 0 && <span className="bj2-mise"><span className="piece-or" aria-hidden="true" />{misesTotales}</span>}
        {(siege.annexes.paires > 0 || siege.annexes.vingtEtUn > 0) && <span className="bj2-annexes">{siege.annexes.paires > 0 && <i title="Paires parfaites">P {siege.annexes.paires}</i>}{siege.annexes.vingtEtUn > 0 && <i title="21+3">21+3 {siege.annexes.vingtEtUn}</i>}</span>}
        {(siege.assurance ?? 0) > 0 && <span className="bj2-annexes"><i>Assuré {siege.assurance}</i></span>}
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
function ChatBJ({ tableId, moi, assis }: { tableId: string; moi: string; assis: boolean }) {
  const [messages, setMessages] = useState<Array<{ id: number; de: string; pseudo: string; texte: string }>>([]);
  const [ouvert, setOuvert] = useState(false);
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
      {assis && (ouvert ? (
        <form className="bj2-chat-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
          <input autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={120} placeholder="Écris à la table…" enterKeyHint="send" autoComplete="off" />
          <button type="submit" disabled={!texte.trim()} aria-label="Envoyer">➤</button>
          <button type="button" onClick={() => setOuvert(false)} aria-label="Fermer le chat">×</button>
        </form>
      ) : <button type="button" className="bj2-rond bj2-bouton-chat" onClick={() => setOuvert(true)} aria-label="Écrire à la table">💬</button>)}
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
    const f = () => setT({ l: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', f); window.addEventListener('orientationchange', f);
    return () => { window.removeEventListener('resize', f); window.removeEventListener('orientationchange', f); };
  }, []);
  return t;
}
