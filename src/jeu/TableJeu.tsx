// Écran de jeu final (paysage) : décor, table ronde dorée, adversaires en arc, main en éventail,
// glisser vers l'arène, fenêtres parchemin, animations et phrases rapides.
// Ce composant ne parle pas au serveur : il reçoit la partie et renvoie les intentions du joueur.
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE, type ReactNode } from 'react';
import type { VueJeu, MembreSalon } from '../lib/jeu.ts';
import type { VuePrivee } from '../engine/vues.ts';
import { carteParId, NOMS_PIRATES, COULEURS } from '../engine/cards.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { debloquerSon, son, vibrer } from '../lib/sons.ts';

export const REVELATION_MS = 2500;
export const GAGNANT_MS = 2000;
const DISTANCE_GLISSER = 70;

export interface PropsTable {
  vue: VueJeu;
  main: VuePrivee;
  membres: MembreSalon[];
  moi: string;
  hote: string;
  enCours: boolean;
  erreur: string | null;
  bulle: { de: string; texte: string; cle: number } | null;
  phrases: string[];
  envoyer: (coup: Record<string, unknown>) => Promise<boolean> | void;
  envoyerPhrase: (texte: string) => void;
  quitter: () => void;
  exclure: (joueur: string) => void;
  retourAccueil: () => void;
  /** Pour les captures d'écran de test : force l'état d'affichage du pli. */
  etapeForcee?: 'aucune' | 'revelation' | 'gagnant';
  decompteDesactive?: boolean;
}

/** Ordre de tri de la main : par couleur, puis par valeur, spéciales à part. */
function rangCarte(id: string): number {
  const c = carteParId(id);
  if (c.type === 'numero') return COULEURS.indexOf(c.couleur) * 100 + c.valeur;
  const ordre = ['fuite', 'butin', 'tigresse', 'pirate', 'sirene', 'skull_king', 'kraken', 'baleine'];
  return 1000 + ordre.indexOf(c.type) * 10 + (c.type === 'pirate' ? id.length : 0);
}

export function TableJeu(p: PropsTable) {
  const { vue, main, membres, moi } = p;
  const [etapePli, setEtapePli] = useState<'aucune' | 'revelation' | 'gagnant'>('aucune');
  const [decompte, setDecompte] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [glisse, setGlisse] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [tigresse, setTigresse] = useState(false);
  const [defausse, setDefausse] = useState<string[]>([]);
  const [chatOuvert, setChatOuvert] = useState(false);
  const [scoresOuverts, setScoresOuverts] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [confirmQuitter, setConfirmQuitter] = useState(false);
  const [effet, setEffet] = useState<null | 'skull' | 'kraken' | 'baleine'>(null);
  const [distribution, setDistribution] = useState(0);
  const [carteEnVol, setCarteEnVol] = useState<string | null>(null);
  const [voirDernierPli, setVoirDernierPli] = useState(false);
  const [muets, setMuets] = useState<string[]>([]);
  const [juanitaFermee, setJuanitaFermee] = useState<string | null>(null);
  const mancheVue = useRef(0);
  const pliVu = useRef(0);
  const appui = useRef<{ id: string; x: number; y: number; t: number; minuterie: number } | null>(null);
  const tourPrecedent = useRef<string | null>(null);

  const infos = useMemo(() => new Map(membres.map((m) => [m.joueur_id, m])), [membres]);
  const pseudo = (id: string) => infos.get(id)?.pseudo ?? 'Pirate';
  const photo = (id: string) => infos.get(id)?.photo_url ?? null;
  const piloteParRobot = (j: string) => vue.robots?.includes(j) || vue.remplaces?.includes(j);
  const finie = vue.phase === 'fin_partie' || vue.annulee;

  // ---------- Décompte de 3 s au début de chaque manche ----------
  useEffect(() => {
    if (p.decompteDesactive || vue.manche === mancheVue.current) return;
    mancheVue.current = vue.manche;
    setDecompte(4); // 3, 2, 1, « À l'abordage ! »
    setDistribution((d) => d + 1);
  }, [vue.manche, p.decompteDesactive]);
  useEffect(() => {
    if (decompte <= 0) return;
    if (decompte > 1) son.decompte(); else son.abordage();
    const t = setTimeout(() => setDecompte((d) => d - 1), decompte === 1 ? 800 : 900);
    return () => clearTimeout(t);
  }, [decompte]);

  // ---------- Fin de pli : 2,5 s pour voir la dernière carte, puis 2 s sur le gagnant ----------
  const clePli = vue.dernierPli ? vue.numeroPli + vue.manche * 100 : 0;
  useEffect(() => {
    if (!clePli || clePli === pliVu.current) return;
    pliVu.current = clePli;
    setEtapePli('revelation');
    const r = vue.dernierPli?.resultat;
    const t0 = setTimeout(() => {
      if (r?.effet === 'kraken') { setEffet('kraken'); son.kraken(); }
      else if (r?.effet === 'baleine') { setEffet('baleine'); son.baleine(); }
      else if (r?.gagnant && vue.dernierPli && r.indexGagnant !== null &&
        carteParId(vue.dernierPli.cartes[r.indexGagnant].carteId).type === 'skull_king') { setEffet('skull'); son.skull(); }
      else son.pli();
    }, REVELATION_MS - 200);
    const t1 = setTimeout(() => setEtapePli('gagnant'), REVELATION_MS);
    const t2 = setTimeout(() => { setEtapePli('aucune'); setEffet(null); }, REVELATION_MS + GAGNANT_MS);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); setEtapePli('aucune'); setEffet(null); };
  }, [clePli]);

  const etape = p.etapeForcee ?? etapePli;
  const pliAffiche = etape !== 'aucune';
  const aMoi = vue.joueurActif === moi && !pliAffiche && decompte === 0 && !piloteParRobot(moi) && !carteEnVol;

  // Son + vibration quand c'est mon tour
  useEffect(() => {
    if (aMoi && tourPrecedent.current !== `${vue.manche}-${vue.numeroPli}`) {
      tourPrecedent.current = `${vue.manche}-${vue.numeroPli}`;
      son.tour();
      vibrer(80);
    }
  }, [aMoi, vue.manche, vue.numeroPli]);

  // Son quand une carte est posée
  const nbPoses = vue.pliEnCours.length;
  const dernierPoseur = vue.pliEnCours.at(-1)?.joueur;
  useEffect(() => { if (nbPoses > 0 && dernierPoseur !== moi) son.carte(); }, [nbPoses, dernierPoseur, moi]);

  useEffect(() => { setDefausse([]); }, [vue.pouvoir?.type, vue.numeroPli]);

  const cleJuanita = main.revelationJuanita ? `${vue.manche}-${vue.numeroPli}` : null;
  useEffect(() => {
    if (!cleJuanita) return;
    const t = setTimeout(() => setJuanitaFermee(cleJuanita), 15000);
    return () => clearTimeout(t);
  }, [cleJuanita]);
  useEffect(() => { if (!aMoi) setSelection(null); }, [aMoi]);

  // ---------- Places autour de la table ----------
  const autres = useMemo(() => {
    const i = vue.joueurs.indexOf(moi);
    return Array.from({ length: vue.joueurs.length - 1 }, (_, k) => vue.joueurs[(i + 1 + k) % vue.joueurs.length]);
  }, [vue.joueurs, moi]);
  const positions = useMemo(() => {
    const pos = new Map<string, { x: number; y: number }>();
    const k = autres.length;
    autres.forEach((j, idx) => {
      // de la gauche (180°) au droite (360°) en passant par le haut, dans le sens des aiguilles d'une montre
      // à beaucoup de joueurs, l'arc descend un peu sur les côtés pour laisser de la place à chacun
      const extra = k >= 5 ? 0.3 : k >= 3 ? 0.1 : 0;
      const angle = Math.PI - extra + ((idx + 1) * (Math.PI + 2 * extra)) / (k + 1);
      pos.set(j, { x: 50 + 46 * Math.cos(angle), y: 56 + 46 * Math.sin(angle) });
    });
    pos.set(moi, { x: 50, y: 100 });
    return pos;
  }, [autres, moi]);
  const tailleAvatar = autres.length <= 3 ? 74 : autres.length <= 5 ? 62 : 52;

  // ---------- Pli affiché ----------
  const pliServeur = pliAffiche && vue.dernierPli ? vue.dernierPli.cartes : vue.pliEnCours;
  // La carte que je viens de lancer apparaît tout de suite sur la table, sans attendre le serveur.
  const pliMontre = carteEnVol && !pliServeur.some((c) => c.carteId === carteEnVol)
    ? [...pliServeur, { joueur: moi, carteId: carteEnVol }]
    : pliServeur;
  const resultat = pliAffiche && etape === 'gagnant' ? vue.dernierPli?.resultat ?? null : null;
  const cible = resultat?.gagnant ? positions.get(resultat.gagnant) : null;

  function styleCartePli(joueur: string, index: number): CSSProperties {
    const pos = positions.get(joueur) ?? { x: 50, y: 100 };
    const cx = 50, cy = 50;
    // Point de départ du lancer : la place du joueur (convertie du repère de l'arène vers celui de la table).
    const depart = joueur === moi ? { x: 50, y: 135 } : { x: ((pos.x - 9) / 82) * 100, y: ((pos.y - 9) / 91) * 100 };
    let x = cx + (pos.x - cx) * 0.55;
    let y = cy + (pos.y - cy) * 0.55;
    if (joueur === moi) { x = 50; y = 66; }
    const rot = ((index * 37) % 13) - 6;
    if (cible && etape === 'gagnant') {
      // le pli glisse doucement vers le gagnant
      x = x + (cible.x - x) * 0.25;
      y = y + (cible.y - y) * 0.25;
    }
    return {
      left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)`, zIndex: 10 + index,
      ['--depart-x' as string]: `${depart.x}%`, ['--depart-y' as string]: `${depart.y}%`, ['--rot' as string]: `${rot}deg`,
    };
  }

  // ---------- Main ----------
  const mainTriee = useMemo(
    () => main.main.filter((id) => id !== carteEnVol).sort((a, b) => rangCarte(a) - rangCarte(b)),
    [main.main, carteEnVol],
  );
  // Le serveur a confirmé (la carte a quitté ma main) : plus besoin de l'affichage anticipé.
  useEffect(() => { if (carteEnVol && !main.main.includes(carteEnVol)) setCarteEnVol(null); }, [main.main, carteEnVol]);
  const pouvoirMoi = vue.phase === 'pouvoir' && vue.pouvoir?.joueur === moi && !pliAffiche ? vue.pouvoir : null;
  const modeDefausse = pouvoirMoi?.type === 'bendt';

  function jouerCarte(id: string) {
    if (!aMoi || !main.jouables.includes(id)) return;
    setSelection(null);
    if (carteParId(id).type === 'tigresse') return setTigresse(true);
    lancer({ type: 'jouer', carteId: id }, id);
  }

  async function lancer(coup: Record<string, unknown>, id: string) {
    setCarteEnVol(id);
    son.carte();
    const ok = await p.envoyer(coup);
    if (ok === false) setCarteEnVol(null); // refusé : la carte revient dans la main
  }

  function surAppui(e: PE<HTMLButtonElement>, id: string) {
    debloquerSon();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const minuterie = window.setTimeout(() => { setZoom(id); appui.current = null; setGlisse(null); }, 480);
    appui.current = { id, x: e.clientX, y: e.clientY, t: Date.now(), minuterie };
  }
  function surDeplacement(e: PE<HTMLButtonElement>) {
    const a = appui.current;
    if (!a) return;
    const dx = e.clientX - a.x, dy = e.clientY - a.y;
    if (Math.hypot(dx, dy) > 8) clearTimeout(a.minuterie);
    if (aMoi && main.jouables.includes(a.id) && dy < -10) setGlisse({ id: a.id, dx, dy });
  }
  function surRelache(e: PE<HTMLButtonElement>) {
    const a = appui.current;
    appui.current = null;
    if (!a) return;
    clearTimeout(a.minuterie);
    const dy = e.clientY - a.y, dx = e.clientX - a.x;
    setGlisse(null);
    if (modeDefausse) {
      if (Math.hypot(dx, dy) < 12) {
        setDefausse((d) => (d.includes(a.id) ? d.filter((x) => x !== a.id) : d.length < (pouvoirMoi?.aDefausser ?? 0) ? [...d, a.id] : d));
      }
      return;
    }
    if (dy < -DISTANCE_GLISSER) return jouerCarte(a.id);
    if (Math.hypot(dx, dy) < 12) {
      // Toucher : sélectionne (la carte monte). Toucher à nouveau une carte déjà levée la joue.
      if (selection === a.id) jouerCarte(a.id);
      else setSelection(a.id);
    }
  }

  // Disposition en éventail
  const n = mainTriee.length;
  const ecart = Math.min(64, 620 / Math.max(n, 1));
  const angleMax = Math.min(28, n * 3.2);

  const classement = [...vue.joueurs].sort((a, b) => vue.scores[b] - vue.scores[a]);
  const miseDe = (j: string) => (vue.mises ? vue.mises[j] + (vue.harry[j] ?? 0) : null);

  // Petits badges sur l'avatar : alliance de Butin (avec qui) et pari de Rascal.
  function Badges({ j }: { j: string }) {
    const allies = vue.alliances.filter(([a, b]) => a === j || b === j).map(([a, b]) => (a === j ? b : a));
    const pari = vue.rascal?.[j] ?? 0;
    if (allies.length === 0 && !pari) return null;
    return (
      <span className="adv-badges">
        {allies.length > 0 && <span title={`Alliance avec ${allies.map(pseudo).join(', ')}`}>🤝 {allies.map(pseudo).join(', ')}</span>}
        {pari > 0 && <span title="Pari de Rascal">🎲 {pari}</span>}
      </span>
    );
  }

  // ---------- Rendu ----------
  return (
    <div className="jeu" onPointerDown={debloquerSon}>
      <div className="jeu-decor" />
      <div className="jeu-fumee" />

      {/* Barre du haut */}
      <img className="jeu-logo" src="/decor/logo.webp" alt="Skull Arena" />
      <nav className="jeu-rail" aria-label="Informations de la partie">
        <div className="rail-pastille" aria-label={`Manche ${vue.manche} sur 10`}>
          <small>Manche</small>
          <strong>{vue.manche}<em>/10</em></strong>
        </div>
        <div className="rail-pastille rail-mise" aria-label="Ma mise">
          <small>⚔ Mise</small>
          <strong>{miseDe(moi) ?? (vue.aMise[moi] ? '✓' : '?')}</strong>
        </div>
        <button type="button" className="rail-rond" onClick={() => setScoresOuverts(true)} aria-label="Scores">📊</button>
        <button type="button" className="rail-rond" onClick={() => setMenuOuvert((m) => !m)} aria-label="Réglages">⚙</button>
        {menuOuvert && (
          <div className="jeu-menu">
            {!finie && <button type="button" onClick={() => { setMenuOuvert(false); setConfirmQuitter(true); }}>Quitter la partie</button>}
            <button type="button" onClick={() => setMenuOuvert(false)}>Fermer</button>
          </div>
        )}
      </nav>

      {/* Table */}
      <section className="jeu-arene">
        <div className={`jeu-table ${effet ? `effet-${effet}` : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget && !pliAffiche && vue.dernierPli) setVoirDernierPli(true); }}>
          <div className="jeu-table-boussole" />
          {pliMontre.map((c, i) => (
            <figure key={`${vue.manche}-${c.carteId}`} className={`carte-pli ${resultat && resultat.indexGagnant === i ? 'gagnante' : ''} ${resultat && resultat.indexGagnant !== i ? 'perdante' : ''}`}
              style={styleCartePli(c.joueur, i)} onClick={() => (!pliAffiche && vue.dernierPli && vue.pliEnCours.length === 0 ? setVoirDernierPli(true) : setZoom(c.carteId))}>
              <img src={`/cartes/${c.carteId}.webp`} alt="" draggable={false} />
              {c.tigresse && <span className="etiquette-tigresse">{c.tigresse === 'pirate' ? 'Pirate' : 'Fuite'}</span>}
            </figure>
          ))}
          {resultat && (
            <p className="annonce-pli">
              {resultat.effet === 'kraken' ? '🐙 Le Kraken engloutit le pli !'
                : resultat.gagnant ? <>{pseudo(resultat.gagnant)} remporte le pli{resultat.bonus ? <strong> +{resultat.bonus}</strong> : null}</>
                : '🐋 La Baleine blanche disperse le pli !'}
            </p>
          )}
          {!pliAffiche && vue.phase === 'jeu' && pliMontre.length === 0 && (
            <p className="indice-table">
              {aMoi ? 'À toi d’ouvrir le pli !' : `${pseudo(vue.joueurActif ?? '')} ouvre le pli…`}
              {vue.dernierPli && <small>Touche la table pour revoir le dernier pli</small>}
            </p>
          )}
          {vue.juanitaRegarde && vue.juanitaRegarde !== moi && (
            <p className="indice-table bas">🔮 {pseudo(vue.juanitaRegarde)} consulte les cartes non distribuées…</p>
          )}
        </div>

        {/* Adversaires */}
        {autres.map((j) => {
          const pos = positions.get(j)!;
          const actif = vue.joueurActif === j && !pliAffiche;
          const nbCartes = vue.cartesEnMain[j] ?? 0;
          return (
            <div key={j} className={`adversaire ${actif ? 'actif' : ''}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }}>
              <div className="adv-dos" aria-hidden="true">
                {Array.from({ length: Math.min(nbCartes, 6) }, (_, k) => (
                  <img key={k} src="/decor/dos-carte.webp" alt="" style={{ transform: `rotate(${(k - Math.min(nbCartes, 6) / 2) * 9}deg)` }} />
                ))}
              </div>
              <div className="adv-avatar">
                {vue.joueurs.indexOf(j) === vue.couronne && <span className="adv-couronne">👑</span>}
                <Avatar photo={photo(j)} taille={tailleAvatar} alt={pseudo(j)} />
                {vue.mises && <span className="adv-ruban">{vue.plisGagnes[j]}/{miseDe(j)}</span>}
                <Badges j={j} />
                {!vue.mises && vue.phase === 'mise' && <span className={`adv-ruban ${vue.aMise[j] ? 'ok' : 'attente'}`}>{vue.aMise[j] ? '✓' : '…'}</span>}
              </div>
              <div className="adv-nom">
                <span className="adv-medaillon">☠</span>
                <span>{pseudo(j)}</span>
              </div>
              {vue.remplaces?.includes(j) && <span className="adv-robot">🤖 robot</span>}
              {p.hote === moi && !vue.robots?.includes(j) && !vue.definitifs?.includes(j) && !finie && (
                <button type="button" className="adv-exclure" aria-label={`Exclure ${pseudo(j)}`}
                  onClick={() => { if (confirm(`Exclure ${pseudo(j)} ? Un robot finira la partie à sa place.`)) p.exclure(j); }}>✕</button>
              )}
            </div>
          );
        })}

        {/* Bulle de phrase rapide, au centre */}
        {p.bulle && !muets.includes(p.bulle.de) && (
          <div className="bulle-phrase" key={p.bulle.cle}>
            <strong>{pseudo(p.bulle.de)}</strong>
            <span>« {p.bulle.texte} »</span>
          </div>
        )}
      </section>

      {/* Mon coin : avatar, ruban, statut */}
      <div className={`moi-coin ${aMoi ? 'actif' : ''}`}>
        <Avatar photo={photo(moi)} taille={56} />
        <span className="adv-ruban">{vue.mises ? `${vue.plisGagnes[moi]}/${miseDe(moi)}` : vue.aMise[moi] ? '✓' : '…'}</span>
        <Badges j={moi} />
        {vue.joueurs.indexOf(moi) === vue.couronne && <span className="adv-couronne">👑</span>}
      </div>

      {/* Ma main */}
      <section className={`main-eventail ${distribution ? 'distribuee' : ''}`} key={`main-${distribution}`}>
        {mainTriee.map((id, i) => {
          const centre = (n - 1) / 2;
          const angle = n > 1 ? ((i - centre) / centre) * angleMax : 0;
          const jouable = aMoi && main.jouables.includes(id);
          const interdite = aMoi && !jouable;
          const levee = selection === id || defausse.includes(id);
          const g = glisse?.id === id ? glisse : null;
          const style: CSSProperties = {
            left: `calc(50% + ${(i - centre) * ecart}px)`,
            transform: g
              ? `translate(calc(-50% + ${g.dx}px), ${g.dy - 30}px) rotate(0deg) scale(1.08)`
              : `translate(-50%, ${levee ? -34 : Math.abs(i - centre) * 3}px) rotate(${angle}deg)`,
            zIndex: g ? 100 : levee ? 60 : i,
            animationDelay: `${i * 70}ms`,
          };
          return (
            <button key={id} type="button" className={`carte-main ${jouable ? 'jouable' : ''} ${interdite ? 'interdite' : ''} ${levee ? 'levee' : ''} ${g ? 'glissee' : ''} ${defausse.includes(id) ? 'a-defausser' : ''}`}
              style={style} onPointerDown={(e) => surAppui(e, id)} onPointerMove={surDeplacement} onPointerUp={surRelache}
              onPointerCancel={() => { if (appui.current) clearTimeout(appui.current.minuterie); appui.current = null; setGlisse(null); }}
              onContextMenu={(e) => e.preventDefault()}>
              <img src={`/cartes/${id}.webp`} alt={id} draggable={false} />
            </button>
          );
        })}
      </section>

      {aMoi && !tigresse && (
        <p className="aide-geste">
          <span className="fleches">⌃⌃</span>
          {selection ? 'Glisse-la vers l’arène, ou touche-la encore pour la jouer' : 'Glisse ta carte vers l’arène pour la jouer'}
        </p>
      )}
      {!aMoi && !pliAffiche && vue.phase === 'jeu' && vue.joueurActif && vue.joueurActif !== moi && pliMontre.length > 0 && (
        <p className="aide-geste discret">Au tour de {pseudo(vue.joueurActif)}…</p>
      )}

      {/* Phrases rapides */}
      <button type="button" className="bouton-bulle" onClick={() => setChatOuvert((c) => !c)} aria-label="Phrases rapides">💬</button>
      {chatOuvert && (
        <div className="panneau-phrases">
          {p.phrases.map((t) => (
            <button key={t} type="button" onClick={() => { p.envoyerPhrase(t); setChatOuvert(false); }}>{t}</button>
          ))}
          {autres.some((j) => !vue.robots?.includes(j)) && (
            <div className="couper">
              <small>Couper les phrases de :</small>
              {autres.filter((j) => !vue.robots?.includes(j)).map((j) => (
                <button key={j} type="button" className={muets.includes(j) ? 'coupe' : ''}
                  onClick={() => setMuets((m) => (m.includes(j) ? m.filter((x) => x !== j) : [...m, j]))}>
                  {muets.includes(j) ? '🔇' : '🔈'} {pseudo(j)}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Bandeaux */}
      {vue.remplaces?.includes(moi) && !vue.definitifs?.includes(moi) && (
        <p className="bandeau">🤖 Un robot a joué pendant ton absence. Tu reprends la main au début de la prochaine manche.</p>
      )}
      {vue.definitifs?.includes(moi) && !finie && <p className="bandeau rouge">Un robot joue à ta place jusqu’à la fin de cette partie.</p>}
      {p.erreur && <p className="bandeau rouge">{p.erreur}</p>}

      {/* Fenêtre de mise */}
      {vue.phase === 'mise' && decompte === 0 && !vue.aMise[moi] && !piloteParRobot(moi) && (
        <Fenetre titre="Combien de plis vas-tu gagner ?" transparente>
          <div className="boutons-mise">
            {Array.from({ length: vue.cartesParJoueur + 1 }, (_, k) => (
              <button key={k} type="button" className="bouton-mise" disabled={p.enCours} onClick={() => p.envoyer({ type: 'miser', mise: k })}>{k}</button>
            ))}
          </div>
          <p className="petit-texte centre">Manche {vue.manche} · {vue.cartesParJoueur} carte{vue.cartesParJoueur > 1 ? 's' : ''} en main</p>
        </Fenetre>
      )}
      {vue.phase === 'mise' && decompte === 0 && vue.aMise[moi] && (
        <p className="aide-geste discret">Mise verrouillée · en attente des autres pirates…</p>
      )}

      {/* Pouvoirs */}
      {!pliAffiche && vue.phase === 'pouvoir' && vue.pouvoir && !pouvoirMoi && (
        <p className="aide-geste discret">{NOMS_PIRATES[vue.pouvoir.type]} · {pseudo(vue.pouvoir.joueur)} choisit…</p>
      )}
      {pouvoirMoi?.type === 'rosie' && (
        <Fenetre titre="Rosie de Laney" sousTitre="Choisis qui commence le prochain pli">
          <div className="boutons-mise">
            {vue.joueurs.map((j) => (
              <button key={j} type="button" className="bouton-or petit" disabled={p.enCours} onClick={() => p.envoyer({ type: 'rosie', choix: j })}>{j === moi ? 'Moi' : pseudo(j)}</button>
            ))}
          </div>
        </Fenetre>
      )}
      {pouvoirMoi?.type === 'rascal' && (
        <Fenetre titre="Rascal de Roatan" sousTitre="Ton pari : gagné si ta mise est exacte, perdu sinon">
          <div className="boutons-mise">
            {[0, 10, 20].map((x) => (
              <button key={x} type="button" className="bouton-mise large" disabled={p.enCours} onClick={() => p.envoyer({ type: 'rascal', pari: x })}>{x} pts</button>
            ))}
          </div>
        </Fenetre>
      )}
      {pouvoirMoi?.type === 'bendt' && (
        <Fenetre titre="Bendt le Bandit" sousTitre={`Tu as pioché ${pouvoirMoi.aDefausser} carte${pouvoirMoi.aDefausser > 1 ? 's' : ''}. Touche celles à défausser dans ta main (${defausse.length}/${pouvoirMoi.aDefausser}).`} transparente>
          <button type="button" className="bouton-or" disabled={p.enCours || defausse.length !== pouvoirMoi.aDefausser}
            onClick={() => p.envoyer({ type: 'bendt', defausse })}>Défausser</button>
        </Fenetre>
      )}
      {!pliAffiche && vue.phase === 'harry' && vue.harryEnAttente.includes(moi) && (
        <Fenetre titre="Harry le Géant" sousTitre={`Tu as gagné ${vue.plisGagnes[moi]} pli(s) pour une mise de ${miseDe(moi)}. Modifie ta mise ?`}>
          <div className="boutons-mise">
            {[-1, 0, 1].map((a) => (
              <button key={a} type="button" className="bouton-mise large" disabled={p.enCours || (miseDe(moi) ?? 0) + a < 0}
                onClick={() => p.envoyer({ type: 'harry', ajustement: a })}>{a > 0 ? '+1' : a < 0 ? '−1' : 'Garder'}</button>
            ))}
          </div>
        </Fenetre>
      )}
      {!pliAffiche && vue.phase === 'harry' && !vue.harryEnAttente.includes(moi) && <p className="aide-geste discret">Harry le Géant réfléchit…</p>}

      {main.revelationJuanita && !pliAffiche && juanitaFermee !== cleJuanita && (
        <Fenetre titre="Juanita Jade" sousTitre="Les cartes non distribuées, pour tes yeux seulement (15 secondes)">
          <div className="mini-cartes">{main.revelationJuanita.map((c) => <img key={c} src={`/cartes/${c}.webp`} alt={c} />)}</div>
          <button type="button" className="bouton-or" onClick={() => setJuanitaFermee(cleJuanita)}>J’ai vu</button>
        </Fenetre>
      )}

      {tigresse && (
        <Fenetre titre="Tigresse" sousTitre="Comment la joues-tu ?">
          <div className="boutons-mise">
            <button type="button" className="bouton-or petit" onClick={() => { setTigresse(false); lancer({ type: 'jouer', carteId: 'tigresse', tigresse: 'pirate' }, 'tigresse'); }}>En Pirate</button>
            <button type="button" className="bouton-sombre petit-rond" onClick={() => { setTigresse(false); lancer({ type: 'jouer', carteId: 'tigresse', tigresse: 'fuite' }, 'tigresse'); }}>En Fuite</button>
          </div>
          <button type="button" className="lien" onClick={() => setTigresse(false)}>Annuler</button>
        </Fenetre>
      )}

      {/* Fin de manche / partie */}
      {!pliAffiche && !vue.annulee && vue.phase === 'fin_manche' && (
        <Fenetre titre={`Fin de la manche ${vue.manche}`} large>
          <TableauManche vue={vue} classement={classement} moi={moi} pseudo={pseudo} />
          {vue.continuer.includes(moi) || piloteParRobot(moi)
            ? <p className="centre petit-texte">En attente des autres pirates…</p>
            : <button type="button" className="bouton-or" disabled={p.enCours} onClick={() => p.envoyer({ type: 'continuer' })}>Continuer</button>}
        </Fenetre>
      )}
      {!pliAffiche && !vue.annulee && vue.phase === 'fin_partie' && (
        <Fenetre titre="Fin de la partie" large>
          <div className="podium">
            {[1, 0, 2].map((rang) => {
              const j = classement[rang];
              if (!j) return <div key={rang} />;
              return (
                <div key={j} className={`marche marche-${rang + 1}`}>
                  {rang === 0 && <span className="podium-couronne">👑</span>}
                  <Avatar photo={photo(j)} taille={rang === 0 ? 84 : 64} />
                  <strong>{pseudo(j)}</strong>
                  <span>{vue.scores[j]} pts</span>
                  <div className="socle">{rang + 1}</div>
                </div>
              );
            })}
          </div>
          <button type="button" className="bouton-or" onClick={p.retourAccueil}>Retour au port</button>
        </Fenetre>
      )}
      {vue.annulee && (
        <Fenetre titre="Partie annulée" sousTitre="Plus aucun pirate humain à bord : cette partie ne compte pas.">
          <button type="button" className="bouton-or" onClick={p.retourAccueil}>Retour au port</button>
        </Fenetre>
      )}

      {/* Tableau des scores complet */}
      {scoresOuverts && (
        <div className="voile" onClick={() => setScoresOuverts(false)}>
          <section className="parchemin fenetre fenetre-large" onClick={(e) => e.stopPropagation()}>
            <h2 className="titre-pirate">Tableau des scores</h2>
            <div className="defile-x">
              <table className="scores scores-complets">
                <thead>
                  <tr><th>Pirate</th>{Array.from({ length: 10 }, (_, k) => <th key={k}>{k + 1}</th>)}<th>Total</th></tr>
                </thead>
                <tbody>
                  {classement.map((j) => (
                    <tr key={j} className={j === moi ? 'moi' : ''}>
                      <td>{pseudo(j)}</td>
                      {Array.from({ length: 10 }, (_, k) => {
                        const r = vue.historique[k]?.find((x) => x.joueur === j);
                        return <td key={k} className={r ? (r.total >= 0 ? 'positif' : 'negatif') : ''}>{r ? r.total : ''}</td>;
                      })}
                      <td><strong>{vue.scores[j]}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="bouton-sombre" onClick={() => setScoresOuverts(false)}>Fermer</button>
          </section>
        </div>
      )}

      {confirmQuitter && (
        <Fenetre titre="Quitter la partie ?" sousTitre={vue.entrainement ? 'Ta partie d’entraînement sera abandonnée.' : 'Quitter = défaite. Un robot finira la partie à ta place. Tu es sûr ?'}>
          <button type="button" className="bouton-danger" onClick={p.quitter}>Oui, je quitte</button>
          <button type="button" className="lien" onClick={() => setConfirmQuitter(false)}>Non, je reste</button>
        </Fenetre>
      )}

      {voirDernierPli && vue.dernierPli && (
        <div className="voile" onClick={() => setVoirDernierPli(false)}>
          <section className="parchemin fenetre fenetre-large" onClick={(e) => e.stopPropagation()}>
            <h2 className="titre-pirate">Dernier pli</h2>
            <div className="dernier-pli">
              {vue.dernierPli.cartes.map((c, i) => (
                <figure key={c.carteId} className={vue.dernierPli!.resultat.indexGagnant === i ? 'gagnante' : ''}>
                  <img src={`/cartes/${c.carteId}.webp`} alt={c.carteId} />
                  <figcaption>{pseudo(c.joueur)}{c.tigresse ? ` (${c.tigresse})` : ''}</figcaption>
                </figure>
              ))}
            </div>
            <p className="centre">
              {vue.dernierPli.resultat.effet === 'kraken' ? 'Le Kraken a englouti ce pli.'
                : vue.dernierPli.resultat.gagnant ? `${pseudo(vue.dernierPli.resultat.gagnant)} a remporté ce pli.`
                : 'La Baleine blanche a dispersé ce pli.'}
            </p>
            <button type="button" className="bouton-sombre" onClick={() => setVoirDernierPli(false)}>Fermer</button>
          </section>
        </div>
      )}

      {/* Agrandissement d'une carte (appui long) */}
      {zoom && (
        <div className="voile zoom" onClick={() => setZoom(null)}>
          <img src={`/cartes/${zoom}.webp`} alt={zoom} />
        </div>
      )}

      {/* Décompte */}
      {decompte > 0 && (
        <div className="voile decompte" aria-live="polite">
          <span key={decompte} className={decompte === 1 ? 'abordage' : ''}>{decompte === 1 ? 'À l’abordage !' : decompte - 1}</span>
        </div>
      )}

      {/* Portrait : demander de tourner le téléphone */}
      <div className="tourne-telephone">
        <span className="icone-rotation">📱↻</span>
        <p>Tourne ton téléphone pour jouer</p>
      </div>
    </div>
  );
}

function Fenetre({ titre, sousTitre, children, large, transparente }: {
  titre: string; sousTitre?: string; children?: ReactNode; large?: boolean; transparente?: boolean;
}) {
  return (
    <div className={`voile ${transparente ? 'transparent' : ''}`}>
      <section className={`parchemin fenetre ${large ? 'fenetre-large' : ''}`}>
        <h2 className="titre-pirate">{titre}</h2>
        {sousTitre && <p className="centre petit-texte">{sousTitre}</p>}
        {children}
      </section>
    </div>
  );
}

function TableauManche({ vue, classement, moi, pseudo }: {
  vue: VueJeu; classement: string[]; moi: string; pseudo: (id: string) => string;
}) {
  const derniere = vue.historique.at(-1) ?? [];
  return (
    <table className="scores">
      <thead><tr><th>Pirate</th><th>Mise</th><th>Plis</th><th>Bonus</th><th>Manche</th><th>Total</th></tr></thead>
      <tbody>
        {classement.map((j) => {
          const r = derniere.find((x) => x.joueur === j);
          return (
            <tr key={j} className={j === moi ? 'moi' : ''}>
              <td>{pseudo(j)}</td>
              <td>{r?.mise}</td>
              <td>{r?.plis} {r?.reussie ? '✓' : ''}</td>
              <td>{r && r.bonus + r.alliances + r.rascal !== 0 ? `${r.bonus + r.alliances + r.rascal > 0 ? '+' : ''}${r.bonus + r.alliances + r.rascal}` : ''}</td>
              <td className={r && r.total >= 0 ? 'positif' : 'negatif'}>{r && r.total > 0 ? '+' : ''}{r?.total}</td>
              <td><strong>{vue.scores[j]}</strong></td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
