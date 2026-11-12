// Écran de jeu final (paysage) : décor, table ronde dorée, adversaires en arc, main en éventail,
// glisser vers l'arène, fenêtres parchemin, animations et phrases rapides.
// Ce composant ne parle pas au serveur : il reçoit la partie et renvoie les intentions du joueur.
import { Visuel } from '../composants/Visuel.tsx';
import { FX, IMAGE_OBJET } from '../lib/images.ts';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent as PE, type ReactNode, type RefObject } from 'react';
import type { VueJeu, MembreSalon } from '../lib/jeu.ts';
import type { VuePrivee } from '../engine/vues.ts';
import { carteParId, NOMS_PIRATES, COULEURS, type Couleur } from '../engine/cards.ts';
import { Avatar } from '../composants/Avatar.tsx';
import { debloquerSon, musique, son, sonBete, vibrer } from '../lib/sons.ts';
import { couleurImposeeJoker, COULEURS_JOKER, resoudrePli, role, type CarteJouee } from '../engine/pli.ts';
import { OBJETS } from '../lib/boutique.ts';
import { styleNeon } from '../lib/neons.ts';
import { article } from '../lib/perso.ts';
import { DosCarte, Eclats as EclatsPerso, PluieEmojis, Titre } from '../composants/Perso.tsx';
import { CurseursVolume } from '../composants/CurseursVolume.tsx';
import { useBloques, useSocial } from '../lib/social.ts';

export const REVELATION_MS = 2500;
/** Le navigateur sait-il positionner en unités de conteneur (iOS 16+) ? Sinon on garde l'ancien placement. */
const UNITES_CONTENEUR = typeof CSS !== 'undefined' && CSS.supports?.('width: 1cqw') === true;
export const GAGNANT_MS = 2000;
// Entraînement en vitesse rapide : le serveur attend 3,1 s après un pli.
const REVELATION_RAPIDE_MS = 1500;
const GAGNANT_RAPIDE_MS = 1300;

/** Petit rappel de règle affiché quand on agrandit une carte. */
export function regleCarte(id: string): { nom: string; texte: string } {
  const c = carteParId(id);
  const NOMS_COULEURS = { jaune: 'Coffre (jaune)', violet: 'Carte au trésor (violet)', vert: 'Perroquet (vert)', noir: 'Pavillon noir (atout)' } as const;
  switch (c.type) {
    case 'numero':
      if (c.bonusPli) {
        return { nom: `${c.valeur} ${NOMS_COULEURS[c.couleur]} · extension`, texte: `Carte numérotée normale. À valeur égale, la première posée gagne. Celui qui remporte le pli qui la contient gagne ${c.bonusPli > 0 ? '+5' : '−5'}.` };
      }
      return c.couleur === 'noir'
        ? { nom: `${c.valeur} ${NOMS_COULEURS.noir}`, texte: `L’atout : bat toutes les couleurs, mais perd contre les personnages.${c.valeur === 14 ? ' Le capturer rapporte +20 (si la mise est exacte).' : ''}` }
        : { nom: `${c.valeur} ${NOMS_COULEURS[c.couleur]}`, texte: `Il faut suivre la couleur demandée si tu en as. La plus haute de la couleur gagne.${c.valeur === 14 ? ' Le capturer rapporte +10 (si la mise est exacte).' : ''}` };
    case 'fuite': return { nom: 'Fuite', texte: 'Perd toujours (sauf si tout le monde fuit : la première gagne). Se joue à tout moment.' };
    case 'butin': return { nom: 'Butin', texte: 'Comme une Fuite. Si un autre joueur gagne le pli, vous formez une alliance : +20 chacun si vos deux mises sont exactes.' };
    case 'tigresse': return { nom: 'Tigresse', texte: 'Au choix : jouée en Pirate (sans pouvoir) ou en Fuite.' };
    case 'double': return { nom: `0 / 14 ${NOMS_COULEURS[c.couleur]}`, texte: 'En la posant, tu choisis : elle vaut 0 ou 14 dans sa couleur. Elle ne rapporte jamais de bonus.' };
    case 'joker': return { nom: 'Joker 15', texte: 'Un 15 jaune, violet ou vert. Si la couleur n’est pas encore lancée, tu la choisis ; sinon il prend la couleur demandée. Sur un pli noir, il perd contre le noir. Il se pose toujours.' };
    case 'second': return { nom: 'Le Second', texte: 'Bat toutes les cartes sauf le Skull King et les Sirènes. S’il gagne, il prend les pouvoirs des Pirates capturés (sans leurs bonus). Capturé par le Skull King ou une Sirène : +30.' };
    case 'raie': return { nom: 'Raie tachetée', texte: 'Léviathan : la plus petite carte numérotée gagne le pli (égalité : la première posée). Avec d’autres léviathans, le dernier posé décide.' };
    case 'davy': return { nom: 'Casier de Davy Jones', texte: 'Ne gagne jamais. Détruit tous les léviathans du pli (Kraken, Baleine, Raie), puis le pli se joue normalement. Celui qui pose le Casier touche +20 par léviathan détruit.' };
    case 'planche': return { nom: 'Supplice de la planche', texte: 'Ne gagne jamais. À la fin du pli, jette un Pirate à la mer (tu choisis s’il y en a plusieurs) : le pli se joue comme s’il n’avait pas été posé.' };
    case 'salve': return { nom: 'Dernière salve', texte: 'Ne gagne jamais (ce n’est pas une Fuite). Quand tout le monde a joué, tu poses immédiatement une deuxième carte. Tu ne joueras donc pas le dernier pli de la manche.' };
    case 'skull_king': return { nom: 'Skull King', texte: 'Bat les Pirates (+30 par Pirate capturé) mais tombe face à une Sirène.' };
    case 'sirene': return { nom: 'Sirène', texte: 'Bat les cartes numérotées. Perd contre les Pirates, mais capture le Skull King (+40).' };
    case 'kraken': return { nom: 'Kraken', texte: 'Détruit le pli : personne ne le gagne. Celui qui aurait gagné ouvre le pli suivant.' };
    case 'baleine': return { nom: 'Baleine blanche', texte: 'Les cartes spéciales ne valent plus rien : la plus haute carte numérotée gagne, toutes couleurs confondues.' };
    case 'pirate': {
      const pouvoirs = {
        rosie: 'Choisis qui ouvre le prochain pli.',
        bendt: 'Pioche 2 cartes non distribuées, puis défausse-en 2.',
        rascal: 'Parie 0, 10 ou 20 points : gagnés si ta mise est exacte, perdus sinon.',
        juanita: 'Regarde en secret les cartes non distribuées.',
        harry: 'En fin de manche, modifie ta mise de −1, 0 ou +1.',
        mary: 'Prends une carte au hasard dans la main d’un adversaire : il devra la poser au pli suivant.',
      } as const;
      return { nom: NOMS_PIRATES[c.pirate], texte: `Pirate : bat les numéros et les Sirènes (+20 par Sirène), perd contre le Skull King. Pouvoir s’il gagne le pli : ${pouvoirs[c.pirate]}${c.pirate !== 'harry' ? ' (Pas au dernier pli.)' : ''}` };
    }
  }
}

/** Compte de 0 jusqu'à la valeur, pour animer les scores. */
function useCompteur(cible: number, duree = 900, retard = 0) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const debut = performance.now() + retard;
    const pas = (t: number) => {
      const k = Math.min(1, Math.max(0, (t - debut) / duree));
      setV(Math.round(cible * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [cible, duree, retard]);
  return v;
}
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
  /** Joueurs humains actuellement connectés (pastille verte). */
  presents?: string[];
  /** XP gagnée à la fin de la partie (parties comptées). */
  gain?: { xp: number; louidors: number; niveauAvant: number; niveauApres: number } | null;
  /** Bilan face-à-face avec les autres humains de la table. */
  bilan?: Array<{ adversaire: string; mes_victoires: number; ses_victoires: number; parties: number }>;
  rejouer?: () => void;
  /** Objets lancés et réactions reçus (temps réel). */
  lancers?: Array<{ id: number; de: string; a: string; objet: string }>;
  reactions?: Array<{ cle: number; de: string; emoji: string }>;
  inventaire?: Record<string, number>;
  lancerObjet?: (objet: string, cible: string) => Promise<boolean>;
  envoyerReaction?: (emoji: string) => void;
  /** Emotes en plus (packs achetés). */
  emotes?: string[];
  /** Record à battre : meilleur score jamais réalisé sur SKULL ARENA. */
  record?: { pseudo: string; score: number } | null;
}

const EMOJIS = ['😂', '😱', '🔥', '👏', '😡', '🤔', '😎', '🙏'];

/** Ordre de tri de la main : par couleur, puis par valeur, spéciales à part. */
function rangCarte(id: string): number {
  const c = carteParId(id);
  if (c.type === 'numero') return COULEURS.indexOf(c.couleur) * 100 + c.valeur + (c.bonusPli ? 0.5 : 0);
  if (c.type === 'double') return COULEURS.indexOf(c.couleur) * 100 + 14.5;
  const ordre = ['fuite', 'butin', 'salve', 'planche', 'tigresse', 'pirate', 'second', 'sirene', 'skull_king', 'joker', 'kraken', 'baleine', 'raie', 'davy'];
  return 1000 + ordre.indexOf(c.type) * 10 + (c.type === 'pirate' ? id.length : 0);
}

export function TableJeu(p: PropsTable) {
  const { vue, main, membres, moi } = p;
  const [etapePli, setEtapePli] = useState<'aucune' | 'revelation' | 'gagnant'>('aucune');
  const [decompte, setDecompte] = useState(0);
  const [selection, setSelection] = useState<string | null>(null);
  const [glisse, setGlisse] = useState<{ id: string } | null>(null);
  // Réponses anticipées : la fenêtre se ferme tout de suite, sans attendre le serveur.
  const [miseLocale, setMiseLocale] = useState<{ manche: number; mise: number } | null>(null);
  const [continuerLocal, setContinuerLocal] = useState<number | null>(null);
  const [pouvoirEnvoye, setPouvoirEnvoye] = useState<string | null>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [tigresse, setTigresse] = useState(false);
  // Extension : choix à faire en posant le 0/14 ou le Joker 15.
  const [choixValeur, setChoixValeur] = useState<string | null>(null);
  const [choixJoker, setChoixJoker] = useState(false);
  const [defausse, setDefausse] = useState<string[]>([]);
  const [chatOuvert, setChatOuvert] = useState(false);
  const [scoresOuverts, setScoresOuverts] = useState(false);
  const [menuOuvert, setMenuOuvert] = useState(false);
  const [confirmQuitter, setConfirmQuitter] = useState(false);
  const [effet, setEffet] = useState<null | 'skull' | 'kraken' | 'baleine'>(null);
  const [distribution, setDistribution] = useState(0);
  const [carteEnVol, setCarteEnVol] = useState<string | null>(null);
  const [voirDernierPli, setVoirDernierPli] = useState(false);
  const [muetsChoisis, setMuets] = useState<string[]>([]);
  const bloques = useBloques();
  const muets = useMemo(() => [...muetsChoisis, ...bloques], [muetsChoisis, bloques]);
  const { ouvrirProfil } = useSocial();
  const [juanitaFermee, setJuanitaFermee] = useState<string | null>(null);
  const [musiqueOn, setMusiqueOn] = useState(() => musique.active());
  const [panneauObjets, setPanneauObjets] = useState(false);
  const [objetChoisi, setObjetChoisi] = useState<string | null>(null);
  const [ongletFin, setOngletFin] = useState<'podium' | 'resume'>('podium');
  const [grandeAnim, setGrandeAnim] = useState<GrandEvenement | null>(null);
  const [taille, setTaille] = useState(() => ({ l: window.innerWidth, h: window.innerHeight }));
  const pivoteRef = useRef(false);
  useEffect(() => {
    const maj = () => setTaille({ l: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', maj);
    return () => window.removeEventListener('resize', maj);
  }, []);
  // Rythme de la distribution : une carte à la fois, lentement ; plus il y a de cartes, plus c'est long.
  const nbDistribuees = vue.cartesParJoueur * vue.joueurs.length;
  const dureeDistribution = Math.min(6, 0.9 + vue.manche * 0.32 + vue.joueurs.length * 0.05); // en secondes
  const intervalleDistribution = Math.max(0.075, dureeDistribution / Math.max(nbDistribuees, 1));
  const [volsDistribution, setVolsDistribution] = useState<Array<{ k: string; x0: number; y0: number; x1: number; y1: number; retard: number }>>([]);
  const racine = useRef<HTMLDivElement>(null);
  const mancheVue = useRef(0);
  const pliVu = useRef(0);
  const appui = useRef<{ id: string; x: number; y: number; t: number; minuterie: number } | null>(null);
  const tourPrecedent = useRef<string | null>(null);

  const infos = useMemo(() => new Map(membres.map((m) => [m.joueur_id, m])), [membres]);
  const pseudo = (id: string) => infos.get(id)?.pseudo ?? 'Pirate';
  const photo = (id: string) => infos.get(id)?.photo_url ?? null;
  const cadre = (id: string) => infos.get(id)?.cadre ?? null;
  const neonNom = (id: string) => styleNeon(infos.get(id)?.couleur_nom);
  const persoDe = (id: string | null | undefined) => (id ? infos.get(id)?.perso ?? null : null);
  const compagnon = (id: string) => persoDe(id)?.compagnon ?? null;
  const monTapis = persoDe(moi)?.tapis;
  const piloteParRobot = (j: string) => vue.robots?.includes(j) || vue.remplaces?.includes(j);
  const finie = vue.phase === 'fin_partie' || vue.annulee;
  const tRevelation = vue.rapide ? REVELATION_RAPIDE_MS : REVELATION_MS;
  const tGagnant = vue.rapide ? GAGNANT_RAPIDE_MS : GAGNANT_MS;

  // Musique d'ambiance (si activée) : démarre au premier toucher, s'arrête en quittant la table.
  useEffect(() => {
    if (!musiqueOn) return;
    const go = () => musique.demarrer();
    go();
    document.addEventListener('pointerdown', go, { once: true });
    return () => { document.removeEventListener('pointerdown', go); musique.arreter(); };
  }, [musiqueOn]);

  // Manche 10 : la tempête se lève (décor, éclairs, musique plus tendue).
  const tempete = vue.manche === 10 && !finie;
  useEffect(() => {
    musique.tempete(tempete);
    if (!tempete) return;
    const t = setInterval(() => { if (Math.random() < 0.5) son.tonnerre(); }, 9000);
    return () => { clearInterval(t); musique.tempete(false); };
  }, [tempete]);

  // Victoire : pluie d'or et fanfare pour le (ou les) vainqueur(s).
  const meilleur = Math.max(...vue.joueurs.map((j) => vue.scores[j]));
  const jeGagne = vue.phase === 'fin_partie' && !vue.annulee && vue.scores[moi] === meilleur;

  // Fin de partie : l'écran repasse en portrait (verrouillage sur Android ; sur iPhone, l'affichage pivote
  // tout seul tant que le téléphone est encore couché, puis se remet droit quand on le redresse).
  const [sensRotation, setSensRotation] = useState<'rot-g' | 'rot-d'>('rot-g');
  const finPortrait = (vue.phase === 'fin_partie' || vue.annulee) && etapePli === 'aucune';
  // Téléphone tenu droit pendant la partie : la table s'affiche d'elle-même à l'horizontale (pivotée d'un quart de tour).
  const pivote = !finPortrait && taille.l < taille.h && taille.l <= 900;
  pivoteRef.current = pivote;
  const tailleTable = pivote ? { l: taille.h, h: taille.l } : taille;
  useEffect(() => {
    if (!finPortrait) return;
    const lireSens = () => {
      const angle = screen.orientation?.angle ?? Number((window as unknown as { orientation?: number }).orientation ?? 90);
      setSensRotation(angle === 270 || angle === -90 ? 'rot-d' : 'rot-g');
    };
    lireSens();
    window.addEventListener('orientationchange', lireSens);
    screen.orientation?.addEventListener?.('change', lireSens);
    (async () => {
      try { await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('portrait'); }
      catch { try { screen.orientation?.unlock?.(); } catch { /* rien */ } }
    })();
    return () => {
      window.removeEventListener('orientationchange', lireSens);
      screen.orientation?.removeEventListener?.('change', lireSens);
    };
  }, [finPortrait]);
  useEffect(() => {
    if (!jeGagne) return;
    const t = setTimeout(() => { son.fanfare(); vibrer(200); }, 400);
    return () => clearTimeout(t);
  }, [jeGagne]);

  // ---------- Entrées en scène : au tout début de la partie, chacun son effet ----------
  const [entrees, setEntrees] = useState<Array<{ cle: string; joueur: string; effet: string }>>([]);
  const entreesJouees = useRef(false);
  useEffect(() => {
    if (entreesJouees.current || vue.manche !== 1 || vue.phase !== 'mise' || vue.historique.length > 0) return;
    entreesJouees.current = true;
    const avec = vue.joueurs.filter((j) => article(persoDe(j)?.entree));
    const ts = avec.map((j, i) => setTimeout(() => {
      const cle = `${j}-${Date.now()}`;
      setEntrees((x) => [...x, { cle, joueur: j, effet: persoDe(j)!.entree! }]);
      son.impact();
      setTimeout(() => setEntrees((x) => x.filter((y) => y.cle !== cle)), 2600);
    }, 700 + i * 900));
    return () => ts.forEach(clearTimeout);
  }, [vue.manche, vue.phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Décompte de 3 s au début de chaque manche ----------
  useEffect(() => {
    if (p.decompteDesactive || vue.manche === mancheVue.current) return;
    mancheVue.current = vue.manche;
    setDecompte(5); // 5 : distribution en cours, puis 3, 2, 1, « À l'abordage ! »
    setDistribution((d) => d + 1);
  }, [vue.manche, p.decompteDesactive]);
  useEffect(() => {
    if (decompte <= 0) return;
    if (decompte === 5) {
      // le temps de distribuer toutes les cartes, une par une
      const t = setTimeout(() => setDecompte(4), (nbDistribuees * intervalleDistribution + 0.6) * 1000);
      return () => clearTimeout(t);
    }
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
    const evt = vue.dernierPli ? detecterEvenement(vue.dernierPli.cartes, vue.dernierPli.resultat, pseudo) : null;
    // Kraken, Baleine, Raie : la bête prend tout l'écran pendant 4 s, puis on montre directement le résultat du pli.
    const bete = evt ? beteDe(evt) : null;
    if (evt && bete) {
      const debut = 350;
      const b0 = setTimeout(() => { setEffet(r?.effet === 'kraken' ? 'kraken' : 'baleine'); setGrandeAnim(evt); sonBete[bete](); vibrer(220); }, debut);
      const b1 = setTimeout(() => { setGrandeAnim(null); setEtapePli('gagnant'); }, debut + DUREE_BETE);
      const b2 = setTimeout(() => { setEtapePli('aucune'); setEffet(null); }, debut + DUREE_BETE + 550);
      return () => { clearTimeout(b0); clearTimeout(b1); clearTimeout(b2); setEtapePli('aucune'); setEffet(null); setGrandeAnim(null); };
    }
    const t0 = setTimeout(() => {
      if (r?.effet === 'kraken') setEffet('kraken');
      else if (r?.effet === 'baleine') setEffet('baleine');
      else if (r?.gagnant && vue.dernierPli && r.indexGagnant !== null &&
        carteParId(vue.dernierPli.cartes[r.indexGagnant].carteId).type === 'skull_king') setEffet('skull');
      // Grosse animation pour les grands moments (dans la pause du pli : le jeu attend qu'elle finisse)
      if (evt) { setGrandeAnim(evt); son[evt.son](); vibrer(140); }
      else if (r?.gagnant && vue.dernierPli && r.indexGagnant !== null &&
        carteParId(vue.dernierPli.cartes[r.indexGagnant].carteId).type === 'skull_king') son.skull();
      else son.pli();
    }, tRevelation - 200);
    const t1 = setTimeout(() => setEtapePli('gagnant'), tRevelation);
    const t2 = setTimeout(() => { setEtapePli('aucune'); setEffet(null); }, tRevelation + tGagnant);
    const t3 = setTimeout(() => setGrandeAnim(null), tRevelation - 200 + DUREE_GRANDE_ANIM);
    return () => { clearTimeout(t0); clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); setEtapePli('aucune'); setEffet(null); setGrandeAnim(null); };
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
      // x : position sur la largeur · y : HAUT du bloc du joueur (en % de l'arène), pour qu'il ne soit jamais coupé
      if (k >= 5) {
        // beaucoup de joueurs : répartis régulièrement sur la largeur, en arc léger
        const x = 5 + (90 * (idx + 0.5)) / k;
        const t = (x - 50) / 50;
        pos.set(j, { x, y: 2 + 20 * t * t });
        return;
      }
      const extra = k >= 3 ? 0.15 : 0;
      const angle = Math.PI - extra + ((idx + 1) * (Math.PI + 2 * extra)) / (k + 1);
      pos.set(j, { x: 50 + 46 * Math.cos(angle), y: 28 + 26 * Math.sin(angle) });
    });
    pos.set(moi, { x: 50, y: 92 });
    return pos;
  }, [autres, moi]);
  const tailleAvatar = autres.length <= 3 ? 74 : autres.length <= 5 ? 62 : 52;

  // Distribution : les cartes partent du centre de la table vers chaque pirate.
  useEffect(() => {
    if (!distribution || !racine.current) return;
    const t = requestAnimationFrame(() => {
      const r = racine.current!;
      const base = { width: r.offsetWidth, height: r.offsetHeight };
      const c = centreDans(r, r.querySelector('.centre-pli'));
      if (!c) return;
      const x0 = c.x, y0 = c.y;
      const nb = vue.cartesParJoueur;
      const pas = intervalleDistribution * 1000;
      son.distribuer(nbDistribuees, intervalleDistribution);
      const vols: typeof volsDistribution = [];
      vue.joueurs.forEach((j, i) => {
        const el = centreDans(r, r.querySelector(`[data-joueur="${j}"]`));
        const x1 = j === moi ? base.width / 2 : el ? el.x : x0;
        const y1 = j === moi ? base.height - 40 : el ? el.y : y0;
        for (let k = 0; k < nb; k++) vols.push({ k: `${distribution}-${j}-${k}`, x0, y0, x1, y1, retard: 50 + (k * vue.joueurs.length + i) * pas });
      });
      setVolsDistribution(vols);
    });
    const fin = setTimeout(() => setVolsDistribution([]), (nbDistribuees * intervalleDistribution + 1) * 1000);
    return () => { cancelAnimationFrame(t); clearTimeout(fin); };
  }, [distribution]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Pli affiché ----------
  const pliServeur = pliAffiche && vue.dernierPli ? vue.dernierPli.cartes : vue.pliEnCours;
  // La carte que je viens de lancer apparaît tout de suite sur la table, sans attendre le serveur.
  const pliMontre: CarteJouee[] = carteEnVol && !pliServeur.some((c) => c.carteId === carteEnVol)
    ? [...pliServeur, { joueur: moi, carteId: carteEnVol }]
    : pliServeur;
  const resultat = pliAffiche && etape === 'gagnant' ? vue.dernierPli?.resultat ?? null : null;
  // Carte maîtresse : qui remporterait le pli si on s'arrêtait là ?
  const maitresse = useMemo(() => {
    if (pliAffiche || pliMontre.length < 2) return null;
    try { return resoudrePli(pliMontre); } catch { return null; }
  }, [pliAffiche, pliMontre]);
  const cible = resultat?.gagnant ? positions.get(resultat.gagnant) : null;

  function styleCartePli(joueur: string, index: number): CSSProperties {
    const pos = positions.get(joueur) ?? { x: 50, y: 92 };
    // Repère de l'arène : chaque carte se pose entre le centre du pli et la place du joueur.
    const cx = 50, cy = 46.5;
    const ancreY = joueur === moi ? 100 : pos.y + 12;
    const depart = joueur === moi ? { x: 50, y: 120 } : { x: pos.x, y: pos.y + 12 };
    const dejaPose = pliMontre.slice(0, index).some((c) => c.joueur === joueur); // Dernière salve : 2e carte décalée
    let x = cx + (pos.x - cx) * 0.5 + (index - (pliMontre.length - 1) / 2) * 2.5 + (dejaPose ? 7 : 0);
    let y = cy + (ancreY - cy) * 0.06;
    const rot = ((index * 37) % 13) - 6;
    if (cible && etape === 'gagnant') {
      // le pli glisse doucement vers le gagnant
      x = x + (cible.x - x) * 0.5;
      y = y + (cible.y + 12 - y) * 0.42;
    }
    // Position par transform (unités de conteneur) : le navigateur anime sur le GPU, sans recalcul de mise en page.
    if (!UNITES_CONTENEUR) {
      return {
        left: `${x}%`, top: `${y}%`, transform: `translate(-50%, -50%) rotate(${rot}deg)`, zIndex: 10 + index,
        ['--depart-x' as string]: `${depart.x}%`, ['--depart-y' as string]: `${depart.y}%`, ['--rot' as string]: `${rot}deg`,
      };
    }
    return {
      zIndex: 10 + index,
      ['--x' as string]: x, ['--y' as string]: y, ['--r' as string]: `${rot}deg`,
      ['--x0' as string]: depart.x, ['--y0' as string]: depart.y,
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

  async function envoyerPouvoir(coup: Record<string, unknown>) {
    const k = `${vue.manche}-${vue.numeroPli}-${vue.pouvoir?.type}`;
    setPouvoirEnvoye(k);
    const ok = await p.envoyer(coup);
    if (ok === false) setPouvoirEnvoye(null);
  }

  function jouerCarte(id: string) {
    if (!aMoi || !main.jouables.includes(id)) return;
    setSelection(null);
    const type = carteParId(id).type;
    if (type === 'tigresse') return setTigresse(true);
    if (type === 'double') return setChoixValeur(id);
    if (type === 'joker' && couleurImposeeJoker(vue.pliEnCours) === undefined) return setChoixJoker(true);
    lancer({ type: 'jouer', carteId: id }, id);
  }

  async function lancer(coup: Record<string, unknown>, id: string) {
    setCarteEnVol(id);
    son.carte();
    const ok = await p.envoyer(coup);
    if (ok === false) setCarteEnVol(null); // refusé : la carte revient dans la main
  }

  /** Déplacement du doigt (écran) → déplacement sur la table (qui peut être pivotée d'un quart de tour). */
  const versTable = (dx: number, dy: number): [number, number] => (pivoteRef.current ? [dy, -dx] : [dx, dy]);

  function surAppui(e: PE<HTMLButtonElement>, id: string) {
    debloquerSon();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const minuterie = window.setTimeout(() => { setZoom(id); appui.current = null; setGlisse(null); }, 480);
    appui.current = { id, x: e.clientX, y: e.clientY, t: Date.now(), minuterie };
  }
  function surDeplacement(e: PE<HTMLButtonElement>) {
    const a = appui.current;
    if (!a) return;
    const [dx, dy] = versTable(e.clientX - a.x, e.clientY - a.y);
    if (Math.hypot(dx, dy) > 8) clearTimeout(a.minuterie);
    if (aMoi && main.jouables.includes(a.id) && dy < -10) {
      const el = e.currentTarget as HTMLElement;
      el.style.setProperty('--dx', `${dx}px`);
      el.style.setProperty('--dy', `${dy}px`);
      if (glisse?.id !== a.id) setGlisse({ id: a.id });
    }
  }
  function surRelache(e: PE<HTMLButtonElement>) {
    const a = appui.current;
    appui.current = null;
    if (!a) return;
    clearTimeout(a.minuterie);
    const [dx, dy] = versTable(e.clientX - a.x, e.clientY - a.y);
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
  const enMise = vue.phase === 'mise' && decompte === 0;
  // Écart entre les cartes : jamais plus large que l'écran (toutes les cartes restent visibles, même sur un petit iPhone).
  const largeurCarte = Math.min(enMise ? 128 : 132, Math.max(enMise ? 62 : 64, tailleTable.h * (enMise ? 0.26 : 0.29)));
  const ecartMax = n > 1 ? (tailleTable.l - largeurCarte - 2 * MARGE_MAIN) / (n - 1) : 99;
  const ecart = Math.max(18, Math.min(enMise ? 92 : 64, (enMise ? 720 : 620) / Math.max(n, 1), ecartMax));
  const angleMax = Math.min(28, n * 3.2);

  const classement = [...vue.joueurs].sort((a, b) => vue.scores[b] - vue.scores[a]);
  const miseDe = (j: string) => (vue.mises ? vue.mises[j] + (vue.harry[j] ?? 0) : null);
  /** Ce qu'il reste à faire pendant la manche : « Encore 2 plis », « Ne prends plus rien ! »… */
  function objectif(j: string): { texte: string; ton: 'or' | 'vert' | 'rouge' } | null {
    const m = miseDe(j);
    if (m === null || !['jeu', 'pouvoir', 'harry'].includes(vue.phase)) return null;
    const reste = m - vue.plisGagnes[j];
    const plisRestants = (vue.cartesEnMain[j] ?? 0) + (vue.pliEnCours.some((c) => c.joueur === j) ? 1 : 0);
    if (reste < 0) return { texte: 'Mise dépassée', ton: 'rouge' };
    if (reste === 0) return { texte: 'Ne prends plus rien !', ton: 'vert' };
    if (reste > plisRestants && vue.phase === 'jeu') return { texte: 'Mise hors d’atteinte', ton: 'rouge' };
    return { texte: `Encore ${reste} pli${reste > 1 ? 's' : ''}`, ton: 'or' };
  }
  const humain = (j: string) => !vue.robots?.includes(j);
  const connecte = (j: string) => !p.presents || p.presents.includes(j);

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
    <div className={`jeu ${tempete ? 'tempete' : ''} ${finPortrait ? `fin-portrait ${sensRotation}` : ''} ${pivote ? 'pivote' : ''}`} onPointerDown={debloquerSon} ref={racine}>
      {tempete && <div className="eclairs" aria-hidden="true" />}
      <div className="jeu-decor" />
      <div className="jeu-fumee" />

      {/* Barre du haut */}
      <img className="jeu-logo" src="/decor/logo.webp" alt="Skull Arena" />
      <nav className="jeu-rail" aria-label="Informations de la partie">
        <div className="rail-pastille rail-manche" aria-label={`Manche ${vue.manche} sur 10`}>
          <small>Manche</small>
          <strong>{vue.manche}<em>/10</em></strong>
        </div>
        <div className="rail-pastille rail-mise" aria-label="Ma mise">
          <small>⚔ Mise</small>
          <strong>{miseDe(moi) ?? (miseLocale?.manche === vue.manche ? miseLocale.mise : vue.aMise[moi] ? '✓' : '?')}</strong>
        </div>
        <button type="button" className="rail-rond rail-scores" onClick={() => setScoresOuverts(true)} aria-label="Scores"><img className="rail-img" src="/img/jeu_scores.webp" alt="" /></button>
        <button type="button" className="rail-rond rail-reglages" onClick={() => setMenuOuvert((m) => !m)} aria-label="Réglages"><img className="rail-img" src="/img/jeu_reglages.webp" alt="" /></button>
        {menuOuvert && (
          <div className="jeu-menu">
            <button type="button" onClick={() => setMusiqueOn(musique.basculer())}>{musiqueOn ? '🎵 Musique : oui' : '🔇 Musique : non'}</button>
            <CurseursVolume />
            {!finie && <button type="button" onClick={() => { setMenuOuvert(false); setConfirmQuitter(true); }}>Quitter la partie</button>}
            <button type="button" onClick={() => setMenuOuvert(false)}>Fermer</button>
          </div>
        )}
      </nav>

      {/* Table */}
      <section className={`jeu-arene ${autres.length >= 5 ? 'nombreux' : ''}`}>
        <div className={`jeu-table ${monTapis ? `tapis-fond ${monTapis}` : ''} ${effet ? `effet-${effet}` : ''}`}
          onClick={(e) => { if (e.target === e.currentTarget && !pliAffiche && vue.dernierPli) setVoirDernierPli(true); }}>
          <div className="jeu-table-boussole" />
        </div>

        {/* Le pli, posé sur la table (repère de l'arène) */}
        <div className="zone-pli" onClick={(e) => { if (e.target === e.currentTarget && !pliAffiche && vue.dernierPli) setVoirDernierPli(true); }}>
          <span className="centre-pli" aria-hidden="true" />
          {/* Infos de la table : au centre, sous les cartes (jamais par-dessus) */}
          <div className="infos-table" aria-live="polite">
            {!pliAffiche && vue.phase === 'jeu' && pliMontre.length === 0 && (
              <p className="indice-table">
                {aMoi ? 'À toi d’ouvrir le pli !' : `${pseudo(vue.joueurActif ?? '')} ouvre le pli…`}
                {vue.dernierPli && <small>Touche la table pour revoir le dernier pli</small>}
              </p>
            )}
            {vue.juanitaRegarde && vue.juanitaRegarde !== moi && <p>🔮 {pseudo(vue.juanitaRegarde)} consulte les cartes non distribuées…</p>}
            {!pliAffiche && vue.imposee && vue.imposee.joueur !== moi && ['jeu', 'pouvoir'].includes(vue.phase) && (
              <p>🗡️ {pseudo(vue.imposee.joueur)} doit poser la carte prise par {pseudo(vue.imposee.par)}</p>
            )}
            {vue.phase === 'mise' && decompte === 0 && (vue.aMise[moi] || miseLocale?.manche === vue.manche) && (
              <p>Mise {miseLocale?.manche === vue.manche ? `de ${miseLocale.mise} ` : ''}verrouillée · ▶ {vue.meneur === moi ? 'tu ouvres' : `${pseudo(vue.meneur)} ouvre`} le premier pli</p>
            )}
            {!pliAffiche && vue.phase === 'pouvoir' && vue.pouvoir && !pouvoirMoi && (
              <p>{vue.pouvoir.type === 'planche' ? 'Supplice de la planche' : NOMS_PIRATES[vue.pouvoir.type]} · {pseudo(vue.pouvoir.joueur)} choisit…</p>
            )}
            {!pliAffiche && vue.phase === 'harry' && !vue.harryEnAttente.includes(moi) && <p>Harry le Géant réfléchit…</p>}
          </div>
          {resultat && (
            <p className="annonce-pli">
              {resultat.effet === 'kraken' ? '🐙 Le Kraken engloutit le pli !'
                : resultat.gagnant ? <>{pseudo(resultat.gagnant)} remporte le pli{resultat.bonus ? <strong> {resultat.bonus > 0 ? '+' : ''}{resultat.bonus}</strong> : null}</>
                : resultat.effet === 'raie' ? '🐟 La Raie tachetée disperse le pli !'
                : resultat.effet === 'baleine' ? '🐋 La Baleine blanche disperse le pli !'
                : 'Personne ne remporte ce pli'}
            </p>
          )}
          {pliMontre.map((c, i) => (
            <figure key={`${vue.manche}-${c.carteId}`} className={`carte-pli ${UNITES_CONTENEUR ? 'cq' : ''} ${resultat && resultat.indexGagnant === i ? 'gagnante' : ''} ${resultat && resultat.indexGagnant !== i ? 'perdante' : ''} ${maitresse?.indexGagnant === i ? 'maitresse' : ''}`}
              style={styleCartePli(c.joueur, i)} onClick={() => (!pliAffiche && vue.dernierPli && vue.pliEnCours.length === 0 ? setVoirDernierPli(true) : setZoom(c.carteId))}>
              <img src={`/cartes/${c.carteId}.webp`} alt="" draggable={false} />
              {c.tigresse && <span className="etiquette-tigresse">{c.tigresse === 'pirate' ? 'Pirate' : 'Fuite'}</span>}
              {c.valeur !== undefined && <span className="etiquette-tigresse">vaut {c.valeur}</span>}
              {carteParId(c.carteId).type === 'joker' && <span className={`etiquette-tigresse couleur-${c.couleur ?? 'aucune'}`}>{c.couleur ? `15 ${c.couleur}` : '15 sans couleur'}</span>}
              {resultat && resultat.retire === i && <span className="etiquette-tigresse rouge">🌊 à la mer</span>}
              {resultat && resultat.detruits?.includes(i) && <span className="etiquette-tigresse rouge">⚓ au Casier</span>}
            </figure>
          ))}
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
                  <DosCarte key={k} modele={persoDe(j)?.dos} style={{ transform: `rotate(${(k - Math.min(nbCartes, 6) / 2) * 9}deg)` }} />
                ))}
              </div>
              <div className="adv-avatar" data-joueur={j} onClick={() => { if (!vue.robots?.includes(j)) ouvrirProfil(j); }}>
                {actif && vue.phase === 'jeu' && <span className="adv-sablier" title="À son tour">⏳</span>}
                {vue.joueurs.indexOf(j) === vue.couronne && <span className="adv-couronne">👑</span>}
                {vue.phase === 'mise' && vue.meneur === j && <span className="adv-ouvre" title="Ouvre le premier pli">▶ 1er</span>}
                <Avatar photo={photo(j)} taille={tailleAvatar} alt={pseudo(j)} cadre={cadre(j)} compagnon={compagnon(j)} />
                {humain(j) && <span className={`pastille-co ${connecte(j) ? 'en-ligne' : 'hors-ligne'}`} title={connecte(j) ? 'Connecté' : 'Déconnecté'} />}
                {vue.mises && (() => { const o = objectif(j); return <span className={`adv-ruban ${o ? `obj-${o.ton}` : ''}`} title={o?.texte}>{vue.plisGagnes[j]}/{miseDe(j)}</span>; })()}
                <Badges j={j} />
                {resultat?.gagnant === j && <span className="plus-un" key={`${vue.manche}-${vue.numeroPli}`}>+1</span>}
                {!vue.mises && vue.phase === 'mise' && <span className={`adv-ruban ${vue.aMise[j] ? 'ok' : 'attente'}`}>{vue.aMise[j] ? '✓' : '…'}</span>}
              </div>
              <div className="adv-nom">
                <span className="adv-medaillon">☠</span>
                <span className={neonNom(j).className} style={neonNom(j).style}>{pseudo(j)}</span>
                {vue.remplaces?.includes(j) && <span className="adv-robot-mini" title="Un robot joue à sa place"><img className="ico-texte" src="/img/nav_entrainement.webp" alt="" /></span>}
              </div>
              {p.hote === moi && !vue.robots?.includes(j) && !vue.definitifs?.includes(j) && !finie && !connecte(j) && (
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
      <div className={`moi-coin ${aMoi ? 'actif' : ''}`} data-joueur={moi}>
        {vue.phase === 'mise' && vue.meneur === moi && <span className="adv-ouvre" title="Tu ouvres le premier pli">▶ 1er</span>}
        <span className={`moi-nom ${neonNom(moi).className}`} style={neonNom(moi).style}>{pseudo(moi)}</span>
        <Avatar photo={photo(moi)} taille={56} cadre={cadre(moi)} compagnon={compagnon(moi)} />
        <span className="adv-ruban">{vue.mises ? `${vue.plisGagnes[moi]}/${miseDe(moi)}` : vue.aMise[moi] ? '✓' : '…'}</span>
        <Badges j={moi} />
        {resultat?.gagnant === moi && <span className="plus-un" key={`${vue.manche}-${vue.numeroPli}`}>+1</span>}
        {vue.joueurs.indexOf(moi) === vue.couronne && <span className="adv-couronne">👑</span>}
        <span className="moi-pastilles">
          {aMoi && !tigresse && !choixValeur && !choixJoker && vue.phase === 'jeu' && (
            <span className="moi-tour">{vue.salve === moi ? '💥 2e carte !' : 'À toi de jouer !'}{vue.manche <= 2 && <small>{selection ? 'Glisse-la vers le centre ou touche-la encore' : 'Glisse une carte vers le centre'}</small>}</span>
          )}
          {(() => { const o = objectif(moi); return o ? <span key={o.texte} className={`moi-objectif ${o.ton}`}>{o.texte}</span> : null; })()}
        </span>
      </div>

      {/* Ma main */}
      <section className={`main-eventail ${distribution ? 'distribuee' : ''} ${enMise ? 'en-mise' : ''}`} key={`main-${distribution}`}>
        {mainTriee.map((id, i) => {
          const centre = (n - 1) / 2;
          const angle = n > 1 ? ((i - centre) / centre) * angleMax : 0;
          const jouable = aMoi && main.jouables.includes(id);
          const interdite = aMoi && !jouable;
          const levee = selection === id || defausse.includes(id);
          const g = glisse?.id === id ? glisse : null;
          const decalage = (i - centre) * ecart;
          // Tout passe par transform : quand une carte part, les autres se resserrent en douceur.
          const style: CSSProperties = {
            left: '50%',
            transform: g
              ? `translate(calc(-50% + ${decalage}px + var(--dx, 0px)), calc(var(--dy, 0px) - 30px)) rotate(0deg) scale(1.08)`
              : `translate(calc(-50% + ${decalage}px), ${levee ? -34 : Math.abs(i - centre) * 3}px) rotate(${angle}deg)`,
            zIndex: g ? 100 : levee ? 60 : i,
            animationDelay: `${Math.round((50 + (i * vue.joueurs.length + Math.max(0, vue.joueurs.indexOf(moi))) * intervalleDistribution * 1000) + 450)}ms`,
          };
          return (
            <button key={id} type="button" className={`carte-main ${main.carteImposee === id ? 'imposee' : ''} ${jouable ? 'jouable' : ''} ${interdite ? 'interdite' : ''} ${levee ? 'levee' : ''} ${g ? 'glissee' : ''} ${defausse.includes(id) ? 'a-defausser' : ''}`}
              style={style} onPointerDown={(e) => surAppui(e, id)} onPointerMove={surDeplacement} onPointerUp={surRelache}
              onPointerCancel={() => { if (appui.current) clearTimeout(appui.current.minuterie); appui.current = null; setGlisse(null); }}
              onContextMenu={(e) => e.preventDefault()}>
              <img src={`/cartes/${id}.webp`} alt={id} draggable={false} />
              {SPECIALES_HOLO.has(carteParId(id).type) && <span className="holo" aria-hidden="true" />}
            </button>
          );
        })}
      </section>


      {!pliAffiche && vue.phase === 'jeu' && vue.salve === moi && <p className="bandeau">💥 Dernière salve : pose ta deuxième carte !</p>}
      {!pliAffiche && main.carteImposee && main.main.includes(main.carteImposee) && (
        <p className="bandeau">🗡️ {vue.imposee ? pseudo(vue.imposee.par) : 'Mary Thorne'} t’a pris une carte : tu dois la poser à ce pli.</p>
      )}

      {/* Phrases rapides */}
      {p.lancerObjet && !finie && (
        <button type="button" className="bouton-objets" onClick={() => { setPanneauObjets((o) => !o); setObjetChoisi(null); setChatOuvert(false); }} aria-label="Lancer un objet"><img className="rail-img" src="/img/jeu_cadeau.webp" alt="" /></button>
      )}
      {panneauObjets && (
        <div className="panneau-phrases panneau-objets">
          {!objetChoisi ? (
            <>
              <small>Choisis un objet à lancer :</small>
              <div className="grille-lancer">
                {Object.entries(OBJETS).map(([id, o]) => {
                  const nb = p.inventaire?.[id] ?? 0;
                  return (
                    <button key={id} type="button" disabled={nb === 0} onClick={() => setObjetChoisi(id)} title={o.nom}>
                      <Visuel v={o.icone} /><small>{nb}</small>
                    </button>
                  );
                })}
              </div>
              {Object.keys(OBJETS).every((id) => !p.inventaire?.[id]) && <small>Ton coffre est vide : achète des objets à la boutique du port avec tes Louidors.</small>}
            </>
          ) : (
            <>
              <small><Visuel v={OBJETS[objetChoisi].icone} className="visuel-texte" /> {OBJETS[objetChoisi].nom} · sur qui ?</small>
              {autres.map((j) => (
                <button key={j} type="button" onClick={async () => { setPanneauObjets(false); await p.lancerObjet!(objetChoisi, j); setObjetChoisi(null); }}>{pseudo(j)}</button>
              ))}
              <button type="button" className="coupe" onClick={() => setObjetChoisi(null)}>‹ Changer d’objet</button>
            </>
          )}
        </div>
      )}

      <button type="button" className="bouton-bulle" onClick={() => { setChatOuvert((c) => !c); setPanneauObjets(false); }} aria-label="Phrases rapides"><img className="rail-img" src="/img/jeu_chat.webp" alt="" /></button>
      {chatOuvert && (
        <div className="panneau-phrases">
          {p.envoyerReaction && (
            <div className="rangee-emojis">
              {[...EMOJIS, ...(p.emotes ?? [])].map((e) => <button key={e} type="button" onClick={() => { p.envoyerReaction!(e); setChatOuvert(false); }}>{e}</button>)}
            </div>
          )}
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
        <p className="bandeau"><img className="ico-texte" src="/img/nav_entrainement.webp" alt="" /> Un robot a joué pendant ton absence. Tu reprends la main au début de la prochaine manche.</p>
      )}
      {vue.definitifs?.includes(moi) && !finie && <p className="bandeau rouge">Un robot joue à ta place jusqu’à la fin de cette partie.</p>}
      {p.erreur && <p className="bandeau rouge">{p.erreur}</p>}

      {/* Bandeau de mise : compact, pour bien voir sa main */}
      {vue.phase === 'mise' && decompte === 0 && !vue.aMise[moi] && miseLocale?.manche !== vue.manche && !piloteParRobot(moi) && (
        <div className="bandeau-mise">
          <strong className="bandeau-titre">Combien de plis vas-tu gagner ?</strong>
          <div className="boutons-mise compacts">
            {Array.from({ length: vue.cartesParJoueur + 1 }, (_, k) => (
              <button key={k} type="button" className="bouton-mise" onClick={async () => {
                setMiseLocale({ manche: vue.manche, mise: k });
                const ok = await p.envoyer({ type: 'miser', mise: k });
                if (ok === false) setMiseLocale(null);
              }}>{k}</button>
            ))}
          </div>
          <small>▶ {vue.meneur === moi ? 'Tu ouvres' : `${pseudo(vue.meneur)} ouvre`} le premier pli · manche {vue.manche} · {vue.cartesParJoueur} carte{vue.cartesParJoueur > 1 ? 's' : ''}</small>
        </div>
      )}

      {/* Pouvoirs */}
      {pouvoirMoi?.type === 'mary' && pouvoirEnvoye !== `${vue.manche}-${vue.numeroPli}-${vue.pouvoir?.type}` && (
        <Fenetre titre="Mary Thorne" sousTitre="À qui prends-tu une carte au hasard ? Il devra la poser au pli suivant.">
          <div className="boutons-mise">
            {pouvoirMoi.cibles.map((j) => (
              <button key={j} type="button" className="bouton-or petit" disabled={p.enCours} onClick={() => envoyerPouvoir({ type: 'mary', cible: j })}>{pseudo(j)}</button>
            ))}
          </div>
        </Fenetre>
      )}
      {pouvoirMoi?.type === 'planche' && pouvoirEnvoye !== `${vue.manche}-${vue.numeroPli}-${vue.pouvoir?.type}` && (
        <Fenetre titre="Supplice de la planche" sousTitre="Quel Pirate jettes-tu à la mer ?">
          <div className="mini-cartes choix-cartes">
            {pouvoirMoi.pirates.map((i) => {
              const c = vue.pliEnCours[i];
              return (
                <button key={i} type="button" disabled={p.enCours} onClick={() => envoyerPouvoir({ type: 'planche', index: i })}>
                  <img src={`/cartes/${c.carteId}.webp`} alt="" />
                  <small>{c.joueur === moi ? 'Le mien' : pseudo(c.joueur)}</small>
                </button>
              );
            })}
          </div>
        </Fenetre>
      )}
      {pouvoirMoi?.type === 'rosie' && pouvoirEnvoye !== `${vue.manche}-${vue.numeroPli}-${vue.pouvoir?.type}` && (
        <Fenetre titre="Rosie de Laney" sousTitre="Choisis qui commence le prochain pli">
          <div className="boutons-mise">
            {vue.joueurs.map((j) => (
              <button key={j} type="button" className="bouton-or petit" disabled={p.enCours} onClick={() => envoyerPouvoir({ type: 'rosie', choix: j })}>{j === moi ? 'Moi' : pseudo(j)}</button>
            ))}
          </div>
        </Fenetre>
      )}
      {pouvoirMoi?.type === 'rascal' && pouvoirEnvoye !== `${vue.manche}-${vue.numeroPli}-${vue.pouvoir?.type}` && (
        <Fenetre titre="Rascal de Roatan" sousTitre="Ton pari : gagné si ta mise est exacte, perdu sinon">
          <div className="boutons-mise">
            {[0, 10, 20].map((x) => (
              <button key={x} type="button" className="bouton-mise large" disabled={p.enCours} onClick={() => envoyerPouvoir({ type: 'rascal', pari: x })}>{x} pts</button>
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

      {main.revelationJuanita && !pliAffiche && juanitaFermee !== cleJuanita && (
        <Fenetre titre="Juanita Jade" sousTitre="Les cartes non distribuées, pour tes yeux seulement (15 secondes)">
          <div className="mini-cartes">{main.revelationJuanita.map((c) => <img key={c} src={`/cartes/${c}.webp`} alt={c} />)}</div>
          <button type="button" className="bouton-or" onClick={() => setJuanitaFermee(cleJuanita)}>J’ai vu</button>
        </Fenetre>
      )}

      {choixValeur && (
        <Fenetre titre="0 ou 14 ?" sousTitre="Choisis la valeur de ta carte (aucun bonus)">
          <div className="boutons-mise">
            {[0, 14].map((v) => (
              <button key={v} type="button" className="bouton-mise large" onClick={() => { const id = choixValeur; setChoixValeur(null); lancer({ type: 'jouer', carteId: id, valeur: v }, id); }}>{v}</button>
            ))}
          </div>
          <button type="button" className="lien" onClick={() => setChoixValeur(null)}>Annuler</button>
        </Fenetre>
      )}
      {choixJoker && (
        <Fenetre titre="Joker 15" sousTitre="Quelle couleur lances-tu ?">
          <div className="boutons-mise">
            {COULEURS_JOKER.map((co: Couleur) => (
              <button key={co} type="button" className={`bouton-mise large couleur-${co}`} onClick={() => { setChoixJoker(false); lancer({ type: 'jouer', carteId: 'joker_15', couleur: co }, 'joker_15'); }}>
                {co === 'jaune' ? 'Jaune' : co === 'violet' ? 'Violet' : 'Vert'}
              </button>
            ))}
          </div>
          <button type="button" className="lien" onClick={() => setChoixJoker(false)}>Annuler</button>
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
          <PodiumManche vue={vue} classement={classement} photo={photo} cadre={cadre} pseudo={pseudo} />
          <TableauManche vue={vue} classement={classement} moi={moi} pseudo={pseudo} />
          {vue.continuer.includes(moi) || piloteParRobot(moi)
            ? <p className="centre petit-texte">En attente des autres pirates…</p>
            : continuerLocal === vue.manche
              ? <p className="centre petit-texte">C’est noté · en attente des autres pirates…</p>
              : <button type="button" className="bouton-or" onClick={async () => {
                  setContinuerLocal(vue.manche);
                  const ok = await p.envoyer({ type: 'continuer' });
                  if (ok === false) setContinuerLocal(null);
                }}>Continuer</button>}
        </Fenetre>
      )}
      {!pliAffiche && !vue.annulee && vue.phase === 'fin_partie' && (
        <Fenetre titre={jeGagne ? 'Victoire !' : 'Fin de la partie'} large>
          <div className="onglets onglets-fin">
            <button type="button" className={ongletFin === 'podium' ? 'actif' : ''} onClick={() => setOngletFin('podium')}>Podium</button>
            <button type="button" className={ongletFin === 'resume' ? 'actif' : ''} onClick={() => setOngletFin('resume')}>Résumé</button>
          </div>
          {ongletFin === 'resume' ? <ResumePartie vue={vue} pseudo={pseudo} /> : <>
          <div className="podium">
            {[1, 0, 2].map((rang) => {
              const j = classement[rang];
              if (!j) return <div key={rang} />;
              return (
                <div key={j} className={`marche marche-${rang + 1}`}>
                  {rang === 0 && <span className="podium-couronne">👑</span>}
                  <Avatar photo={photo(j)} taille={rang === 0 ? 84 : 64} cadre={cadre(j)} compagnon={compagnon(j)} />
                  <strong>{pseudo(j)}</strong>
                  <Titre perso={persoDe(j)} className="podium-titre" />
                  <span>{vue.scores[j]} pts</span>
                  <div className="socle">{rang + 1}</div>
                </div>
              );
            })}
          </div>
          {vue.entrainement
            ? <p className="centre petit-texte">Partie d’entraînement : elle ne compte pas pour le classement.</p>
            : p.gain
              ? <p className="gain-xp">+{p.gain.xp} XP · +{p.gain.louidors} <span className="piece-or" />{p.gain.niveauApres > p.gain.niveauAvant && <strong> · Niveau {p.gain.niveauApres} atteint !</strong>}</p>
              : <p className="centre petit-texte">Calcul de ton butin…</p>}
          {p.bilan && p.bilan.length > 0 && (
            <div className="bilan-duels">
              {p.bilan.map((b) => (
                <span key={b.adversaire}>⚔ Toi <strong>{b.mes_victoires}</strong> – <strong>{b.ses_victoires}</strong> {pseudo(b.adversaire)}</span>
              ))}
            </div>
          )}
          </>}
          <div className="boutons-fin">
            {p.rejouer && <button type="button" className="bouton-or" onClick={p.rejouer}>Rejouer</button>}
            <button type="button" className="bouton-sombre" onClick={p.retourAccueil}>Retour au port</button>
          </div>
        </Fenetre>
      )}
      {!pliAffiche && vue.phase === 'fin_partie' && !vue.annulee && (() => {
        // Célébration choisie par le vainqueur (vue par toute la table), sinon la pluie d'or pour le gagnant.
        const pluie = article(persoDe(classement[0])?.victoire)?.emojis;
        return pluie ? <PluieEmojis emojis={pluie} /> : jeGagne ? <PluieOr /> : null;
      })()}
      {vue.annulee && (
        <Fenetre titre="Partie annulée" sousTitre="Plus aucun pirate humain à bord : cette partie ne compte pas.">
          <button type="button" className="bouton-or" onClick={p.retourAccueil}>Retour au port</button>
        </Fenetre>
      )}

      {/* Tableau des scores : le pirate à abattre, le record à battre, puis le classement */}
      {scoresOuverts && (
        <TableauScores vue={vue} moi={moi} pseudo={pseudo} photo={photo} cadre={cadre} record={p.record ?? null} fermer={() => setScoresOuverts(false)} />
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
          {(() => { const r = regleCarte(zoom); return <div className="zoom-regle"><strong>{r.nom}</strong><p>{r.texte}</p></div>; })()}
        </div>
      )}

      {/* Décompte */}
      {decompte > 0 && decompte <= 4 && (
        <div className="voile decompte" aria-live="polite">
          <span key={decompte} className={decompte === 1 ? 'abordage' : ''}>{decompte === 1 ? 'À l’abordage !' : decompte - 1}</span>
        </div>
      )}

      {/* Grands moments : animation plein écran (un toucher pour passer) */}
      {grandeAnim && (beteDe(grandeAnim)
        ? <BeteAnimation evt={grandeAnim} passer={() => setGrandeAnim(null)} />
        : <GrandeAnimation evt={grandeAnim} passer={() => setGrandeAnim(null)} />)}

      {/* Distribution des cartes */}
      {volsDistribution.length > 0 && (
        <div className="vols" aria-hidden="true">
          {volsDistribution.map((v) => (
            <img key={v.k} src="/decor/dos-carte.webp" alt="" className="carte-volante"
              style={{ left: v.x0, top: v.y0, animationDelay: `${v.retard}ms`, ['--dx' as string]: `${v.x1 - v.x0}px`, ['--dy' as string]: `${v.y1 - v.y0}px` }} />
          ))}
        </div>
      )}

      {/* Personnalisations : entrées en scène et effets de pli */}
      <EffetsPerso racine={racine} entrees={entrees} pli={resultat?.gagnant ? { joueur: resultat.gagnant, effet: persoDe(resultat.gagnant)?.pli ?? null, cle: `${vue.manche}-${vue.joueurs.reduce((t, j) => t + (vue.plisGagnes[j] ?? 0), 0)}` } : null} />

      {/* Objets lancés et réactions */}
      <Projectiles racine={racine} lancers={p.lancers ?? []} reactions={(p.reactions ?? []).filter((r) => !muets.includes(r.de))} pseudo={pseudo} />

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

/** Objets qui volent d'un joueur à l'autre, et réactions emoji au-dessus des avatars. */
function Projectiles({ racine, lancers, reactions, pseudo }: {
  racine: RefObject<HTMLDivElement | null>;
  lancers: Array<{ id: number; de: string; a: string; objet: string }>;
  reactions: Array<{ cle: number; de: string; emoji: string }>;
  pseudo: (id: string) => string;
}) {
  // La cible encaisse : son avatar tremble à l'impact.
  const vus = useRef(new Set<number>());
  useEffect(() => {
    for (const l of lancers) {
      if (vus.current.has(l.id)) continue;
      vus.current.add(l.id);
      const grand = OBJETS[l.objet]?.grand;
      const el = racine.current?.querySelector<HTMLElement>(`[data-joueur="${l.a}"]`);
      if (!el) continue;
      const classe = grand || l.objet === 'boulet' ? 'cible-secouee-fort' : 'cible-secouee';
      setTimeout(() => { el.classList.add(classe); setTimeout(() => el.classList.remove(classe), grand ? 1400 : 700); }, grand ? 1000 : 800);
    }
  }, [lancers, racine]);
  const centre = (id: string) => {
    const r = racine.current;
    const c = r ? centreDans(r, r.querySelector(`[data-joueur="${id}"]`)) : null;
    return c ?? { x: (r?.offsetWidth ?? 0) / 2, y: (r?.offsetHeight ?? 0) / 2 };
  };
  return (
    <div className="projectiles" aria-hidden="true">
      {lancers.map((l) => {
        const a = centre(l.de), b = centre(l.a);
        const o = OBJETS[l.objet];
        if (!o) return null;
        const legende = `${pseudo(l.de)} ${o.phrase} ${pseudo(l.a)}`;
        if (o.grand) return <GrandCadeau key={l.id} objet={l.objet} cible={b} legende={legende} />;
        const imp: Impact = IMPACTS[l.objet] ?? { eclats: [o.icone], mode: 'gerbe' };
        const vol = { left: a.x, top: a.y, ['--dx' as string]: `${b.x - a.x}px`, ['--dy' as string]: `${b.y - a.y}px` };
        const ici = { left: b.x, top: b.y };
        return (
          <div key={l.id} className={imp.special === 'fumee' ? 'impact-secousse' : undefined}>
            {[2, 1, 0].map((k) => <span key={k} className={`projectile ${k ? 'trainee' : ''}`} style={{ ...vol, animationDelay: `${k * 0.045}s`, ['--o' as string]: 1 - k * 0.32 }}><Visuel v={o.icone} /></span>)}
            <span className="impact-onde" style={{ ...ici, ['--flash' as string]: imp.flash ?? '#ffffff' }} />
            {imp.flash && <span className="impact-flash" style={{ ...ici, ['--flash' as string]: imp.flash }} />}
            {imp.special === 'tache' && (
              <span className="impact-tache" style={{ ...ici, ['--c' as string]: imp.couleur }}>
                {[0, 1, 2, 3, 4].map((k) => <i key={k} style={{ ['--k' as string]: k }} />)}
              </span>
            )}
            {imp.special === 'larmes' && (
              <span className="impact-larmes" style={ici}>{[0, 1, 2, 3, 4, 5].map((k) => <i key={k} style={{ ['--k' as string]: k }}>💧</i>)}</span>
            )}
            {imp.special === 'fumee' && <span className="impact-fumee" style={ici}>{[0, 1, 2, 3].map((k) => <i key={k} style={{ ['--k' as string]: k }} />)}</span>}
            {imp.special === 'couronne' ? <span className="impact-couronne" style={ici}><Visuel v={o.icone} /></span>
              : imp.special === 'orbite' ? <span className="impact-orbite" style={ici}><i><Visuel v={o.icone} /></i></span>
              : <span className={`impact-objet ${imp.special === 'drapeau' ? 'agite' : ''}`} style={ici}><Visuel v={o.icone} /></span>}
            <Eclats x={b.x} y={b.y} emojis={imp.eclats} mode={imp.mode} />
            {imp.texte && <span className="impact-texte" style={{ ...ici, ['--flash' as string]: imp.flash ?? '#ff2a4a' }}>{imp.texte}</span>}
            <span className="legende-objet" style={ici}>{legende}</span>
          </div>
        );
      })}
      {reactions.map((r) => {
        const a = centre(r.de);
        return <span key={r.cle} className="reaction-emoji" style={{ left: a.x, top: a.y }}>{r.emoji}</span>;
      })}
    </div>
  );
}

// ================= Objets lancés : effets à l'impact, et grands cadeaux sur toute la table =================
type ModeEclats = 'gerbe' | 'pluie' | 'tourbillon' | 'explosion';
type Impact = { eclats: string[]; mode: ModeEclats; texte?: string; flash?: string; special?: 'tache' | 'larmes' | 'fumee' | 'couronne' | 'orbite' | 'drapeau'; couleur?: string };
const IMPACTS: Record<string, Impact> = {
  mouchoirs: { eclats: [IMAGE_OBJET.mouchoirs, '🤧', '💧'], mode: 'pluie', texte: 'SNIF !', flash: '#8fd3ff', special: 'larmes' },
  drapeau_blanc: { eclats: ['🕊️', '🕊️', '🪶'], mode: 'tourbillon', texte: 'JE ME RENDS !', flash: '#ffffff', special: 'drapeau' },
  tomate: { eclats: [FX.eclaboussure, '💦', IMAGE_OBJET.tomate], mode: 'gerbe', texte: 'SPLATCH !', flash: '#ff2a2a', special: 'tache', couleur: '#d4161b' },
  poisson: { eclats: [IMAGE_OBJET.poisson, '💦', '🫧'], mode: 'gerbe', texte: 'SPLAF !', flash: '#6fd3ff', special: 'tache', couleur: '#7fb7a8' },
  rhum: { eclats: [IMAGE_OBJET.rhum, '🫧', '🍻'], mode: 'gerbe', texte: 'SANTÉ !', flash: '#ffcc33', special: 'tache', couleur: '#f3c55a' },
  rose: { eclats: [FX.rose, '🌸', '💗', FX.rose], mode: 'pluie', texte: '♥', flash: '#ff4fd8' },
  perroquet: { eclats: ['🪶', '🪶', '💬'], mode: 'tourbillon', texte: 'COÔÔA !', flash: '#2dff7a', special: 'orbite' },
  doigt: { eclats: ['💢', '💢', '😤'], mode: 'gerbe', texte: 'HÉ !', flash: '#ff7a1a' },
  boulet: { eclats: ['💥', FX.flamme, FX.fumee, '🔥'], mode: 'explosion', texte: 'BOUM !', flash: '#ff7a1a', special: 'fumee' },
  couronne: { eclats: ['✨', FX.etoiles, '✨', FX.gemme], mode: 'tourbillon', texte: 'VIVE LE ROI !', flash: '#ffcc33', special: 'couronne' },
};

function Eclats({ x, y, emojis, mode }: { x: number; y: number; emojis: string[]; mode: ModeEclats }) {
  const parts = useMemo(() => Array.from({ length: mode === 'explosion' ? 18 : 14 }, (_, k) => {
    const a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90;
    return { k, e: emojis[k % emojis.length], tx: Math.cos(a) * d, ty: Math.sin(a) * d - (mode === 'gerbe' ? 40 : 0),
      dl: Math.random() * 0.25, s: 0.6 + Math.random() * 0.8, r: Math.random() * 720 - 360, px: (Math.random() - 0.5) * 220 };
  }), [emojis, mode]);
  return (
    <>
      {parts.map((p) => (
        <span key={p.k} className={`eclat eclat-${mode}`} style={{ left: x, top: y, animationDelay: `${0.8 + p.dl}s`,
          ['--tx' as string]: `${p.tx}px`, ['--ty' as string]: `${p.ty}px`, ['--s' as string]: p.s, ['--r' as string]: `${p.r}deg`, ['--px' as string]: `${p.px}px`, ['--k' as string]: p.k }}><Visuel v={p.e} /></span>
      ))}
    </>
  );
}

// ---------- Le cadeau ultime : la Tempête d'insultes (8 s) ----------
const INSULTES = [
  'T’es nul !', 'T’es naze !', 'Tocard !', 'Marin d’eau douce !', 'Bouse de mouette !', 'Rat de cale !', 'Mollusque !',
  'Moule à gaufres !', 'Bachi-bouzouk !', 'Va ramer !', 'Boulet !', 'Crabe mou !', 'Ectoplasme !', 'Naze de chez naze !',
  'Même le perroquet joue mieux !', 'Retourne pêcher !', 'Loser !', 'Mauvais !', 'Patate !', 'Moussaillon de pacotille !',
  'Tu joues avec les pieds !', 'Cornichon !', 'Sardine !', 'Zéro pointé !',
];
const COULEURS_INSULTES = ['#ff2a4a', '#ffcc33', '#2ee6ff', '#b866ff', '#2dff7a', '#ff4fd8', '#ff7a1a'];
function TempeteInsultes({ cible }: { cible: { x: number; y: number } }) {
  const h = useMemo(() => {
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    const melange = [...INSULTES].sort(() => Math.random() - 0.5);
    return {
      pluie: Array.from({ length: 34 }, (_, k) => ({
        k, t: melange[k % melange.length], x: r(4, 92), dl: 1 + r(0, 4.4), du: r(1.6, 2.4), s: r(0.75, 1.3), rot: r(-18, 18),
        c: COULEURS_INSULTES[k % COULEURS_INSULTES.length], vx: r(-8, 8),
      })),
      eclats: Array.from({ length: 7 }, (_, k) => ({
        k, t: melange[(k + 11) % melange.length].toUpperCase(), dl: 1.4 + k * 0.68, x: r(-22, 22), y: r(-14, 14), rot: r(-12, 12),
        c: COULEURS_INSULTES[(k + 2) % COULEURS_INSULTES.length],
      })),
      gouttes: Array.from({ length: 60 }, (_, k) => ({ k, x: r(0, 100), dl: r(0, 1.2), du: r(0.45, 0.8) })),
      eclairs: [0.15, 0.55, 3.45, 3.6, 6.45],
    };
  }, []);
  return (
    <div className="gc-tempete" aria-hidden="true">
      <div className="ti-ciel" />
      <div className="ti-nuage n1" /><div className="ti-nuage n2" /><div className="ti-nuage n3" />
      {h.eclairs.map((d, i) => <div key={i} className="ti-eclair" style={{ animationDelay: `${d}s` }} />)}
      <div className="ti-gouttes">{h.gouttes.map((g) => <i key={g.k} style={{ left: `${g.x}%`, animationDelay: `${g.dl}s`, animationDuration: `${g.du}s` }} />)}</div>
      <div className="ti-cible" style={{ left: cible.x, top: cible.y }}>
        <span className="ti-anneau" /><span className="ti-anneau a2" />
        <span className="ti-nuage-perso">🌩️</span>
      </div>
      {h.pluie.map((p) => (
        <span key={p.k} className="ti-insulte" style={{
          left: `${p.x}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.du}s`, color: p.c,
          ['--s' as string]: p.s, ['--rot' as string]: `${p.rot}deg`, ['--c' as string]: p.c, ['--vx' as string]: `${p.vx}vw`,
          ['--cx' as string]: `${cible.x}px`, ['--cy' as string]: `${cible.y}px`,
        }}>{p.t}</span>
      ))}
      {h.eclats.map((e) => (
        <span key={e.k} className="ti-eclat" style={{
          left: '50%', top: '50%', animationDelay: `${e.dl}s`, ['--c' as string]: e.c,
          ['--x' as string]: `${e.x}vmin`, ['--y' as string]: `${e.y}vmin`, ['--rot' as string]: `${e.rot}deg`,
        }}>{e.t}</span>
      ))}
      <div className="ti-final" style={{ left: '50%', top: '50%' }}>
        <span className="ti-tampon">COULÉ !</span>
      </div>
    </div>
  );
}

/** Les cadeaux spectaculaires : 4,5 s d'animation sur toute la table, vue par tous. */
function GrandCadeau({ objet, cible, legende }: { objet: string; cible: { x: number; y: number }; legende: string }) {
  const hasard = useMemo(() => {
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    return {
      bouquets: Array.from({ length: 8 }, (_, k) => ({ k, x: r(12, 88), y: r(12, 50), dl: 0.9 + k * 0.4 + r(0, 0.15), c: ['#ff2a4a', '#ffcc33', '#2dff7a', '#2ee6ff', '#b866ff', '#ff4fd8', '#ffffff', '#ff7a1a'][k % 8] })),
      paillettes: Array.from({ length: 36 }, (_, k) => ({ k, x: r(0, 100), dl: 3.6 + r(0, 1), du: r(1.2, 2) })),
      pieces: Array.from({ length: 56 }, (_, k) => ({ k, x: r(0, 100), dl: 0.4 + r(0, 3), du: r(1.4, 2.4), s: r(0.6, 1.3), rot: r(-540, 540), gemme: k % 6 === 0 ? [FX.gemme, FX.gemme, FX.piece][k % 3] : null })),
      boulets: Array.from({ length: 5 }, (_, k) => ({ k, y: r(20, 80), dl: 0.6 + k * 0.45 })),
      echardes: Array.from({ length: 14 }, (_, k) => ({ k, a: r(0, 360), d: r(60, 150), dl: 1.15 + (k % 5) * 0.45, e: ['🪵', '🔥', '💨'][k % 3] })),
      spectres: Array.from({ length: 5 }, (_, k) => ({ k, x: r(8, 92), dl: 1 + k * 0.55, du: r(2.2, 3) })),
      brumes: [0, 1, 2],
    };
  }, []);
  return (
    <div className={`grand-cadeau gc-${objet}`} aria-hidden="true" style={{ ['--cx' as string]: `${cible.x}px`, ['--cy' as string]: `${cible.y}px` }}>
      <div className="gc-voile" />
      {objet !== 'tempete_insultes' && (
        <div className="gc-intro"><span className="gc-intro-rayons" /><span className="gc-intro-icone"><Visuel v={OBJETS[objet]?.icone} /></span></div>
      )}
      {objet === 'feu_artifice' && (
        <>
          {hasard.bouquets.map((b) => (
            <span key={`f${b.k}`} className="gc-fusee" style={{ left: `${b.x}%`, ['--y' as string]: `${b.y}%`, ['--c' as string]: b.c, animationDelay: `${b.dl - 0.55}s` }} />
          ))}
          {hasard.bouquets.map((b) => (
            <div key={b.k} className="gc-bouquet" style={{ left: `${b.x}%`, top: `${b.y}%`, ['--c' as string]: b.c, animationDelay: `${b.dl}s` }}>
              {Array.from({ length: 24 }, (_, i) => <i key={i} style={{ ['--a' as string]: `${i * 15}deg`, animationDelay: `${b.dl}s` }} />)}
            </div>
          ))}
          {hasard.paillettes.map((p) => <span key={`p${p.k}`} className="gc-paillette" style={{ left: `${p.x}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.du}s` }} />)}
        </>
      )}
      {objet === 'bordee' && (
        <>
          {hasard.boulets.map((b) => <span key={`c${b.k}`} className="gc-canon" style={{ top: `${b.y}%`, animationDelay: `${b.dl}s` }} />)}
          {hasard.boulets.map((b) => (
            <span key={b.k} className="gc-boulet" style={{ top: `${b.y}%`, animationDelay: `${b.dl}s`, ['--cx' as string]: `${cible.x}px`, ['--cy' as string]: `${cible.y}px` }} />
          ))}
          {hasard.echardes.map((e) => (
            <span key={`e${e.k}`} className="gc-echarde" style={{ left: cible.x, top: cible.y, animationDelay: `${e.dl}s`, ['--a' as string]: `${e.a}deg`, ['--d' as string]: `${e.d}px` }}>{e.e}</span>
          ))}
          {hasard.boulets.map((b) => <span key={`e${b.k}`} className="gc-explosion" style={{ left: cible.x + (b.k - 2) * 26, top: cible.y + ((b.k * 37) % 50) - 25, animationDelay: `${b.dl + 0.55}s` }}>💥</span>)}
          <div className="gc-fumee" style={{ left: cible.x, top: cible.y }} />
        </>
      )}
      {objet === 'pluie_tresor' && (
        <>
          <span className="gc-rayons" style={{ left: cible.x, top: cible.y }} />
          {hasard.pieces.map((p) => (
            <span key={p.k} className={p.gemme ? 'gc-piece gemme' : 'gc-piece'} style={{ left: `${p.x}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.du}s`, ['--s' as string]: p.s, ['--rot' as string]: `${p.rot}deg` }}><Visuel v={p.gemme} /></span>
          ))}
          <span className="gc-coffre" style={{ left: cible.x, top: cible.y }}><Visuel v={IMAGE_OBJET.pluie_tresor} /></span>
        </>
      )}
      {objet === 'navire_fantome' && (
        <>
          {hasard.brumes.map((k) => <div key={k} className={`gc-brume b${k}`} />)}
          <div className="gc-eclair-vert" />
          {hasard.spectres.map((p) => <span key={`s${p.k}`} className="gc-spectre" style={{ left: `${p.x}%`, animationDelay: `${p.dl}s`, animationDuration: `${p.du}s` }}><Visuel v={FX.fantome} /></span>)}
          <div className="gc-navire">
            <svg viewBox="0 0 220 170" aria-hidden="true">
              <g fill="none" stroke="#bfffe6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round">
                <path d="M20 118h180l-22 34H46z" fill="rgba(120,255,200,.22)" />
                <path d="M30 118l8-14h150l10 14" fill="rgba(120,255,200,.15)" />
                <path d="M70 104V18M118 104V8M164 104V30" />
                <path d="M50 30q20 14 40 0v34q-20 12-40 0zM96 20q22 16 44 0v40q-22 14-44 0zM146 40q18 12 36 0v30q-18 10-36 0z" fill="rgba(160,255,215,.18)" strokeDasharray="6 5" />
                <path d="M118 8l18 6-18 6" fill="rgba(160,255,215,.4)" />
                <path d="M60 131h10M90 131h10M120 131h10M150 131h10" />
                <path d="M200 118l14-10" />
              </g>
              <g fill="#bfffe6"><circle cx="112" cy="40" r="5" /><circle cx="124" cy="40" r="5" /></g>
            </svg>
            <span className="gc-navire-fantome"><Visuel v={IMAGE_OBJET.navire_fantome} /></span>
          </div>
          <span className="gc-hante" style={{ left: cible.x, top: cible.y }}><Visuel v={FX.fantome} /></span>
        </>
      )}
      {objet === 'tempete_insultes' && <TempeteInsultes cible={cible} />}
      {objet === 'kraken_poche' && (
        <div className="gc-vague" />
      )}
      {objet === 'kraken_poche' && <span className="gc-encre" style={{ left: cible.x, top: cible.y }}>{[0, 1, 2, 3, 4, 5, 6].map((k) => <i key={k} style={{ ['--k' as string]: k }} />)}</span>}
      {objet === 'kraken_poche' && (
        <div className="gc-kraken" style={{ left: cible.x, top: cible.y }}>
          {[-70, -35, 0, 35, 70].map((r, k) => (
            <div key={k} className="gc-tentacule" style={{ rotate: `${r}deg`, animationDelay: `${k * 0.12}s` }}><div className="tentacule-corps" style={{ animationDelay: `${k * 0.12}s` }}><Tentacule /></div></div>
          ))}
          <span className="gc-kraken-tete"><Visuel v={IMAGE_OBJET.kraken_poche} /></span>
        </div>
      )}
      <p className="gc-legende">{legende}</p>
    </div>
  );
}

/** Cartes qui brillent d'un reflet holographique dans la main. */
const SPECIALES_HOLO = new Set(['skull_king', 'sirene', 'pirate', 'tigresse', 'second', 'kraken', 'baleine', 'raie', 'joker', 'davy']);

/** Durée d'affichage d'un cadeau lancé (ms). */
export function dureeCadeau(objet: string): number {
  if (objet === 'tempete_insultes') return 8800;
  return OBJETS[objet]?.grand ? 5600 : 3400;
}

/** Le son d'un cadeau lancé, calé sur son animation. */
export function jouerSonCadeau(objet: string) {
  const sons: Record<string, () => void> = {
    feu_artifice: () => [300, 700, 1100, 1500, 1900, 2300, 2700, 3100].forEach((ms) => setTimeout(son.impact, ms)),
    bordee: () => [600, 1050, 1500, 1950, 2400].forEach((ms) => setTimeout(son.impact, ms + 550)),
    pluie_tresor: () => [200, 500, 800, 1100, 1500, 1900, 2400, 2900, 3300].forEach((ms) => setTimeout(son.piece, ms)),
    navire_fantome: () => sonBete.raie(),
    kraken_poche: () => sonBete.kraken(),
    tempete_insultes: () => sonBete.tempete(),
  };
  if (OBJETS[objet]?.grand) { sons[objet]?.(); vibrer(200); }
  else setTimeout(() => son.impact(), 850);
}

/** Aperçu d'un cadeau dans la boutique : la même animation qu'en partie, lancée sur une cible factice. */
export function ApercuCadeau({ objet, pseudo, photo, cadre, fin }: { objet: string; pseudo: string; photo: string | null; cadre?: string | null; fin: () => void }) {
  const racine = useRef<HTMLDivElement>(null);
  const [pret, setPret] = useState(false);
  const t = useMemo(() => ({ w: window.innerWidth, h: window.innerHeight }), []);
  useEffect(() => {
    debloquerSon();
    setPret(true);
    jouerSonCadeau(objet);
    const minuterie = setTimeout(fin, dureeCadeau(objet) + 200);
    return () => clearTimeout(minuterie);
  }, [objet, fin]);
  return (
    <div ref={racine} className="apercu-cadeau" onClick={fin} style={{ ['--gh' as string]: `${t.h / 100}px`, ['--gw' as string]: `${t.w / 100}px` }}>
      <div className="apercu-table" />
      <div className="apercu-joueur cible" data-joueur="cible"><Avatar photo={null} taille={78} /><span>Ta cible</span></div>
      <div className="apercu-joueur moi" data-joueur="moi"><Avatar photo={photo} taille={56} cadre={cadre} /><span>{pseudo}</span></div>
      {pret && <Projectiles racine={racine} lancers={[{ id: 1, de: 'moi', a: 'cible', objet }]} reactions={[]} pseudo={(id) => (id === 'moi' ? pseudo : 'sa cible')} />}
      <p className="apercu-aide">Touche l’écran pour fermer</p>
    </div>
  );
}

/** Résumé de fin de partie : les exploits et les naufrages de chacun. */
function ResumePartie({ vue, pseudo }: { vue: VueJeu; pseudo: (id: string) => string }) {
  const lignes = vue.historique.flatMap((m, k) => m.map((x) => ({ ...x, manche: k + 1 })));
  const parJoueur = (f: (j: string) => number) => {
    let meilleur: string | null = null, v = -Infinity;
    for (const j of vue.joueurs) { const x = f(j); if (x > v) { v = x; meilleur = j; } }
    return meilleur && v > 0 ? { j: meilleur, v } : null;
  };
  const precis = parJoueur((j) => lignes.filter((l) => l.joueur === j && l.reussie).length);
  const butin = parJoueur((j) => lignes.filter((l) => l.joueur === j).reduce((t, l) => t + l.bonus + l.alliances, 0));
  const top = lignes.reduce<(typeof lignes)[number] | null>((a, l) => (!a || l.total > a.total ? l : a), null);
  const flop = lignes.reduce<(typeof lignes)[number] | null>((a, l) => (!a || l.total < a.total ? l : a), null);
  const st = vue.stats ?? {};
  const regicide = parJoueur((j) => st[j]?.sk ?? 0);
  const chasseur = parJoueur((j) => st[j]?.pir ?? 0);
  const kraken = parJoueur((j) => st[j]?.kraken ?? 0);
  const noir = parJoueur((j) => st[j]?.q14n ?? 0);
  const items: Array<[string, string, string]> = [];
  if (precis) items.push(['🎯', 'Le plus précis', `${pseudo(precis.j)} · ${precis.v}/10 mises réussies`]);
  if (top && top.total > 0) items.push(['🚀', 'Manche de légende', `${pseudo(top.joueur)} · +${top.total} à la manche ${top.manche}`]);
  if (butin) items.push(['💰', 'Roi du butin', `${pseudo(butin.j)} · +${butin.v} de bonus`]);
  if (regicide) items.push(['🧜', 'Régicide', `${pseudo(regicide.j)} · ${regicide.v} Skull King capturé${regicide.v > 1 ? 's' : ''}`]);
  if (chasseur) items.push(['💀', 'Chasseur de pirates', `${pseudo(chasseur.j)} · ${chasseur.v} pirate${chasseur.v > 1 ? 's' : ''} capturé${chasseur.v > 1 ? 's' : ''}`]);
  if (noir) items.push(['🏴‍☠️', 'Pavillon noir', `${pseudo(noir.j)} · ${noir.v} × le 14 noir`]);
  if (kraken) items.push(['🐙', 'Ami du Kraken', `${pseudo(kraken.j)} · ${kraken.v} pli${kraken.v > 1 ? 's' : ''} englouti${kraken.v > 1 ? 's' : ''}`]);
  if (flop && flop.total < 0) items.push(['🌊', 'Naufrage du jour', `${pseudo(flop.joueur)} · ${flop.total} à la manche ${flop.manche}`]);
  const partager = () => {
    const texte = `☠️ Skull Arena — résumé de la partie\n${items.map(([i, t, d]) => `${i} ${t} : ${d}`).join('\n')}\nhttps://skull-arena-one.vercel.app`;
    if (navigator.share) navigator.share({ text: texte }).catch(() => {});
    else navigator.clipboard?.writeText(texte).catch(() => {});
  };
  return (
    <div className="resume-partie">
      <ul>
        {items.map(([i, t, d]) => <li key={t}><span className="resume-icone">{i}</span><span><strong>{t}</strong><small>{d}</small></span></li>)}
      </ul>
      <button type="button" className="lien" onClick={partager}>📤 Partager le résumé</button>
    </div>
  );
}

const DUREE_GRANDE_ANIM = 1700;
/** Centre d'un élément dans le repère de la table (qui peut être pivotée d'un quart de tour). */
function centreDans(racine: HTMLElement, el: Element | null | undefined): { x: number; y: number } | null {
  if (!el) return null;
  const b = racine.getBoundingClientRect(), e = el.getBoundingClientRect();
  const px = e.left + e.width / 2, py = e.top + e.height / 2;
  if (racine.classList.contains('pivote')) return { x: py - b.top, y: b.right - px };
  return { x: px - b.left, y: py - b.top };
}
/** Marge de chaque côté de la main (centrée) : la 1re carte ne passe pas sous mon avatar en bas à gauche. */
const MARGE_MAIN = 112;

type TypeEvenement = 'regicide' | 'roi' | 'abordage' | 'kraken' | 'baleine';
interface GrandEvenement { type: TypeEvenement; /** Classe d'animation, si différente du type. */ classe?: string; titre: string; texte: string; carte: string; victimes: string[]; son: 'regicide' | 'roiFrappe' | 'abordageFort' | 'krakenFort' | 'baleineForte' }

/** Repère les grands moments d'un pli terminé. */
function detecterEvenement(
  cartes: Array<{ joueur: string; carteId: string; tigresse?: 'pirate' | 'fuite' }>,
  r: { effet: string; gagnant: string | null; indexGagnant: number | null; bonus: number; retire?: number | null; detruits?: number[]; davy?: { joueur: string; points: number } | null },
  pseudo: (id: string) => string,
): GrandEvenement | null {
  const ids = cartes.map((c) => c.carteId);
  if (r.detruits?.length) {
    return { type: 'kraken', classe: 'davy', titre: 'Le Casier de Davy Jones !', carte: 'davy_jones', son: 'krakenFort', victimes: r.detruits.map((i) => ids[i]),
      texte: `${r.detruits.length > 1 ? 'Les léviathans sombrent' : 'Le léviathan sombre'} au fond des mers · ${pseudo(r.davy?.joueur ?? cartes.find((c) => c.carteId === 'davy_jones')?.joueur ?? '')} +${20 * r.detruits.length}` };
  }
  if (r.retire !== null && r.retire !== undefined) {
    return { type: 'abordage', classe: 'planche', titre: 'Par-dessus bord !', carte: 'planche', son: 'abordageFort', victimes: [ids[r.retire]],
      texte: `Le Pirate de ${pseudo(cartes[r.retire].joueur)} marche sur la planche` };
  }
  if (r.effet === 'raie') {
    const g = r.gagnant && r.indexGagnant !== null ? cartes[r.indexGagnant] : null;
    return { type: 'baleine', classe: 'raie', titre: 'La Raie tachetée !', carte: 'raie', victimes: ids.filter((i) => i !== 'raie'), son: 'baleineForte',
      texte: g ? `${pseudo(g.joueur)} l’emporte avec la plus petite carte` : 'Le pli est dispersé par les flots' };
  }
  if (r.effet === 'kraken') {
    return { type: 'kraken', titre: 'Le Kraken !', texte: 'Le pli est englouti par les abysses', carte: 'kraken', victimes: ids.filter((i) => i !== 'kraken'), son: 'krakenFort' };
  }
  if (r.effet === 'baleine') {
    const g = r.gagnant && r.indexGagnant !== null ? cartes[r.indexGagnant] : null;
    return {
      type: 'baleine', titre: 'La Baleine blanche !', carte: 'baleine', victimes: ids.filter((i) => i !== 'baleine'), son: 'baleineForte',
      texte: g ? `${pseudo(g.joueur)} l’emporte avec le ${(carteParId(g.carteId) as { valeur?: number }).valeur ?? ''}` : 'Le pli est dispersé par les flots',
    };
  }
  if (!r.gagnant || r.indexGagnant === null) return null;
  const gagnante = cartes[r.indexGagnant];
  const type = carteParId(gagnante.carteId).type;
  const nom = pseudo(r.gagnant);
  const de = (t: string) => cartes.filter((c) => c !== gagnante && role(c) === t).map((c) => c.carteId);
  if (type === 'sirene') {
    const rois = de('skull_king');
    if (rois.length) return { type: 'regicide', titre: 'Régicide !', texte: `${nom} capture le Skull King avec une Sirène · +40`, carte: gagnante.carteId, victimes: rois, son: 'regicide' };
  }
  if (type === 'skull_king' || type === 'sirene') {
    const seconds = de('second');
    if (seconds.length && type === 'skull_king' && !de('pirate').length) {
      return { type: 'roi', titre: 'Le Second tombe !', texte: `${nom} capture le Second · +30`, carte: gagnante.carteId, victimes: seconds, son: 'roiFrappe' };
    }
  }
  if (type === 'second') {
    const pirates = de('pirate');
    if (pirates.length) return { type: 'abordage', titre: 'Le Second !', texte: `${nom} capture ${pirates.length > 1 ? 'les Pirates et leurs pouvoirs' : 'le Pirate et son pouvoir'}`, carte: gagnante.carteId, victimes: pirates, son: 'abordageFort' };
  }
  if (type === 'skull_king') {
    const pirates = de('pirate');
    if (pirates.length) return { type: 'roi', titre: 'Le Roi frappe !', texte: `${nom} capture ${pirates.length} pirate${pirates.length > 1 ? 's' : ''} · +${30 * pirates.length}`, carte: gagnante.carteId, victimes: pirates, son: 'roiFrappe' };
  }
  if (role(gagnante) === 'pirate') {
    const sirenes = de('sirene');
    if (sirenes.length) return { type: 'abordage', titre: 'À l’abordage !', texte: `${nom} capture ${sirenes.length > 1 ? 'les Sirènes' : 'la Sirène'} · +${20 * sirenes.length}`, carte: gagnante.carteId, victimes: sirenes, son: 'abordageFort' };
  }
  return null;
}

/** L'animation plein écran : la carte gagnante en grand, les victimes emportées, des particules. */
export function GrandeAnimation({ evt, passer }: { evt: GrandEvenement; passer: () => void }) {
  const particules = useMemo(() => Array.from({ length: 26 }, (_, k) => ({
    k, x: Math.random() * 100, y: Math.random() * 100, r: Math.random() * 0.6, t: 0.6 + Math.random() * 0.9, s: 0.6 + Math.random() * 1.1,
  })), []);
  return (
    <div className={`grande-anim anim-${evt.type} ${evt.classe ? `anim-${evt.classe}` : ''}`} onClick={passer} role="alert">
      <div className="ga-fond" />
      <div className="ga-particules" aria-hidden="true">
        {particules.map((p) => (
          <span key={p.k} style={{ left: `${p.x}%`, top: `${p.y}%`, animationDelay: `${p.r}s`, animationDuration: `${p.t}s`, ['--s' as string]: p.s }} />
        ))}
      </div>
      <div className="ga-scene">
        {evt.victimes.slice(0, 6).map((v, i) => (
          <img key={v} className="ga-victime" src={`/cartes/${v}.webp`} alt=""
            style={{ ['--i' as string]: i, ['--n' as string]: Math.min(evt.victimes.length, 6) }} />
        ))}
        <img className="ga-carte" src={`/cartes/${evt.carte}.webp`} alt="" />
      </div>
      <div className="ga-texte">
        <strong>{evt.titre}</strong>
        <span>{evt.texte}</span>
      </div>
      <small className="ga-passer">toucher pour passer</small>
    </div>
  );
}

// ================= Les bêtes : Kraken, Baleine blanche, Raie tachetée (plein écran, 4 s) =================
export const DUREE_BETE = 4000;
type Bete = 'kraken' | 'baleine' | 'raie';
export function beteDe(evt: { type: string; classe?: string }): Bete | null {
  if (evt.classe === 'raie') return 'raie';
  if (evt.classe) return null; // Davy Jones, Planche : animation classique
  return evt.type === 'kraken' ? 'kraken' : evt.type === 'baleine' ? 'baleine' : null;
}
const NOMS_BETES: Record<Bete, { sur: string; nom: string }> = {
  kraken: { sur: 'Des abysses surgit', nom: 'Le Kraken' },
  baleine: { sur: 'Les flots se déchirent', nom: 'La Baleine blanche' },
  raie: { sur: 'Une ombre sous la coque', nom: 'La Raie tachetée' },
};
/** Tentacules : position du pied (en % de l'écran), angle, longueur, retard. */
const TENTACULES = [
  { x: 4, y: 106, r: 26, h: 58, d: 0.1 }, { x: 96, y: 106, r: -26, h: 60, d: 0.22 },
  { x: -4, y: 72, r: 58, h: 46, d: 0.4 }, { x: 104, y: 76, r: -60, h: 46, d: 0.32 },
  { x: 32, y: 112, r: 6, h: 44, d: 0.55 },
];
const VENTOUSES = [[74, 362, 8], [67, 322, 7.5], [62, 284, 7], [59, 248, 6.5], [58, 214, 6], [58, 182, 5.5], [60, 152, 5], [63, 124, 4.4], [67, 98, 3.8], [71, 76, 3.2], [74, 58, 2.6]];

function Tentacule() {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 100 400" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`p${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2b0710" /><stop offset=".35" stopColor="#7a2232" /><stop offset=".6" stopColor="#a8404a" /><stop offset="1" stopColor="#4a0f1a" />
        </linearGradient>
      </defs>
      <path className="tt-peau" fill={`url(#p${id})`} d="M0 400C-4 318 22 268 22 200C22 138 40 90 62 56C74 38 84 26 76 12C90 18 94 38 84 58C68 90 56 140 58 200C60 268 88 318 96 400Z" />
      <path className="tt-reflet" d="M38 396C34 330 34 280 36 214C38 156 48 108 66 72" />
      {VENTOUSES.map(([x, y, r]) => (
        <g key={y}><ellipse className="tt-ventouse" cx={x} cy={y} rx={r} ry={r * 0.8} /><ellipse className="tt-ventouse-creux" cx={x} cy={y} rx={r * 0.42} ry={r * 0.34} /></g>
      ))}
    </svg>
  );
}

export function BeteAnimation({ evt, passer }: { evt: GrandEvenement; passer: () => void }) {
  const bete = beteDe(evt) ?? 'kraken';
  const nom = NOMS_BETES[bete];
  const hasard = useMemo(() => {
    const r = (a: number, b: number) => a + Math.random() * (b - a);
    return {
      bulles: Array.from({ length: 26 }, (_, k) => ({ k, x: r(0, 100), t: r(1.8, 3.6), d: r(0, 1.6), s: r(0.4, 1.4) })),
      gouttes: Array.from({ length: 34 }, (_, k) => {
        const a = r(-150, -30) * Math.PI / 180, v = r(28, 62);
        return { k, tx: Math.cos(a) * v * 1.2, ty: Math.sin(a) * v, d: r(0.55, 0.9), s: r(0.5, 1.6) };
      }),
      sillage: Array.from({ length: 12 }, (_, k) => ({ k, y: r(8, 92), d: r(0, 2.2), t: r(0.5, 1), l: r(20, 55) })),
    };
  }, []);
  const victimes = evt.victimes.slice(0, 8);
  useEffect(() => {
    const t = setTimeout(() => vibrer(320), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className={`bete bete-${bete}`} onClick={passer} role="alert" aria-label={`${nom.nom} — ${evt.texte}`}>
      <div className="bete-fond" />
      <div className="bete-secousse">
        <div className="bete-rayons" />
        <div className="bete-entree">
          <img className="bete-art" src={`/decor/bete-${bete}.webp`} alt="" decoding="async" />
        </div>
        {bete === 'kraken' && (
          <div className="bete-tentacules" aria-hidden="true">
            {TENTACULES.map((t, i) => (
              <div key={i} className="tentacule" style={{ left: `${t.x}%`, top: `${t.y}%`, height: `${t.h}vh`, rotate: `${t.r}deg`, ['--d' as string]: `${t.d}s` }}>
                <div className="tentacule-corps"><Tentacule /></div>
              </div>
            ))}
          </div>
        )}
        {bete === 'baleine' && (
          <div className="bete-ocean" aria-hidden="true">
            <div className="bete-vague v1" /><div className="bete-vague v2" /><div className="bete-vague v3" />
            <div className="bete-gerbe">
              {hasard.gouttes.map((g) => (
                <span key={g.k} style={{ ['--tx' as string]: `${g.tx}vw`, ['--ty' as string]: `${g.ty}vh`, ['--d' as string]: `${g.d}s`, ['--s' as string]: g.s }} />
              ))}
            </div>
          </div>
        )}
        {bete === 'raie' && (
          <div className="bete-sillage" aria-hidden="true">
            {hasard.sillage.map((l) => (
              <span key={l.k} style={{ top: `${l.y}%`, width: `${l.l}vw`, animationDelay: `${l.d}s`, animationDuration: `${l.t}s` }} />
            ))}
          </div>
        )}
        <div className="bete-victimes" aria-hidden="true">
          {victimes.map((v, i) => (
            <img key={v} src={`/cartes/${v}.webp`} alt=""
              style={{ ['--o' as string]: i - (victimes.length - 1) / 2, ['--i' as string]: i, ['--sens' as string]: i % 2 ? 1 : -1 }} />
          ))}
        </div>
        <div className="bete-bulles" aria-hidden="true">
          {hasard.bulles.map((b) => (
            <span key={b.k} style={{ left: `${b.x}%`, animationDuration: `${b.t}s`, animationDelay: `${b.d}s`, ['--s' as string]: b.s }} />
          ))}
        </div>
      </div>
      <div className="bete-eclair" />
      <div className="bete-vignette" />
      <div className="bete-titre">
        <small>{nom.sur}</small>
        <strong>{nom.nom}</strong>
        <span>{evt.texte}</span>
      </div>
      <small className="ga-passer">toucher pour passer</small>
    </div>
  );
}

function PluieOr() {
  const pieces = useMemo(() => Array.from({ length: 42 }, (_, k) => ({
    k, gauche: Math.random() * 100, retard: Math.random() * 2.4, duree: 2.2 + Math.random() * 1.8, taille: 14 + Math.random() * 16, tour: Math.random() * 720 - 360,
  })), []);
  useEffect(() => {
    const ts = [600, 900, 1300, 1700, 2200].map((ms) => setTimeout(son.piece, ms));
    return () => ts.forEach(clearTimeout);
  }, []);
  return (
    <div className="pluie-or" aria-hidden="true">
      {pieces.map((x) => (
        <span key={x.k} style={{ left: `${x.gauche}%`, width: x.taille, height: x.taille, animationDelay: `${x.retard}s`, animationDuration: `${x.duree}s`, ['--tour' as string]: `${x.tour}deg` }} />
      ))}
    </div>
  );
}

function LigneManche({ j, rang, vue, moi, pseudo }: { j: string; rang: number; vue: VueJeu; moi: string; pseudo: (id: string) => string }) {
  const r = vue.historique.at(-1)?.find((x) => x.joueur === j);
  const gain = r?.total ?? 0;
  const avant = vue.scores[j] - gain;
  const retard = 250 + rang * 140;
  const compte = useCompteur(gain, 900, retard);
  const extra = r ? r.bonus + r.alliances + r.rascal : 0;
  return (
    <tr className={`ligne-animee ${j === moi ? 'moi' : ''}`} style={{ animationDelay: `${rang * 140}ms` }}>
      <td>{pseudo(j)}</td>
      <td>{r?.mise}</td>
      <td>{r?.plis} <span className={`tampon ${r?.reussie ? 'ok' : 'non'}`} style={{ animationDelay: `${retard + 350}ms` }}>{r?.reussie ? '✓' : '✗'}</span></td>
      <td>{extra !== 0 ? `${extra > 0 ? '+' : ''}${extra}` : ''}</td>
      <td className={gain >= 0 ? 'positif' : 'negatif'}>{compte > 0 ? '+' : ''}{compte}</td>
      <td><strong>{avant + compte}</strong></td>
    </tr>
  );
}

/** Podium de fin de manche : les trois premiers montent sur leur marche, couronne pour le meneur, notes de harpe. */
function PodiumManche({ vue, classement, photo, cadre, pseudo }: {
  vue: VueJeu; classement: string[]; photo: (id: string) => string | null; cadre: (id: string) => string | null | undefined; pseudo: (id: string) => string;
}) {
  useEffect(() => { son.podium(Math.min(3, classement.length)); }, [vue.manche, classement.length]);
  const top = classement.slice(0, 3);
  const ordre = top.length === 3 ? [1, 0, 2] : top.length === 2 ? [1, 0] : [0];
  return (
    <div className="podium-manche" aria-hidden="true">
      {ordre.map((rang) => {
        const j = top[rang];
        return (
          <div key={`${vue.manche}-${j}`} className={`podium-marche r${rang}`} style={{ animationDelay: `${(2 - rang) * 0.22}s` }}>
            {rang === 0 && <span className="podium-couronne">👑</span>}
            <Avatar photo={photo(j)} taille={rang === 0 ? 58 : 46} cadre={cadre(j)} />
            <span className="podium-nom">{pseudo(j)}</span>
            <span className="podium-bloc"><b>{rang + 1}</b><small>{vue.scores[j]}</small></span>
          </div>
        );
      })}
    </div>
  );
}

function TableauManche({ vue, classement, moi, pseudo }: {
  vue: VueJeu; classement: string[]; moi: string; pseudo: (id: string) => string;
}) {
  return (
    <table className="scores">
      <thead><tr><th>Pirate</th><th>Mise</th><th>Plis</th><th>Bonus</th><th>Manche</th><th>Total</th></tr></thead>
      <tbody>
        {classement.map((j, rang) => <LigneManche key={`${vue.manche}-${j}`} j={j} rang={rang} vue={vue} moi={moi} pseudo={pseudo} />)}
      </tbody>
    </table>
  );
}

/** Tableau des scores en partie : classement, pirate à abattre et record à battre. */
function TableauScores({ vue, moi, pseudo, photo, cadre, record, fermer }: {
  vue: VueJeu; moi: string; pseudo: (id: string) => string; photo: (id: string) => string | null; cadre: (id: string) => string | null;
  record: { pseudo: string; score: number } | null; fermer: () => void;
}) {
  const tries = [...vue.joueurs].sort((a, b) => vue.scores[b] - vue.scores[a]);
  const rang = (j: string) => 1 + tries.filter((k) => vue.scores[k] > vue.scores[j]).length;
  const premier = tries[0];
  const second = tries[1];
  const avance = second !== undefined ? vue.scores[premier] - vue.scores[second] : 0;
  const egalite = second !== undefined && avance === 0;
  const meilleurDeLaTable = Math.max(...vue.joueurs.map((j) => vue.scores[j]));
  const recordBattu = record !== null && meilleurDeLaTable > record.score;
  const mancheJouees = vue.historique.length;
  const medaille = (r: number) => (r === 1 ? 'or' : r === 2 ? 'argent' : r === 3 ? 'bronze' : '');
  return (
    <div className="voile" onClick={fermer}>
      <section className="parchemin fenetre fenetre-large tableau-scores" onClick={(e) => e.stopPropagation()}>
        <header className="ts-entete">
          <h2 className="titre-pirate">Tableau des scores</h2>
          <span>Manche {vue.manche}/10 · {mancheJouees} jouée{mancheJouees > 1 ? 's' : ''}</span>
          <button type="button" className="fiche-fermer" onClick={fermer} aria-label="Fermer">✕</button>
        </header>
        <div className="ts-corps">
          <aside className="ts-cote">
            <div className="ts-abattre">
              <p className="ts-etiquette">☠ Pirate à abattre</p>
              <div className="ts-portrait">
                <span className="ts-couronne" aria-hidden="true">👑</span>
                <Avatar photo={photo(premier)} taille={72} cadre={cadre(premier)} />
              </div>
              <strong className="ts-nom">{premier === moi ? 'Toi !' : pseudo(premier)}</strong>
              <span className="ts-score">{vue.scores[premier]} <small>pts</small></span>
              <small className="ts-avance">
                {egalite ? 'À égalité en tête !' : second !== undefined ? `+${avance} d’avance sur ${second === moi ? 'toi' : pseudo(second)}` : ''}
              </small>
            </div>
            <div className={`ts-record ${recordBattu ? 'battu' : ''}`}>
              <p className="ts-etiquette"><img className="ico-texte" src="/img/nav_classement.webp" alt="" /> Record à battre</p>
              {record ? (
                <>
                  <span className="ts-score">{record.score} <small>pts</small></span>
                  <small>par {record.pseudo}</small>
                  <small className="ts-ecart">
                    {recordBattu ? `🔥 ${pseudo(tries[0])} est en train de le battre !` : `Il manque ${record.score - meilleurDeLaTable} pts au meilleur de la table`}
                  </small>
                </>
              ) : <small>Aucun record pour l’instant : sois le premier !</small>}
            </div>
          </aside>
          <div className="ts-classement">
            {tries.map((j) => {
              const r = rang(j);
              const ecart = vue.scores[j] - vue.scores[premier];
              return (
                <div key={j} className={`ts-ligne ${j === moi ? 'moi' : ''} ${medaille(r)}`}>
                  <span className={`ts-rang ${medaille(r)}`}>{r}</span>
                  <Avatar photo={photo(j)} taille={30} cadre={cadre(j)} />
                  <span className="ts-pirate">
                    <strong>{j === moi ? `${pseudo(j)} (toi)` : pseudo(j)}</strong>
                    <span className="ts-manches">
                      {Array.from({ length: 10 }, (_, k) => {
                        const m = vue.historique[k]?.find((x) => x.joueur === j);
                        return <i key={k} className={m ? (m.reussie ? 'reussie' : 'ratee') : ''} title={m ? `Manche ${k + 1} : ${m.total > 0 ? '+' : ''}${m.total}` : `Manche ${k + 1}`}>{m ? (m.total > 0 ? `+${m.total}` : m.total) : ''}</i>;
                      })}
                    </span>
                  </span>
                  <span className="ts-total">
                    <strong>{vue.scores[j]}</strong>
                    <small>{r === 1 ? 'en tête' : `${ecart}`}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}

/** Effets des personnalisations sur les avatars : entrée en scène et pli remporté. */
function EffetsPerso({ racine, entrees, pli }: {
  racine: RefObject<HTMLDivElement | null>;
  entrees: Array<{ cle: string; joueur: string; effet: string }>;
  pli: { joueur: string; effet: string | null; cle: string } | null;
}) {
  return (
    <div className="projectiles effets-perso" aria-hidden="true">
      {entrees.map((e) => <EffetSurJoueur key={e.cle} racine={racine} joueur={e.joueur} effet={e.effet} nomVisible />)}
      {pli?.effet && <EffetSurJoueur key={pli.cle} racine={racine} joueur={pli.joueur} effet={pli.effet} retard={0.15} />}
    </div>
  );
}

/** Mesure la place de l'avatar une fois affiché, puis lance les éclats dessus. */
function EffetSurJoueur({ racine, joueur, effet, retard = 0, nomVisible = false }: {
  racine: RefObject<HTMLDivElement | null>; joueur: string; effet: string; retard?: number; nomVisible?: boolean;
}) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    // Une image plus tard : la table (et sa référence) est alors en place.
    const t = requestAnimationFrame(() => {
      const r = racine.current;
      if (r) setPos(centreDans(r, r.querySelector(`[data-joueur="${joueur}"]`)));
    });
    return () => cancelAnimationFrame(t);
  }, [racine, joueur]);
  const a = article(effet);
  if (!a?.emojis || !pos) return null;
  return (
    <span>
      <EclatsPerso x={pos.x} y={pos.y} emojis={a.emojis} mode={a.mode} couleur={a.couleur} retard={retard} nombre={nomVisible ? 18 : undefined} />
      {nomVisible && <span className="entree-nom" style={{ left: pos.x, top: pos.y }}>{a.nom}</span>}
    </span>
  );
}
