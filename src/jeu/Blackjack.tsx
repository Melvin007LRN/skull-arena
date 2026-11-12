// Le Blackjack du Capitaine : une table en demi-lune de 5 places face au croupier squelette.
// Même ambiance que la table du Skull King : décor de port, verre fumé, contour néon rouge.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Profil } from '../lib/profil.ts';
import { niveau as niveauDe } from '../lib/profil.ts';
import { appelBJ, JETONS, useTableBJ, type TableBJ } from '../lib/blackjack.ts';
import { couleurDe, miseMax, MISE_MIN_BJ, rangDe, valeurMain, estBlackjack, type EtatBJ, type SiegeBJ } from '../engine/blackjack.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { debloquerSon, son } from '../lib/sons.ts';
import './blackjack.css';

const SYMBOLES: Record<string, string> = { pique: '♠', coeur: '♥', carreau: '♦', trefle: '♣' };

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

export function TableBlackjack({ profil, table, quitter, recharger }: { profil: Profil; table: TableBJ; quitter: () => void; recharger: () => Promise<void> }) {
  const etat = useTableBJ(table.id);
  const [mise, setMise] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [enCours, setEnCours] = useState(false);
  const maintenant = useHorloge();
  const precedent = useRef<EtatBJ | null>(null);
  const niveau = niveauDe(profil.xp);
  const max = miseMax(niveau);
  const moiIndex = etat ? etat.sieges.findIndex((s) => s?.joueur === profil.id) : -1;
  const moi = moiIndex >= 0 ? etat!.sieges[moiIndex] : null;

  // Je me lève en partant.
  useEffect(() => () => { appelBJ('quitter', { table_id: table.id }).catch(() => {}); }, [table.id]);

  // Sons et solde : à chaque changement de phase.
  useEffect(() => {
    if (!etat) return;
    const p = precedent.current;
    if (p && p.phase !== etat.phase) {
      if (etat.phase === 'jeu') son.distribuer(2 * (etat.sieges.filter((s) => s?.main).length + 1), 0.22);
      if (etat.phase === 'resultats') {
        const g = moi?.main?.gain ?? 0;
        setTimeout(() => { if (g > (moi?.main?.mise ?? 0)) son.fanfare(); recharger(); }, Math.max(0, (etat.revelationA ?? Date.now()) - Date.now()) + 300);
      }
      if (etat.phase === 'mises') { setMise(0); recharger(); }
    }
    precedent.current = etat;
  }, [etat, moi, recharger]);

  // Filet de sécurité : si une minuterie a expiré sans que le serveur avance, on le relance.
  useEffect(() => {
    if (!etat?.echeance) return;
    const attente = etat.echeance - Date.now() + 2500;
    const t = setTimeout(() => appelBJ('avancer', { table_id: table.id }).catch(() => {}), Math.max(0, attente));
    return () => clearTimeout(t);
  }, [etat?.echeance, table.id]);

  async function envoyer(action: string, params: Record<string, unknown>) {
    debloquerSon();
    setEnCours(true); setMessage(null);
    try { await appelBJ(action, { table_id: table.id, ...params }); if (action === 'miser') recharger(); }
    catch (e) { setMessage((e as Error).message); }
    finally { setEnCours(false); }
  }

  if (!etat) return <main className="bj"><div className="bj-decor" /><p className="bj-attente">Préparation de la table…</p></main>;

  const monTour = etat.phase === 'jeu' && etat.tour === moiIndex;
  const peutDoubler = monTour && moi?.main?.cartes.length === 2 && profil.louidors >= (moi?.main?.mise ?? 0);
  const restant = etat.echeance ? Math.max(0, etat.echeance - maintenant) : null;
  const revele = etat.phase !== 'resultats' || (etat.revelationA ?? 0) <= maintenant;
  const jetons = JETONS.filter((j) => j <= max);

  return (
    <main className="bj">
      <div className="bj-decor" />
      <header className="bj-haut">
        <button type="button" className="bj-rond" onClick={quitter} aria-label="Quitter la table">‹</button>
        <span className="bj-titre">{table.type === 'public' ? 'Table publique' : table.type === 'solo' ? 'Table privée · solo' : `Table privée · code ${table.code}`}</span>
        <span className="bj-solde"><span className="piece-or" aria-hidden="true" />{profil.louidors.toLocaleString('fr-FR')}</span>
      </header>

      <section className="bj-croupier">
        <div className="bj-croupier-avatar" aria-hidden="true">💀</div>
        <div className="bj-main croupier">
          {etat.croupier.cartes.map((c, i) => <CarteBJ key={`${etat.manche}-${i}`} carte={c} retard={etat.phase === 'resultats' && i >= 1 ? (i - 1) * 0.9 : 0} />)}
          {etat.croupier.cachee && <CarteBJ carte={null} />}
        </div>
        {etat.croupier.cartes.length > 0 && (
          <span className="bj-total">{etat.croupier.cachee ? valeurMain(etat.croupier.cartes).total : revele ? valeurMain(etat.croupier.cartes).total : '…'}</span>
        )}
        <p className="bj-regle">Le croupier tire jusqu’à 17 · Blackjack payé 3 pour 2</p>
      </section>

      <section className="bj-table">
        <div className="bj-feutre" aria-hidden="true" />
        {etat.sieges.map((s, i) => (
          <Siege key={i} index={i} siege={s} moi={i === moiIndex} actif={etat.phase === 'jeu' && etat.tour === i}
            resultat={etat.phase === 'resultats' && revele} />
        ))}
      </section>

      <footer className="bj-commandes">
        {restant !== null && etat.phase !== 'resultats' && (
          <div className="bj-minuterie"><i style={{ width: `${Math.min(100, (restant / (etat.phase === 'mises' ? 15000 : 20000)) * 100)}%` }} /></div>
        )}
        {etat.phase === 'mises' && moi && (
          moi.mise > 0 ? <p className="bj-info">Mise posée : <strong>{moi.mise}</strong> · on attend les autres pirates…</p> : (
            <>
              <div className="bj-jetons">
                {jetons.map((j) => (
                  <button key={j} type="button" className={`bj-jeton j${j}`} disabled={enCours || mise + j > Math.min(max, profil.louidors)} onClick={() => { son.piece(); setMise((m) => m + j); }}>{j >= 1000 ? `${j / 1000}k` : j}</button>
                ))}
              </div>
              <div className="bj-actions">
                <button type="button" className="bouton-sombre" disabled={mise === 0} onClick={() => setMise(0)}>Effacer</button>
                <button type="button" className="bouton-or" disabled={enCours || mise < MISE_MIN_BJ} onClick={() => envoyer('miser', { mise })}>Miser {mise || ''}</button>
              </div>
              <p className="bj-info petit">Mise de {MISE_MIN_BJ} à {max.toLocaleString('fr-FR')} Louidors à ton niveau ({niveau}){niveau < 50 ? ' · monte de niveau pour miser plus' : ''}</p>
            </>
          )
        )}
        {etat.phase === 'jeu' && (monTour ? (
          <div className="bj-actions trois">
            <button type="button" className="bouton-or" disabled={enCours} onClick={() => envoyer('agir', { coup: 'tirer' })}>Tirer</button>
            <button type="button" className="bouton-sombre" disabled={enCours} onClick={() => envoyer('agir', { coup: 'rester' })}>Rester</button>
            <button type="button" className="bouton-sombre" disabled={enCours || !peutDoubler} onClick={() => envoyer('agir', { coup: 'doubler' })}>Doubler</button>
          </div>
        ) : <p className="bj-info">{etat.tour !== null && etat.sieges[etat.tour] ? `${etat.sieges[etat.tour]!.pseudo} réfléchit…` : '…'}</p>)}
        {etat.phase === 'resultats' && <p className="bj-info">{revele ? 'Nouvelle donne dans un instant…' : 'Le croupier retourne ses cartes…'}</p>}
        {!moi && <p className="bj-info">Tu regardes la table. Une place se libère ? Reviens pour t’asseoir.</p>}
        {message && <p className="bj-erreur">{message}</p>}
      </footer>
    </main>
  );
}

function Siege({ index, siege, moi, actif, resultat }: { index: number; siege: SiegeBJ | null; moi: boolean; actif: boolean; resultat: boolean }) {
  if (!siege) return <div className={`bj-siege vide s${index}`}><span className="bj-place">Place libre</span></div>;
  const m = siege.main;
  const v = m ? valeurMain(m.cartes).total : 0;
  const etiquette = !m ? null : m.etat === 'saute' ? 'SAUTÉ' : m.etat === 'blackjack' && !resultat ? 'BLACKJACK !' : null;
  return (
    <div className={`bj-siege s${index} ${moi ? 'moi' : ''} ${actif ? 'actif' : ''}`}>
      {m && (
        <div className="bj-main">
          {m.cartes.map((c, i) => <CarteBJ key={i} carte={c} />)}
          <span className={`bj-total ${v > 21 ? 'saute' : ''}`}>{estBlackjack(m.cartes) ? 'BJ' : v}</span>
        </div>
      )}
      {etiquette && <span className={`bj-etiquette ${m!.etat}`}>{etiquette}</span>}
      {resultat && m?.resultat && (
        <span className={`bj-resultat ${m.resultat}`}>
          {m.resultat === 'blackjack' ? 'BLACKJACK !' : m.resultat === 'gagne' ? 'GAGNÉ' : m.resultat === 'egalite' ? 'ÉGALITÉ' : 'PERDU'}
          <b>{(m.gain ?? 0) - m.mise > 0 ? `+${(m.gain ?? 0) - m.mise}` : (m.gain ?? 0) - m.mise === 0 ? '±0' : (m.gain ?? 0) - m.mise}</b>
        </span>
      )}
      <div className="bj-joueur">
        <Avatar photo={siege.photo} taille={moi ? 46 : 38} cadre={siege.cadre} />
        <span className="bj-pseudo">{siege.pseudo}</span>
        {(m?.mise ?? siege.mise) > 0 && <span className="bj-mise"><span className="piece-or" aria-hidden="true" />{m?.mise ?? siege.mise}</span>}
      </div>
    </div>
  );
}

export function CarteBJ({ carte, retard = 0 }: { carte: string | null; retard?: number }) {
  if (!carte) return <span className="bj-carte dos" aria-label="Carte cachée" />;
  const c = couleurDe(carte), r = rangDe(carte);
  const rouge = c === 'coeur' || c === 'carreau';
  return (
    <span className={`bj-carte ${rouge ? 'rouge' : 'noire'}`} style={{ animationDelay: `${retard}s` }} aria-label={`${r} de ${c}`}>
      <b>{r}</b><i>{SYMBOLES[c]}</i><em>{SYMBOLES[c]}</em>
    </span>
  );
}

/** L'heure, rafraîchie 4 fois par seconde (minuteries). */
function useHorloge() {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => { const i = setInterval(() => setT(Date.now()), 250); return () => clearInterval(i); }, []);
  return useMemo(() => t, [t]);
}
