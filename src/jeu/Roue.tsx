// La Roue du Kraken (façon « Crazy Time ») : une roue publique partagée par tous les pirates.
// On pose ses jetons sur les cases pendant 15 s, la Boussole peut multiplier une case, puis la roue tourne.
// Quatre mini-jeux : Pièce maudite, Abysses (boulet qui tombe), Chasse au trésor (on choisit une croix),
// Tempête du Kraken (roue géante, on choisit un drapeau).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Profil } from '../lib/profil.ts';
import { niveau as niveauDe } from '../lib/profil.ts';
import { appelRoue, useRoue } from '../lib/roue.ts';
import { JETONS } from '../lib/blackjack.ts';
import {
  CASES, caseDrapeau, DELAI_ABYSSES_CHUTE, DELAI_BOUSSOLE, DELAI_MISES, DELAI_CHOIX, DRAPEAUX, estBonus, miseMaxRoue, NIVEAU_SANS_LIMITE,
  multBonus, NOMS_ZONES, ZONES, type Drapeau, type EtatBonus, type EtatRoue, type Zone,
} from '../engine/roue.ts';
import { EcranAttente } from '../composants/Attente.tsx';
import { Avatar } from '../composants/Avatar.tsx';
import { debloquerSon, son } from '../lib/sons.ts';
import { supabase } from '../lib/supabase.ts';
import { useBloques } from '../lib/social.ts';
import './roue.css';

/** Couleur de chaque case (roue et plateau). */
/** Couleurs sombres, façon bois et velours de navire. */
export const COULEURS: Record<Zone, string> = {
  '1': '#1a2c4e', '2': '#5a4114', '5': '#5a121e', '10': '#34184f',
  piece: '#5e2e0e', abysses: '#0b3a44', chasse: '#3f2a14', tempete: '#0a0c16',
};
/** Couleur vive de chaque case, pour les néons et les reflets. */
export const NEONS: Record<Zone, string> = {
  '1': '#4f8dff', '2': '#e8b54a', '5': '#ff4a5e', '10': '#b06bff',
  piece: '#ff9a3d', abysses: '#2fd3e8', chasse: '#d9a45a', tempete: '#c9952e',
};
/** Image peinte de chaque case : un doublon pour les nombres, un médaillon pour les mini-jeux. */
export const IMG_ZONE: Record<Zone, string> = {
  '1': '/img/roue_doublon_bronze.webp', '2': '/img/roue_doublon_argent.webp', '5': '/img/roue_doublon_or.webp', '10': '/img/roue_doublon_rubis.webp',
  piece: '/img/roue_case_piece.webp', abysses: '/img/roue_case_abysses.webp', chasse: '/img/roue_case_chasse.webp', tempete: '/img/roue_case_tempete.webp',
};
const COURTS: Record<Zone, string> = { '1': '1', '2': '2', '5': '5', '10': '10', piece: 'PIÈCE', abysses: 'ABYSSES', chasse: 'TRÉSOR', tempete: 'KRAKEN' };
const PAIE: Record<Zone, string> = { '1': 'paie 1:1', '2': 'paie 2:1', '5': 'paie 5:1', '10': 'paie 10:1', piece: '×2 à ×100', abysses: '×15 à ×200', chasse: '×5 à ×75', tempete: '×10 à ×200' };
const COULEUR_DRAPEAU: Record<Drapeau, string> = { rouge: '#e0343f', bleu: '#2f7be8', or: '#f2c14e' };
const NOM_DRAPEAU: Record<Drapeau, string> = { rouge: 'Rouge', bleu: 'Bleu', or: 'Or' };
const ANGLE = 360 / CASES.length;
/** Ce que la Boussole donne sur une case : pour un nombre, son gain multiplié (5 ×5 = ×25) ; pour un mini-jeu, le bonus. */
const multBoussole = (z: Zone, m: number) => (estBonus(z) ? m : Number(z) * m);
const fmt = (n: number) => n.toLocaleString('fr-FR');
const somme = (z: Partial<Record<Zone, number>> | undefined) => Object.values(z ?? {}).reduce((s, v) => s + (v ?? 0), 0);

export function EcranRoue({ profil, retour, recharger }: { profil: Profil; retour: () => void; recharger: () => Promise<void> }) {
  const [id, setId] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  useEffect(() => {
    appelRoue<{ id: string }>('rejoindre').then((r) => setId(r.id)).catch((e) => setErreur((e as Error).message));
  }, []);
  if (erreur) {
    return (
      <main className="ecran rk-entree">
        <button type="button" className="retour" onClick={retour}>‹ Retour</button>
        <p className="erreur centre">{erreur}</p>
      </main>
    );
  }
  if (!id) return <EcranAttente texte="On lance la Roue du Kraken" decor="taverne" sous="Pose tes jetons, le Kraken fait tourner" />;
  return <TableRoue profil={profil} id={id} quitter={retour} recharger={recharger} />;
}

function TableRoue({ profil, id, quitter, recharger }: { profil: Profil; id: string; quitter: () => void; recharger: () => Promise<void> }) {
  const etat = useRoue(id);
  const rapide = etat?.phase === 'bonus' || etat?.phase === 'boussole';
  const maintenant = useHorloge(rapide);
  const [jeton, setJeton] = useState<number>(() => { try { return Number(localStorage.getItem('roue-jeton')) || 10; } catch { return 10; } });
  /** Ce que je crois avoir misé sur chaque case (affiché tout de suite, sans attendre le serveur). */
  const [local, setLocal] = useState<Partial<Record<Zone, number>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [chat, setChat] = useState(false);
  const [regles, setRegles] = useState(false);
  const [dernier, setDernier] = useState<Partial<Record<Zone, number>> | null>(() => {
    try { const v = JSON.parse(localStorage.getItem('roue-dernier') ?? 'null'); return v && somme(v) > 0 ? v : null; } catch { return null; }
  });
  const envoi = useRef<{ t: ReturnType<typeof setTimeout> | null; lot: Partial<Record<Zone, number>> }>({ t: null, lot: {} });
  const precedent = useRef<EtatRoue | null>(null);
  const niveau = profil.est_admin ? NIVEAU_SANS_LIMITE : niveauDe(profil.xp);
  const max = miseMaxRoue(niveau);

  const mesMises = etat?.mises[profil.id]?.zones ?? {};
  // On affiche le plus grand des deux : rien ne recule ni ne compte deux fois quand la réponse du serveur arrive.
  const mise = (z: Zone) => Math.max(mesMises[z] ?? 0, local[z] ?? 0);
  const totalMoi = ZONES.reduce((t, z) => t + mise(z), 0);
  /** Jetons posés mais pas encore débités. */
  const nonDebite = ZONES.reduce((t, z) => t + Math.max(0, (local[z] ?? 0) - (mesMises[z] ?? 0)), 0);

  // Sons, solde et « Rejouer » au fil des phases.
  useEffect(() => {
    if (!etat) return;
    const p = precedent.current;
    precedent.current = etat;
    if (!p) return;
    if (p.phase === 'mises' && etat.phase !== 'mises') {
      const m = p.mises[profil.id]?.zones;
      if (m && somme(m) > 0) { setDernier(m); try { localStorage.setItem('roue-dernier', JSON.stringify(m)); } catch { /* */ } }
    }
    if (p.phase !== 'tour' && etat.phase === 'tour') son.tour();
    if (p.phase === 'tour' && etat.phase === 'bonus') son.abordage();
    if (p.phase !== 'resultats' && etat.phase === 'resultats') {
      const g = etat.gains[profil.id] ?? 0;
      if (g > 0) { son.fanfare(); son.piece(); }
      setTimeout(() => { recharger(); }, 400);
    }
  }, [etat, profil.id, recharger]);

  // Dès que les mises ferment, mes jetons « locaux » laissent la place à ceux du serveur.
  useEffect(() => {
    if (etat && etat.phase !== 'mises' && etat.phase !== 'attente') setLocal({});
  }, [etat?.phase, etat?.manche]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filet de sécurité : si une minuterie a expiré sans que le serveur avance, on le relance.
  useEffect(() => {
    if (!etat?.echeance) return;
    const t = setTimeout(() => appelRoue('avancer', { table_id: id }).catch(() => {}), Math.max(0, etat.echeance - Date.now() + 2500));
    return () => clearTimeout(t);
  }, [etat?.echeance, id]);

  if (!etat) return <EcranAttente texte="La roue se prépare" decor="taverne" />;

  const restant = etat.echeance ? Math.max(0, etat.echeance - maintenant) : 0;
  const misesOuvertes = etat.phase === 'attente' || (etat.phase === 'mises' && restant > 1200) || (etat.phase === 'resultats' && restant === 0);

  /** Pose le jeton choisi sur une case ; les jetons partent au serveur par petits paquets. */
  function poser(z: Zone) {
    debloquerSon();
    if (!misesOuvertes) { setMessage('Les mises sont fermées, attends le prochain tour.'); return; }
    const dispo = profil.louidors - nonDebite;
    const ajout = Math.min(jeton, dispo, max - mise(z));
    if (ajout <= 0) { setMessage(mise(z) >= max ? `Mise max à ton niveau : ${fmt(max)} par case` : 'Pas assez de Louidors'); return; }
    setMessage(null); son.piece();
    const nouveau = mise(z) + ajout;
    setLocal((l) => ({ ...l, [z]: Math.max(l[z] ?? 0, nouveau) }));
    const e = envoi.current;
    e.lot[z] = (e.lot[z] ?? 0) + ajout;
    if (e.t) clearTimeout(e.t);
    e.t = setTimeout(() => envoyerLot(), 350);
  }
  async function envoyerLot(lot?: Partial<Record<Zone, number>>) {
    const e = envoi.current;
    const paquet = lot ?? e.lot;
    if (!lot) { e.lot = {}; e.t = null; }
    if (somme(paquet) <= 0) return;
    if (lot) { const base = Object.fromEntries(ZONES.map((z) => [z, mise(z)])) as Record<Zone, number>; setLocal((l) => { const n = { ...l }; for (const [z, v] of Object.entries(paquet) as Array<[Zone, number]>) n[z] = Math.max(n[z] ?? 0, base[z] + v); return n; }); }
    try { await appelRoue('miser', { table_id: id, zones: paquet }); recharger(); }
    catch (err) { setMessage((err as Error).message); setLocal((l) => retirer(l, paquet)); }
  }
  function rejouer() {
    if (!dernier) return;
    debloquerSon(); son.piece();
    const lot: Partial<Record<Zone, number>> = {};
    for (const [z, v] of Object.entries(dernier) as Array<[Zone, number]>) lot[z] = Math.min(v, max);
    envoyerLot(lot);
  }
  function doubler() {
    const actuel = Object.fromEntries(ZONES.map((z) => [z, mise(z)]).filter(([, v]) => (v as number) > 0)) as Partial<Record<Zone, number>>;
    const lot: Partial<Record<Zone, number>> = {};
    for (const [z, v] of Object.entries(actuel) as Array<[Zone, number]>) { const a = Math.min(v ?? 0, max - (v ?? 0)); if (a > 0) lot[z] = a; }
    if (somme(lot) > profil.louidors - nonDebite) { setMessage('Pas assez de Louidors pour doubler'); return; }
    debloquerSon(); son.piece();
    envoyerLot(lot);
  }
  async function toutRetirer() {
    setMessage(null);
    setLocal({});
    try { await appelRoue('retirer', { table_id: id }); recharger(); }
    catch (err) { setMessage((err as Error).message); }
  }
  const choisirJeton = (j: number) => { setJeton(j); try { localStorage.setItem('roue-jeton', String(j)); } catch { /* */ } };

  const presents = Object.values(etat.presents ?? {}).filter((t) => maintenant - t < 60000).length;
  const parieurs = Object.entries(etat.mises);
  const boussole = etat.boussole && etat.phase !== 'boussole' ? etat.boussole : null;
  const arretZone = etat.arret !== null ? CASES[etat.arret] : null;
  const total = etat.phase === 'mises' ? DELAI_MISES : etat.phase === 'boussole' ? DELAI_BOUSSOLE : etat.phase === 'bonus' ? DELAI_CHOIX : 7500;

  return (
    <div className="rk" onPointerDown={debloquerSon}>
      <div className="rk-fond" aria-hidden="true" />
      <header className="rk-haut">
        <button type="button" className="rk-rond" onClick={quitter} aria-label="Quitter la roue">‹</button>
        <div className="rk-titre"><img className="rk-logo" src="/img/roue_logo.webp" alt="Roue du Kraken" /><small>{presents} pirate{presents > 1 ? 's' : ''} à bord</small></div>
        <button type="button" className="rk-rond" onClick={() => setRegles(true)} aria-label="Règles">?</button>
        <button type="button" className="rk-rond" onClick={() => setChat(true)} aria-label="Écrire aux pirates"><img src="/img/jeu_chat.webp" alt="" /></button>
        <span className="rk-solde"><span className="piece-or" aria-hidden="true" />{fmt(profil.louidors)}</span>
      </header>

      <div className="rk-historique" aria-label="Derniers tirages">
        {etat.historique.length === 0 ? <small>Les derniers tirages s’afficheront ici</small> : etat.historique.map((h, i) => (
          <span key={i} className={`rk-h z-${h.zone}`} style={{ ['--c' as string]: COULEURS[h.zone], ['--n' as string]: NEONS[h.zone] } as CSSProperties}>
            {estBonus(h.zone) ? <img src={IMG_ZONE[h.zone]} alt={NOMS_ZONES[h.zone]} /> : h.zone}{h.mult && (estBonus(h.zone) || h.mult !== Number(h.zone)) ? <b>×{h.mult}</b> : null}
          </span>
        ))}
      </div>

      <section className="rk-scene">
        <Roue etat={etat} boussole={boussole} />
        {etat.phase === 'boussole' && etat.boussole && <Boussole zone={etat.boussole.zone} mult={etat.boussole.mult} debut={etat.debut} maintenant={maintenant} />}
        {etat.phase === 'resultats' && arretZone && <Resultat etat={etat} moi={profil.id} zone={arretZone} totalMoi={somme(etat.mises[profil.id]?.zones)} />}
      </section>

      <div className="rk-statut">
        <p>{etat.phase === 'attente' ? 'Pose un jeton pour lancer la roue'
          : etat.phase === 'mises' ? `Faites vos jeux · ${Math.ceil(restant / 1000)} s`
          : etat.phase === 'boussole' ? 'La Boussole cherche une case…'
          : etat.phase === 'tour' ? 'La roue tourne…'
          : etat.phase === 'bonus' ? `Mini-jeu : ${NOMS_ZONES[etat.bonus!.type]}`
          : restant > 0 ? 'Nouveau tour dans un instant' : 'Pose un jeton pour relancer'}</p>
        <div className="rk-minuterie" style={{ visibility: etat.echeance && restant > 0 && etat.phase !== 'resultats' ? 'visible' : 'hidden' }}><i style={{ width: `${Math.min(100, (restant / total) * 100)}%` }} /></div>
        <div className="rk-parieurs">
          {parieurs.slice(0, 7).map(([j, m]) => <span key={j} title={m.pseudo}><Avatar photo={m.photo} taille={24} /></span>)}
          {parieurs.length > 7 && <small>+{parieurs.length - 7}</small>}
        </div>
      </div>

      <section className={`rk-plateau ${misesOuvertes ? 'ouvert' : ''}`} aria-label="Cases où miser">
        {ZONES.map((z) => {
          const v = mise(z);
          const nb = parieurs.filter(([, m]) => (m.zones[z] ?? 0) > 0).length;
          const gagne = etat.phase === 'resultats' && arretZone === z;
          return (
            <button key={z} type="button" className={`rk-zone z-${z} ${estBonus(z) ? 'bonus' : ''} ${gagne ? 'gagne' : ''} ${v ? 'mise' : ''}`}
              style={{ ['--c' as string]: COULEURS[z], ['--n' as string]: NEONS[z] } as CSSProperties} onClick={() => poser(z)} aria-label={`Miser sur ${NOMS_ZONES[z]}`}>
              <img className="rk-zone-img" src={IMG_ZONE[z]} alt="" draggable={false} />
              <strong>{estBonus(z) ? COURTS[z] : z}</strong>
              <small>{boussole?.zone === z && !estBonus(z) ? `paie ${multBoussole(z, boussole.mult)}:1` : PAIE[z]}</small>
              {boussole?.zone === z && <em className="rk-boost">×{multBoussole(z, boussole.mult)}</em>}
              {nb > 0 && <span className="rk-nb">{nb}</span>}
              {v > 0 && <span className="rk-jeton-pose" style={{ backgroundImage: `url(${imageJeton(v)})` }}><b>{v >= 1000 ? `${Math.round(v / 100) / 10}k` : v}</b></span>}
            </button>
          );
        })}
      </section>

      {message && <p className="rk-erreur" onClick={() => setMessage(null)}>{message}</p>}
      <div className="rk-barre">
        <div className="rk-max" title={`Niveau ${niveau}`}><small>Max/case</small><b>{niveau >= NIVEAU_SANS_LIMITE ? '∞' : fmt(max)}</b></div>
        <div className="rk-jetons" role="radiogroup" aria-label="Jeton à poser">
          {JETONS.map((j) => {
            const bloque = j > max;
            return (
              <button key={j} type="button" role="radio" aria-checked={jeton === j} disabled={bloque} onClick={() => choisirJeton(j)}
                className={`rk-jeton ${jeton === j ? 'choisi' : ''} ${bloque ? 'bloque' : ''}`} style={{ backgroundImage: `url(/img/jeton_${j}.webp)` }}
                aria-label={`Jeton de ${j}${bloque ? ' (niveau insuffisant)' : ''}`}>
                <span>{j >= 1000 ? `${j / 1000}k` : j}</span>{bloque && <img className="rk-cadenas" src="/img/etat_verrou.webp" alt="" />}
              </button>
            );
          })}
        </div>
        <div className="rk-actions">
          {totalMoi === 0 && dernier ? (
            <button type="button" className="rk-action rejouer" disabled={!misesOuvertes || somme(dernier) > profil.louidors} onClick={rejouer}>↻<small>{fmt(somme(dernier))}</small></button>
          ) : (
            <>
              <button type="button" className="rk-action" disabled={!misesOuvertes || totalMoi === 0} onClick={doubler} aria-label="Doubler mes mises">×2</button>
              <button type="button" className="rk-action" disabled={etat.phase !== 'mises' || restant < 1200 || somme(mesMises) === 0} onClick={toutRetirer} aria-label="Retirer mes mises">↺</button>
            </>
          )}
        </div>
        <p className="rk-total" style={{ visibility: totalMoi > 0 ? 'visible' : 'hidden' }}>Ta mise : <b>{fmt(totalMoi)}</b></p>
      </div>

      {etat.phase === 'bonus' && etat.bonus && (
        <SceneBonus etat={etat} bonus={etat.bonus} moi={profil.id} maintenant={maintenant} boussole={etat.boussole}
          choisir={async (c) => { try { await appelRoue('choisir', { table_id: id, choix: c }); } catch (err) { setMessage((err as Error).message); } }} />
      )}

      <ChatRoue tableId={id} moi={profil.id} ouvert={chat} fermer={() => setChat(false)} />
      {regles && <div className="rk-voile" onClick={() => setRegles(false)}><div className="rk-regles" onClick={(e) => e.stopPropagation()}><ReglesRoue /><button type="button" className="bouton-or" onClick={() => setRegles(false)}>Compris</button></div></div>}
    </div>
  );
}

const retirer = (a: Partial<Record<Zone, number>>, b: Partial<Record<Zone, number>>) => {
  const n = { ...a };
  for (const [z, v] of Object.entries(b) as Array<[Zone, number]>) { const r = (n[z] ?? 0) - v; if (r > 0) n[z] = r; else delete n[z]; }
  return n;
};

/** Le plus gros jeton qui tient dans le montant. */
function imageJeton(v: number) {
  const j = [...JETONS].reverse().find((x) => x <= v) ?? 10;
  return `/img/jeton_${j}.webp`;
}

/** Les règles, affichées depuis l'accueil et depuis la roue. */
export function ReglesRoue() {
  return (
    <div className="rk-regles-texte">
      <img className="rk-animateur" src="/img/roue_animateur.webp" alt="" />
      <h2>La Roue du Kraken</h2>
      <p>Pose tes jetons sur une ou plusieurs cases pendant 15 secondes. Si la roue s’arrête sur ta case, tu gagnes ta mise multipliée, plus ta mise.</p>
      <ul>
        <li><b>1, 2, 5, 10</b> : paient 1, 2, 5 ou 10 fois la mise.</li>
        <li><b>La Boussole</b> : avant chaque tour, elle peut désigner une case et la multiplier (×2 à ×50).</li>
        <li><b>Pièce maudite</b> : une pièce, deux multiplicateurs. Crâne ou couronne ?</li>
        <li><b>Abysses</b> : un boulet tombe entre les rochers. Les cases « ×2 » doublent tout et il retombe.</li>
        <li><b>Chasse au trésor</b> : choisis une croix sur la carte, chacune cache un multiplicateur.</li>
        <li><b>Tempête du Kraken</b> : choisis ton drapeau, la roue géante décide (jusqu’à ×200).</li>
      </ul>
      <p className="petit-texte">Seuls ceux qui ont misé sur un mini-jeu y participent. Mise max par case selon ton niveau.</p>
    </div>
  );
}

// ---------------------------------------------------------------- la roue
function cheminSegment(i: number, n: number, r1: number, r2: number) {
  const a = 360 / n;
  const p = (deg: number, r: number) => { const t = (deg * Math.PI) / 180; return `${(r * Math.sin(t)).toFixed(3)} ${(-r * Math.cos(t)).toFixed(3)}`; };
  const a0 = (i - 0.5) * a, a1 = (i + 0.5) * a;
  return `M${p(a0, r1)} L${p(a0, r2)} A${r2} ${r2} 0 0 1 ${p(a1, r2)} L${p(a1, r1)} A${r1} ${r1} 0 0 0 ${p(a0, r1)}Z`;
}

/** Rotation animée : la case voulue finit sous le pointeur (en haut). */
function useRotation(cle: string | null, cible: number | null, n: number, finMs: number | null, marge = 700) {
  const [rot, setRot] = useState({ deg: 0, ms: 0 });
  const vu = useRef<string | null>(null);
  useEffect(() => {
    if (cle === null || cible === null || vu.current === cle) return;
    vu.current = cle;
    const voulu = ((-cible * (360 / n)) % 360 + 360) % 360;
    const duree = finMs ? finMs - Date.now() - marge : 0;
    setRot((r) => {
      const tours = Math.floor(r.deg / 360) * 360;
      return duree > 1500 ? { deg: tours + 360 * 6 + voulu, ms: duree } : { deg: tours + 360 + voulu, ms: 0 };
    });
  }, [cle, cible, n, finMs, marge]);
  return rot;
}

function Roue({ etat, boussole }: { etat: EtatRoue; boussole: { zone: Zone | null; mult: number } | null }) {
  const rot = useRotation(etat.arret !== null ? `m${etat.manche}` : null, etat.arret, CASES.length, etat.phase === 'tour' ? etat.echeance : null);
  const fini = etat.phase === 'bonus' || etat.phase === 'resultats';
  return (
    <div className={`rk-roue ${etat.phase === 'tour' ? 'tourne' : ''}`}>
      <img className="rk-roue-cadre" src="/img/roue_cadre.webp" alt="" draggable={false} />
      <svg viewBox="-100 -100 200 200" className="rk-roue-svg" style={{ transform: `rotate(${rot.deg}deg)`, transition: rot.ms ? `transform ${rot.ms}ms cubic-bezier(0.12, 0.6, 0.12, 1)` : 'none' }}>
        <defs>
          <radialGradient id="rk-ombre" r="0.5">
            <stop offset="0.3" stopColor="#000" stopOpacity="0.55" />
            <stop offset="0.55" stopColor="#000" stopOpacity="0" />
            <stop offset="0.86" stopColor="#fff" stopOpacity="0.07" />
            <stop offset="1" stopColor="#000" stopOpacity="0.5" />
          </radialGradient>
        </defs>
        <circle r="99" fill="#1a1007" />
        {CASES.map((z, i) => {
          const surbrillance = boussole?.zone === z;
          const gagnant = fini && etat.arret === i;
          return (
            <g key={i}>
              <path d={cheminSegment(i, CASES.length, 30, 95)} fill={COULEURS[z]} stroke={gagnant ? '#fff6c8' : surbrillance ? '#ffe27a' : '#8a6420'} strokeWidth={gagnant || surbrillance ? 1.4 : 0.45} />
              {estBonus(z)
                ? <image href={IMG_ZONE[z]} width="11" height="11" x="-5.5" y="-5.5" transform={`rotate(${i * ANGLE}) translate(0 -84)`} />
                : <text transform={`rotate(${i * ANGLE}) translate(0 -84)`} className={`rk-txt ${surbrillance ? 'booste' : ''}`} textAnchor="middle" dominantBaseline="central" style={{ fill: surbrillance ? '#fff3c8' : NEONS[z] }}>{surbrillance ? multBoussole(z, boussole!.mult) : z}</text>}
              {estBonus(z) && <text transform={`rotate(${i * ANGLE}) translate(0 -58) rotate(-90)`} className="rk-txt bonus" textAnchor="middle" dominantBaseline="central">{COURTS[z]}</text>}
            </g>
          );
        })}
        {CASES.map((_, i) => { const t = ((i + 0.5) * ANGLE * Math.PI) / 180; return <circle key={`c${i}`} cx={96.5 * Math.sin(t)} cy={-96.5 * Math.cos(t)} r="1.3" fill="#f6d27a" />; })}
        <circle r="96" fill="url(#rk-ombre)" stroke="#c9952e" strokeWidth="1.2" />
        <circle r="30" fill="#140c05" stroke="#c9952e" strokeWidth="1.6" />
      </svg>
      <img className="rk-moyeu" src="/img/roue_moyeu.webp" alt="" draggable={false} />
      <img className="rk-pointeur" src="/img/roue_pointeur.webp" alt="" draggable={false} />
    </div>
  );
}

/** La Boussole : l'aiguille tourne puis désigne une case (ou rien). */
function Boussole({ zone, mult, debut, maintenant }: { zone: Zone | null; mult: number; debut: number; maintenant: number }) {
  const t = maintenant - debut;
  const revele = t > DELAI_BOUSSOLE * 0.55;
  return (
    <div className={`rk-boussole ${revele ? 'revele' : ''}`}>
      <div className="rk-boussole-cadran"><img className="rk-aiguille" src="/img/roue_boussole_aiguille.webp" alt="" style={{ transform: `translate(-50%, -50%) rotate(${revele ? 0 : t * 0.9}deg)` }} /></div>
      {revele && (zone
        ? <p style={{ ['--c' as string]: NEONS[zone] } as CSSProperties}><img src={IMG_ZONE[zone]} alt="" /><span>{estBonus(zone) ? `${NOMS_ZONES[zone]} ×${mult}` : `Le ${zone} passe à`}</span><b>×{multBoussole(zone, mult)}</b></p>
        : <p className="vide"><span>La Boussole ne trouve rien</span></p>)}
    </div>
  );
}

function Resultat({ etat, moi, zone, totalMoi }: { etat: EtatRoue; moi: string; zone: Zone; totalMoi: number }) {
  const gain = etat.gains[moi] ?? 0;
  const h = etat.historique[0];
  return (
    <div className="rk-resultat" key={etat.manche}>
      <p className="rk-resultat-case" style={{ ['--c' as string]: COULEURS[zone], ['--n' as string]: NEONS[zone] } as CSSProperties}>
        {estBonus(zone) ? NOMS_ZONES[zone] : zone}{h?.mult && (estBonus(zone) || h.mult !== Number(zone)) ? <b> ×{h.mult}</b> : null}
      </p>
      {gain > 0 ? <p className="rk-gain"><strong>GAGNÉ</strong><em>+{fmt(gain)}</em><Pieces /></p>
        : totalMoi > 0 ? <p className="rk-gain perdu"><strong>Perdu</strong><em>−{fmt(totalMoi)}</em></p> : null}
    </div>
  );
}

function Pieces() {
  const [pieces] = useState(() => Array.from({ length: 22 }, (_, k) => ({ k, x: Math.random() * 100, dl: Math.random() * 0.8, du: 1.1 + Math.random() * 0.8, s: 0.6 + Math.random() * 0.7 })));
  return <span className="rk-pieces" aria-hidden="true">{pieces.map((p) => <i key={p.k} style={{ left: `${p.x}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.du}s`, ['--s' as string]: p.s } as CSSProperties} />)}</span>;
}

// ---------------------------------------------------------------- mini-jeux
function SceneBonus({ etat, bonus, moi, maintenant, boussole, choisir }: {
  etat: EtatRoue; bonus: EtatBonus; moi: string; maintenant: number; boussole: EtatRoue['boussole']; choisir: (c: number | Drapeau) => void;
}) {
  const participe = (etat.mises[moi]?.zones[bonus.type] ?? 0) > 0;
  const boost = boussole && boussole.zone === bonus.type ? boussole.mult : 1;
  const t = maintenant - etat.debut;
  let contenu: ReactNode;
  if (t < 0) {
    return (
      <div className={`rk-bonus rk-intro b-${bonus.type}`}>
        <span className="rk-intro-rayons" aria-hidden="true" />
        <img className="rk-intro-img" src={IMG_ZONE[bonus.type]} alt="" />
        <h2>{NOMS_ZONES[bonus.type]}</h2>
        {boost > 1 && <p className="rk-bonus-boost">Boussole ×{boost}</p>}
        <p className="rk-bonus-info">{participe ? 'Tu as misé dessus : prépare-toi !' : 'Tu n’as pas misé dessus : tu regardes.'}</p>
        <p className="rk-intro-decompte">{Math.ceil(-t / 1000)}</p>
      </div>
    );
  }
  if (bonus.type === 'piece') contenu = <ScenePiece b={bonus} t={t} />;
  else if (bonus.type === 'abysses') contenu = <SceneAbysses b={bonus} t={t} />;
  else if (bonus.type === 'chasse') contenu = <SceneChasse b={bonus} moi={moi} participe={participe} choisir={choisir} t={t} />;
  else contenu = <SceneTempete b={bonus} moi={moi} participe={participe} choisir={choisir} debut={etat.debut} echeance={etat.echeance} />;
  return (
    <div className={`rk-bonus b-${bonus.type}`}>
      <h2>{NOMS_ZONES[bonus.type]}</h2>
      {boost > 1 && <p className="rk-bonus-boost">Boussole ×{boost}</p>}
      {!participe && <p className="rk-bonus-info">Tu n’as pas misé sur ce mini-jeu : tu regardes.</p>}
      {contenu}
    </div>
  );
}

function ScenePiece({ b, t }: { b: Extract<EtatBonus, { type: 'piece' }>; t: number }) {
  const lancee = t > 800, tombee = t > 4800;
  return (
    <div className="rk-piece-scene">
      <div className={`rk-face f-crane ${tombee && b.resultat === 'crane' ? 'gagne' : ''} ${tombee && b.resultat !== 'crane' ? 'perd' : ''}`}><span>Crâne</span><b>×{b.faces.crane}</b></div>
      <div className={`rk-piece ${lancee && !tombee ? 'vole' : ''} ${tombee ? `tombe-${b.resultat}` : ''}`}>
        <img className="cote c-crane" src="/img/roue_piece_crane.webp" alt="Crâne" /><img className="cote c-couronne" src="/img/roue_piece_couronne.webp" alt="Couronne" />
      </div>
      <div className={`rk-face f-couronne ${tombee && b.resultat === 'couronne' ? 'gagne' : ''} ${tombee && b.resultat !== 'couronne' ? 'perd' : ''}`}><span>Couronne</span><b>×{b.faces.couronne}</b></div>
      {tombee && <p className="rk-bonus-mult">×{b.faces[b.resultat]}</p>}
    </div>
  );
}

/** Abysses : un boulet descend 15 rangées de rochers ; position calculée à partir du chemin tiré par le serveur. */
function SceneAbysses({ b, t }: { b: Extract<EtatBonus, { type: 'abysses' }>; t: number }) {
  const RANGS = 15, DX = 6, DY = 5.4, DESCENTE = 3300;
  const k = Math.min(b.chutes.length - 1, Math.max(0, Math.floor(t / DELAI_ABYSSES_CHUTE)));
  const tc = t - k * DELAI_ABYSSES_CHUTE;
  const chute = b.chutes[k];
  const doublesAvant = b.chutes.slice(0, k).filter((c) => b.base[c.arrivee] === 0).length;
  const arrive = tc >= DESCENTE;
  const doublesVus = doublesAvant + (arrive && b.base[chute.arrivee] === 0 ? 1 : 0);
  // Position du boulet
  const p = Math.min(RANGS, Math.max(0, (tc / DESCENTE) * RANGS));
  const r = Math.floor(p), f = p - r;
  const droites = (n: number) => chute.chemin.slice(0, n).reduce((s, d) => s + d, 0);
  const x = (n: number) => (droites(n) - n / 2) * DX;
  const bx = r >= RANGS ? x(RANGS) : x(r) + (x(r + 1) - x(r)) * f;
  const by = (r + (r >= RANGS ? 0 : f)) * DY - Math.sin(f * Math.PI) * 1.4 * (r >= RANGS ? 0 : 1);
  const fini = k === b.chutes.length - 1 && arrive && b.base[chute.arrivee] !== 0;
  return (
    <div className="rk-abysses">
      <svg viewBox={`${-8.5 * DX} -6 ${17 * DX} ${RANGS * DY + 18}`}>
        {Array.from({ length: RANGS }, (_, rr) => Array.from({ length: rr + 1 }, (_, c) => (
          <circle key={`${rr}-${c}`} cx={(c - rr / 2) * DX} cy={rr * DY + DY / 2} r="0.9" className="rk-rocher" />
        )))}
        {b.base.map((v, i) => {
          const cx = (i - 7.5) * DX, y = RANGS * DY + 1;
          const val = v === 0 ? '×2' : `${v * 2 ** doublesVus}`;
          const gagne = arrive && i === chute.arrivee;
          return (
            <g key={i} className={`rk-fente ${v === 0 ? 'double' : ''} ${gagne ? 'gagne' : ''}`}>
              <rect x={cx - DX / 2 + 0.3} y={y} width={DX - 0.6} height="9" rx="1" />
              <text x={cx} y={y + 4.8} textAnchor="middle" dominantBaseline="central" style={{ fontSize: val.length > 3 ? 2.1 : 2.8 }}>{val}</text>
            </g>
          );
        })}
        <image href="/img/roue_boulet.webp" x={bx - 2.4} y={by - 4.6} width="4.8" height="4.8" />
      </svg>
      {doublesVus > 0 && !fini && <p className="rk-bonus-info">Tout est doublé ×{2 ** doublesVus} ! Le boulet retombe…</p>}
      {fini && <p className="rk-bonus-mult">×{b.mult}</p>}
    </div>
  );
}

function SceneChasse({ b, moi, participe, choisir, t }: {
  b: Extract<EtatBonus, { type: 'chasse' }>; moi: string; participe: boolean; choisir: (c: number) => void; t: number;
}) {
  const mien = b.choix[moi];
  const revele = b.etape === 'revele' && b.grille;
  const nbChoix = (i: number) => Object.values(b.choix).filter((c) => c === i).length;
  return (
    <div className="rk-chasse">
      <p className="rk-bonus-info">{revele ? (mien !== undefined ? `Ta croix cachait ×${b.grille![mien]}` : 'Les croix sont révélées') : participe ? (mien === undefined ? 'Touche une croix sur la carte' : 'Croix choisie, tu peux encore changer') : 'Les pirates choisissent leur croix…'}</p>
      <div className="rk-carte">
        {Array.from({ length: 24 }, (_, i) => (
          <button key={i} type="button" disabled={!participe || !!revele} onClick={() => choisir(i)}
            className={`rk-croix ${mien === i ? 'mienne' : ''} ${revele ? 'revele' : ''}`} style={{ animationDelay: revele ? `${(i % 6) * 60 + Math.floor(i / 6) * 40}ms` : undefined }}>
            {revele ? <b>×{b.grille![i]}</b> : <img src="/img/roue_chasse_croix.webp" alt="Croix" />}
            {!revele && nbChoix(i) > 0 && <small>{nbChoix(i)}</small>}
          </button>
        ))}
      </div>
      {!revele && <div className="rk-minuterie"><i style={{ width: `${Math.max(0, 100 - (t / DELAI_CHOIX) * 100)}%` }} /></div>}
    </div>
  );
}

function SceneTempete({ b, moi, participe, choisir, debut, echeance }: {
  b: Extract<EtatBonus, { type: 'tempete' }>; moi: string; participe: boolean; choisir: (c: Drapeau) => void; debut: number; echeance: number | null;
}) {
  const n = b.roue.length;
  const rot = useRotation(b.arret !== null ? `t${debut}` : null, b.arret, n, b.etape === 'tour' ? echeance : null, 2600);
  const mien = b.choix[moi];
  const arrete = b.etape === 'tour' && echeance !== null && echeance - Date.now() < 2400;
  const a = 360 / n;
  return (
    <div className="rk-tempete">
      <div className="rk-tempete-roue">
        <svg viewBox="-100 -100 200 200" style={{ transform: `rotate(${rot.deg}deg)`, transition: rot.ms ? `transform ${rot.ms}ms cubic-bezier(0.12, 0.6, 0.12, 1)` : 'none' }}>
          {b.roue.map((m, i) => (
            <g key={i}>
              <path d={cheminSegment(i, n, 34, 96)} fill={m >= 100 ? '#4a0f18' : i % 2 ? '#121a30' : '#1e1028'} stroke="#c9952e" strokeWidth="0.6" />
              <text transform={`rotate(${i * a}) translate(0 -76)`} textAnchor="middle" dominantBaseline="central" className={`rk-txt ${m >= 100 ? 'gros' : ''}`}>{m}</text>
            </g>
          ))}
          <circle r="34" fill="#0b0f1e" stroke="#c9952e" strokeWidth="1.4" />
        </svg>
        <img className="rk-tempete-moyeu" src="/img/roue_tempete_moyeu.webp" alt="" />
        {DRAPEAUX.map((d) => {
          const ang = { rouge: 0, bleu: 11, or: 21 }[d] * a;
          const c = caseDrapeau(b, d);
          return (
            <div key={d} className={`rk-drapeau ${mien === d ? 'mien' : ''}`} style={{ transform: `rotate(${ang}deg)`, ['--c' as string]: COULEUR_DRAPEAU[d] } as CSSProperties}>
              <img src={`/img/roue_drapeau_${d}.webp`} alt="" />{arrete && c !== null && <b style={{ transform: `rotate(${-ang}deg)` }}>×{b.roue[c]}</b>}
            </div>
          );
        })}
      </div>
      {b.etape === 'choix' ? (
        participe ? (
          <div className="rk-drapeaux">
            {DRAPEAUX.map((d) => (
              <button key={d} type="button" className={mien === d ? 'choisi' : ''} style={{ ['--c' as string]: COULEUR_DRAPEAU[d] } as CSSProperties} onClick={() => choisir(d)}>
                <img src={`/img/roue_drapeau_${d}.webp`} alt="" />{NOM_DRAPEAU[d]}
              </button>
            ))}
          </div>
        ) : <p className="rk-bonus-info">Les pirates choisissent leur drapeau…</p>
      ) : arrete && mien ? <p className="rk-bonus-mult">×{multBonus(b, moi)}</p> : <p className="rk-bonus-info">Le Kraken fait tourner la roue…</p>}
    </div>
  );
}

// ---------------------------------------------------------------- chat
function ChatRoue({ tableId, moi, ouvert, fermer }: { tableId: string; moi: string; ouvert: boolean; fermer: () => void }) {
  const [messages, setMessages] = useState<Array<{ id: number; de: string; pseudo: string; texte: string }>>([]);
  const [texte, setTexte] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const bloques = useBloques();
  useEffect(() => {
    const canal = supabase.channel(`roue-chat-${tableId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'roue_messages', filter: `table_id=eq.${tableId}` }, ({ new: m }) => {
        const msg = m as { id: number; de: string; pseudo: string; texte: string };
        setMessages((l) => [...l.filter((x) => x.id !== msg.id), msg].slice(-5));
        setTimeout(() => setMessages((l) => l.filter((x) => x.id !== msg.id)), 5000);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [tableId]);
  async function envoyer() {
    const t = texte.trim();
    if (!t) return;
    setTexte(''); setErreur(null);
    const { error } = await supabase.rpc('envoyer_message_roue', { p_table: tableId, p_texte: t });
    if (error) setErreur(error.message);
  }
  return (
    <>
      <div className="rk-chat" aria-live="polite">
        {messages.filter((m) => !bloques.has(m.de)).map((m) => <p key={m.id} className={m.de === moi ? 'moi' : ''}><b>{m.pseudo}</b> {m.texte}</p>)}
        {erreur && <p className="erreur">{erreur}</p>}
      </div>
      {ouvert && (
        <form className="rk-chat-saisie" onSubmit={(e) => { e.preventDefault(); envoyer(); }}>
          <input autoFocus value={texte} onChange={(e) => setTexte(e.target.value)} maxLength={120} placeholder="Écris aux pirates…" enterKeyHint="send" autoComplete="off" />
          <button type="submit" disabled={!texte.trim()} aria-label="Envoyer">➤</button>
          <button type="button" onClick={fermer} aria-label="Fermer le chat">×</button>
        </form>
      )}
    </>
  );
}

/** L'heure : 5 fois par seconde, ou à chaque image pendant les animations. */
function useHorloge(rapide: boolean) {
  const [t, setT] = useState(() => Date.now());
  useEffect(() => {
    if (rapide) {
      let f = 0;
      const boucle = () => { setT(Date.now()); f = requestAnimationFrame(boucle); };
      f = requestAnimationFrame(boucle);
      return () => cancelAnimationFrame(f);
    }
    const i = setInterval(() => setT(Date.now()), 200);
    return () => clearInterval(i);
  }, [rapide]);
  return t;
}
