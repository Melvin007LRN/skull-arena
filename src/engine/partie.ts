// Déroulé complet d'une partie : distribution, mises, plis, pouvoirs, score de manche, fin de partie.
// Le moteur est "pur" : chaque action renvoie un nouvel état, sans rien modifier. Le serveur s'en sert pour
// valider chaque coup, et les robots pour choisir les leurs.
import { creerPaquet, cartesParJoueur, carteParId, type NomPirate } from './cards.ts';
import { creerHasard, melanger } from './hasard.ts';
import {
  cartesJouables, couleurImposeeJoker, COULEURS_JOKER, piratesDuPli, resoudrePli,
  type CarteJouee, type ModeTigresse, type ResultatPli,
} from './pli.ts';
import type { Couleur } from './cards.ts';

export const NB_MANCHES = 10;

export class ErreurRegle extends Error {}

export type Phase =
  | 'mise' // tout le monde mise en secret
  | 'jeu' // les plis se jouent
  | 'pouvoir' // un choix est attendu (Rosie, Bendt, Rascal, Mary, Supplice de la planche)
  | 'harry' // fin de manche : Harry choisit -1, 0 ou +1
  | 'fin_manche' // scores de la manche affichés, en attente de "Continuer"
  | 'fin_partie';

export type PouvoirEnAttente =
  | { type: 'rosie'; joueur: string }
  | { type: 'bendt'; joueur: string; aDefausser: number }
  | { type: 'rascal'; joueur: string }
  /** Mary Thorne : choisir l'adversaire à qui prendre une carte au hasard. */
  | { type: 'mary'; joueur: string; cibles: string[] }
  /** Supplice de la planche : choisir le Pirate à jeter à la mer (index dans le pli en cours). */
  | { type: 'planche'; joueur: string; pirates: number[] };

export interface PliTermine {
  cartes: CarteJouee[];
  resultat: ResultatPli;
}

export interface ScoreManche {
  joueur: string;
  mise: number; // mise finale (après Harry)
  plis: number;
  reussie: boolean;
  pointsMise: number;
  bonus: number;
  alliances: number;
  rascal: number;
  total: number;
}

export interface EtatPartie {
  joueurs: string[]; // dans le sens des aiguilles d'une montre
  graine: number;
  tirage: number; // compteur pour dériver les mélanges de chaque manche
  manche: number;
  cartesParJoueur: number;
  /** Index du joueur qui porte la couronne cette manche. */
  couronne: number;
  phase: Phase;
  mains: Record<string, string[]>;
  nonDistribuees: string[];
  defausse: string[];
  mises: Record<string, number | null>;
  plisGagnes: Record<string, number>;
  bonusManche: Record<string, number>;
  detailBonusManche: Record<string, string[]>;
  alliances: Array<[string, string]>;
  rascal: Record<string, number>; // pari de Rascal (0, 10 ou 20)
  harry: Record<string, number>; // ajustement de mise décidé par Harry
  harryEnAttente: string[];
  meneur: string; // joueur qui entame le pli en cours
  pliEnCours: CarteJouee[];
  numeroPli: number; // 1 à cartesParJoueur
  dernierPli: PliTermine | null;
  pouvoir: PouvoirEnAttente | null;
  /** Juanita : cartes non distribuées révélées à ce joueur seulement. */
  revelationJuanita: { joueur: string; cartes: string[] } | null;
  scores: Record<string, number>;
  historique: ScoreManche[][];
  /** Partie jouée avec les 19 cartes de l'extension. */
  extension?: boolean;
  /** Variante : les points bonus (captures, 14, 7/8…) comptent même si la mise est ratée. */
  bonusToujours?: boolean;
  /** Mary Thorne : carte que ce joueur doit obligatoirement poser au pli suivant. */
  imposee?: { joueur: string; carteId: string; par: string } | null;
  /** Pouvoirs encore à appliquer pour ce joueur (le Second peut en cumuler plusieurs). */
  filePouvoirs?: { joueur: string; pouvoirs: NomPirate[]; dernier: boolean } | null;
}

function joueurApres(etat: EtatPartie, joueur: string, decalage = 1): string {
  const n = etat.joueurs.length;
  const i = etat.joueurs.indexOf(joueur);
  return etat.joueurs[(((i + decalage) % n) + n) % n];
}

function clone(etat: EtatPartie): EtatPartie {
  return structuredClone(etat);
}

function parJoueur<T>(joueurs: string[], valeur: () => T): Record<string, T> {
  return Object.fromEntries(joueurs.map((j) => [j, valeur()]));
}

export function creerPartie(joueurs: string[], graine: number, options: { extension?: boolean; bonusToujours?: boolean } = {}): EtatPartie {
  const max = options.extension ? 9 : 8; // avec les 93 cartes de l'extension, on peut jouer à 9
  if (joueurs.length < 2 || joueurs.length > max) throw new ErreurRegle(`Une partie se joue de 2 à ${max} joueurs.`);
  if (new Set(joueurs).size !== joueurs.length) throw new ErreurRegle('Chaque joueur doit être unique.');
  const hasard = creerHasard(graine);
  const couronne = Math.floor(hasard() * joueurs.length); // meneur tiré au sort
  const etat: EtatPartie = {
    joueurs: [...joueurs], graine, tirage: 1, manche: 0, cartesParJoueur: 0, couronne, phase: 'mise',
    mains: {}, nonDistribuees: [], defausse: [], mises: {}, plisGagnes: {}, bonusManche: {},
    detailBonusManche: {}, alliances: [], rascal: {}, harry: {}, harryEnAttente: [], meneur: joueurs[0],
    pliEnCours: [], numeroPli: 1, dernierPli: null, pouvoir: null, revelationJuanita: null,
    scores: parJoueur(joueurs, () => 0), historique: [],
    extension: Boolean(options.extension), bonusToujours: Boolean(options.bonusToujours), imposee: null, filePouvoirs: null,
  };
  return demarrerManche(etat, 1);
}

function demarrerManche(etat: EtatPartie, manche: number): EtatPartie {
  const e = etat;
  const n = e.joueurs.length;
  e.manche = manche;
  e.cartesParJoueur = cartesParJoueur(manche, n, Boolean(e.extension));
  if (manche > 1) e.couronne = (e.couronne + 1) % n; // la couronne tourne dans le sens des aiguilles d'une montre
  const hasard = creerHasard((e.graine ^ (e.tirage * 0x9e3779b1)) >>> 0);
  e.tirage += 1;
  const paquet = melanger(creerPaquet(Boolean(e.extension)).map((c) => c.id), hasard);
  e.mains = {};
  e.joueurs.forEach((j, i) => {
    e.mains[j] = paquet.slice(i * e.cartesParJoueur, (i + 1) * e.cartesParJoueur);
  });
  e.nonDistribuees = paquet.slice(n * e.cartesParJoueur);
  e.defausse = [];
  e.mises = parJoueur(e.joueurs, () => null);
  e.plisGagnes = parJoueur(e.joueurs, () => 0);
  e.bonusManche = parJoueur(e.joueurs, () => 0);
  e.detailBonusManche = parJoueur(e.joueurs, () => [] as string[]);
  e.alliances = [];
  e.rascal = parJoueur(e.joueurs, () => 0);
  e.harry = parJoueur(e.joueurs, () => 0);
  e.harryEnAttente = [];
  e.meneur = e.joueurs[(e.couronne + 1) % n]; // le joueur qui suit la couronne entame
  e.pliEnCours = [];
  e.numeroPli = 1;
  e.dernierPli = null;
  e.pouvoir = null;
  e.revelationJuanita = null;
  e.imposee = null;
  e.filePouvoirs = null;
  e.phase = 'mise';
  return e;
}

/**
 * Joueurs qui participent au pli en cours, dans l'ordre, à partir du meneur.
 * Un joueur sans carte (après une Dernière salve) passe son tour.
 */
export function ordreDuPli(etat: EtatPartie): string[] {
  const n = etat.joueurs.length;
  const ordre: string[] = [];
  for (let k = 0; k < n; k++) {
    const j = joueurApres(etat, etat.meneur, k);
    if (etat.mains[j].length > 0 || etat.pliEnCours.some((c) => c.joueur === j)) ordre.push(j);
  }
  return ordre;
}

/** Dernière salve : joueur qui doit encore poser sa carte supplémentaire, s'il y en a un. */
export function salveEnAttente(etat: EtatPartie): string | null {
  const salve = etat.pliEnCours.find((c) => carteParId(c.carteId).type === 'salve');
  if (!salve) return null;
  const nbCartes = etat.pliEnCours.filter((c) => c.joueur === salve.joueur).length;
  if (nbCartes >= 2 || etat.mains[salve.joueur].length === 0) return null;
  return salve.joueur;
}

/** Joueur qui doit poser une carte maintenant (phase "jeu"). */
export function joueurActif(etat: EtatPartie): string | null {
  if (etat.phase !== 'jeu') return null;
  const ordre = ordreDuPli(etat);
  const premiers = new Set(etat.pliEnCours.map((c) => c.joueur)).size;
  if (premiers < ordre.length) return ordre[premiers];
  return salveEnAttente(etat);
}

/** Cartes que ce joueur peut poser maintenant (vide si ce n'est pas son tour). */
export function cartesAutorisees(etat: EtatPartie, joueur: string): string[] {
  if (joueurActif(etat) !== joueur) return [];
  // Mary Thorne : la carte prise doit être posée, quelles que soient les cartes déjà jouées.
  if (etat.imposee?.joueur === joueur && etat.mains[joueur].includes(etat.imposee.carteId)) return [etat.imposee.carteId];
  return cartesJouables(etat.mains[joueur], etat.pliEnCours);
}

export type Action =
  | { type: 'miser'; joueur: string; mise: number }
  | { type: 'jouer'; joueur: string; carteId: string; tigresse?: ModeTigresse; valeur?: 0 | 14; couleur?: Couleur }
  | { type: 'rosie'; joueur: string; choix: string }
  | { type: 'bendt'; joueur: string; defausse: string[] }
  | { type: 'rascal'; joueur: string; pari: 0 | 10 | 20 }
  | { type: 'mary'; joueur: string; cible: string }
  | { type: 'planche'; joueur: string; index: number }
  | { type: 'harry'; joueur: string; ajustement: -1 | 0 | 1 }
  | { type: 'continuer' };

export function appliquer(etat: EtatPartie, action: Action): EtatPartie {
  const e = clone(etat);
  switch (action.type) {
    case 'miser':
      return miser(e, action.joueur, action.mise);
    case 'jouer':
      return jouer(e, action.joueur, action.carteId, action.tigresse, action.valeur, action.couleur);
    case 'rosie':
      return pouvoirRosie(e, action.joueur, action.choix);
    case 'bendt':
      return pouvoirBendt(e, action.joueur, action.defausse);
    case 'rascal':
      return pouvoirRascal(e, action.joueur, action.pari);
    case 'mary':
      return pouvoirMary(e, action.joueur, action.cible);
    case 'planche':
      return choixPlanche(e, action.joueur, action.index);
    case 'harry':
      return pouvoirHarry(e, action.joueur, action.ajustement);
    case 'continuer':
      if (e.phase !== 'fin_manche') throw new ErreurRegle("La manche n'est pas terminée.");
      if (e.manche >= NB_MANCHES) {
        e.phase = 'fin_partie';
        return e;
      }
      return demarrerManche(e, e.manche + 1);
  }
}

function verifierJoueur(e: EtatPartie, joueur: string) {
  if (!e.joueurs.includes(joueur)) throw new ErreurRegle('Joueur inconnu.');
}

function miser(e: EtatPartie, joueur: string, mise: number): EtatPartie {
  verifierJoueur(e, joueur);
  if (e.phase !== 'mise') throw new ErreurRegle("Ce n'est pas le moment de miser.");
  if (e.mises[joueur] !== null) throw new ErreurRegle('Ta mise est déjà verrouillée.');
  if (!Number.isInteger(mise) || mise < 0 || mise > e.cartesParJoueur) {
    throw new ErreurRegle(`La mise doit être entre 0 et ${e.cartesParJoueur}.`);
  }
  e.mises[joueur] = mise;
  if (e.joueurs.every((j) => e.mises[j] !== null)) e.phase = 'jeu'; // révélation simultanée
  return e;
}

function jouer(
  e: EtatPartie, joueur: string, carteId: string, tigresse?: ModeTigresse, valeur?: number, couleur?: Couleur,
): EtatPartie {
  verifierJoueur(e, joueur);
  if (e.phase !== 'jeu') throw new ErreurRegle("Ce n'est pas le moment de jouer une carte.");
  if (joueurActif(e) !== joueur) throw new ErreurRegle("Ce n'est pas ton tour.");
  if (!e.mains[joueur].includes(carteId)) throw new ErreurRegle("Tu n'as pas cette carte.");
  if (!cartesAutorisees(e, joueur).includes(carteId)) {
    throw new ErreurRegle(e.imposee?.joueur === joueur
      ? 'Mary Thorne t’oblige à poser la carte qu’elle t’a prise.'
      : 'Tu dois suivre la couleur demandée (ou jouer une carte spéciale).');
  }
  const type = carteParId(carteId).type;
  const posee: CarteJouee = { joueur, carteId };
  if (type === 'tigresse') {
    if (tigresse !== 'pirate' && tigresse !== 'fuite') throw new ErreurRegle('Choisis si la Tigresse est jouée en Pirate ou en Fuite.');
    posee.tigresse = tigresse;
  }
  if (type === 'double') {
    if (valeur !== 0 && valeur !== 14) throw new ErreurRegle('Choisis si cette carte vaut 0 ou 14.');
    posee.valeur = valeur;
  }
  if (type === 'joker') {
    const imposee = couleurImposeeJoker(e.pliEnCours);
    if (imposee === undefined) {
      if (!couleur || !COULEURS_JOKER.includes(couleur)) throw new ErreurRegle('Choisis la couleur du 15 : jaune, violet ou vert.');
      posee.couleur = couleur;
    } else if (imposee) posee.couleur = imposee;
  }
  e.mains[joueur] = e.mains[joueur].filter((id) => id !== carteId);
  if (e.imposee?.joueur === joueur) e.imposee = null;
  e.pliEnCours.push(posee);
  e.revelationJuanita = null;
  if (joueurActif(e) !== null) return e; // d'autres joueurs (ou la Dernière salve) doivent encore poser
  return finDePose(e);
}

/** Tout le monde a posé : Supplice de la planche à décider, ou pli résolu. */
function finDePose(e: EtatPartie): EtatPartie {
  const planche = e.pliEnCours.find((c) => carteParId(c.carteId).type === 'planche');
  if (planche) {
    const pirates = piratesDuPli(e.pliEnCours);
    if (pirates.length === 1) return terminerPli(e, pirates[0]);
    if (pirates.length > 1) {
      e.pouvoir = { type: 'planche', joueur: planche.joueur, pirates };
      e.phase = 'pouvoir';
      return e;
    }
  }
  return terminerPli(e, null);
}

function choixPlanche(e: EtatPartie, joueur: string, index: number): EtatPartie {
  verifierPouvoir(e, 'planche', joueur);
  const p = e.pouvoir as Extract<PouvoirEnAttente, { type: 'planche' }>;
  if (!p.pirates.includes(index)) throw new ErreurRegle('Choisis un des Pirates du pli.');
  e.pouvoir = null;
  e.phase = 'jeu';
  return terminerPli(e, index);
}

function terminerPli(e: EtatPartie, retire: number | null): EtatPartie {
  const cartes = e.pliEnCours;
  const resultat = resoudrePli(cartes, retire);
  e.dernierPli = { cartes, resultat };
  e.defausse.push(...cartes.map((c) => c.carteId));
  e.pliEnCours = [];
  const dernierDeLaManche = e.numeroPli === e.cartesParJoueur;
  e.meneur = resultat.prochainMeneur;

  if (resultat.gagnant) {
    const g = resultat.gagnant;
    e.plisGagnes[g] += 1;
    e.bonusManche[g] += resultat.bonus;
    e.detailBonusManche[g].push(...resultat.detailBonus);
    e.alliances.push(...resultat.alliances);
  }

  e.numeroPli += 1;
  e.phase = 'jeu';
  e.filePouvoirs = resultat.gagnant && resultat.pouvoirs.length
    ? { joueur: resultat.gagnant, pouvoirs: [...resultat.pouvoirs], dernier: dernierDeLaManche }
    : null;
  return continuerPouvoirs(e);
}

/** Applique les pouvoirs en attente, un par un ; s'arrête dès qu'un choix est demandé. */
function continuerPouvoirs(e: EtatPartie): EtatPartie {
  const f = e.filePouvoirs;
  while (f && f.pouvoirs.length > 0 && e.phase === 'jeu') {
    activerPouvoir(e, f.joueur, f.pouvoirs.shift()!, f.dernier);
  }
  if (e.phase !== 'jeu') return e;
  const dernier = f?.dernier ?? e.numeroPli > e.cartesParJoueur;
  e.filePouvoirs = null;
  if (dernier) finirManche(e);
  return e;
}

function apresChoix(e: EtatPartie): EtatPartie {
  e.pouvoir = null;
  e.phase = 'jeu';
  return continuerPouvoirs(e);
}

function activerPouvoir(e: EtatPartie, gagnant: string, pouvoir: NomPirate, dernier: boolean) {
  // Harry agit en fin de manche, même sur le dernier pli. Les autres pouvoirs ne servent à rien sur le dernier pli.
  if (pouvoir === 'harry') {
    e.harryEnAttente.push(gagnant);
    return;
  }
  if (dernier) return;
  switch (pouvoir) {
    case 'rosie':
      e.pouvoir = { type: 'rosie', joueur: gagnant };
      e.phase = 'pouvoir';
      break;
    case 'rascal':
      e.pouvoir = { type: 'rascal', joueur: gagnant };
      e.phase = 'pouvoir';
      break;
    case 'bendt': {
      const pioche = e.nonDistribuees.slice(0, 2);
      if (pioche.length === 0) return; // plus aucune carte non distribuée : sans effet
      e.nonDistribuees = e.nonDistribuees.slice(pioche.length);
      e.mains[gagnant].push(...pioche);
      e.pouvoir = { type: 'bendt', joueur: gagnant, aDefausser: pioche.length };
      e.phase = 'pouvoir';
      break;
    }
    case 'juanita':
      if (e.nonDistribuees.length > 0) e.revelationJuanita = { joueur: gagnant, cartes: [...e.nonDistribuees] };
      break;
    case 'mary': {
      const cibles = e.joueurs.filter((j) => j !== gagnant && e.mains[j].length > 0);
      if (cibles.length === 0) return;
      e.pouvoir = { type: 'mary', joueur: gagnant, cibles };
      e.phase = 'pouvoir';
      break;
    }
  }
}

function verifierPouvoir(e: EtatPartie, type: PouvoirEnAttente['type'], joueur: string) {
  if (e.phase !== 'pouvoir' || !e.pouvoir || e.pouvoir.type !== type) {
    throw new ErreurRegle("Ce pouvoir n'est pas actif.");
  }
  if (e.pouvoir.joueur !== joueur) throw new ErreurRegle("Ce n'est pas à toi de choisir.");
}

function pouvoirRosie(e: EtatPartie, joueur: string, choix: string): EtatPartie {
  verifierPouvoir(e, 'rosie', joueur);
  verifierJoueur(e, choix);
  e.meneur = choix; // Rosie peut se choisir elle-même
  return apresChoix(e);
}

function pouvoirBendt(e: EtatPartie, joueur: string, defausse: string[]): EtatPartie {
  verifierPouvoir(e, 'bendt', joueur);
  const attendu = (e.pouvoir as Extract<PouvoirEnAttente, { type: 'bendt' }>).aDefausser;
  if (defausse.length !== attendu || new Set(defausse).size !== attendu) {
    throw new ErreurRegle(`Choisis ${attendu} carte(s) différente(s) à défausser.`);
  }
  for (const id of defausse) {
    if (!e.mains[joueur].includes(id)) throw new ErreurRegle("Tu n'as pas cette carte.");
  }
  e.mains[joueur] = e.mains[joueur].filter((id) => !defausse.includes(id));
  e.defausse.push(...defausse);
  return apresChoix(e);
}

function pouvoirRascal(e: EtatPartie, joueur: string, pari: number): EtatPartie {
  verifierPouvoir(e, 'rascal', joueur);
  if (pari !== 0 && pari !== 10 && pari !== 20) throw new ErreurRegle('Le pari de Rascal est de 0, 10 ou 20 points.');
  e.rascal[joueur] = pari;
  return apresChoix(e);
}

function pouvoirMary(e: EtatPartie, joueur: string, cible: string): EtatPartie {
  verifierPouvoir(e, 'mary', joueur);
  const p = e.pouvoir as Extract<PouvoirEnAttente, { type: 'mary' }>;
  if (!p.cibles.includes(cible)) throw new ErreurRegle('Choisis un adversaire qui a encore des cartes.');
  // Carte tirée au hasard, mais de façon reproductible (même graine = même partie).
  const hasard = creerHasard((e.graine ^ (e.tirage * 0x85ebca6b) ^ (e.numeroPli * 0xc2b2ae35)) >>> 0);
  e.tirage += 1;
  const main = e.mains[cible];
  e.imposee = { joueur: cible, carteId: main[Math.floor(hasard() * main.length)], par: joueur };
  return apresChoix(e);
}

function pouvoirHarry(e: EtatPartie, joueur: string, ajustement: number): EtatPartie {
  if (e.phase !== 'harry' || !e.harryEnAttente.includes(joueur)) throw new ErreurRegle("Ce n'est pas à toi de choisir.");
  if (ajustement !== -1 && ajustement !== 0 && ajustement !== 1) throw new ErreurRegle('Harry change sa mise de -1, 0 ou +1.');
  const mise = (e.mises[joueur] ?? 0) + e.harry[joueur] + ajustement;
  if (mise < 0) throw new ErreurRegle('La mise ne peut pas être négative.');
  e.harry[joueur] += ajustement;
  e.harryEnAttente = e.harryEnAttente.filter((j) => j !== joueur);
  if (e.harryEnAttente.length === 0) calculerScores(e);
  return e;
}

function finirManche(e: EtatPartie) {
  if (e.harryEnAttente.length > 0) {
    e.phase = 'harry';
    return;
  }
  calculerScores(e);
}

export function calculerScoreJoueur(args: {
  manche: number; mise: number; plis: number; bonus: number; alliances: number; rascal: number;
  /** Variante : les bonus comptent même si la mise est ratée. */
  bonusToujours?: boolean;
}): Omit<ScoreManche, 'joueur'> {
  const { manche, mise, plis, bonus, alliances, rascal, bonusToujours } = args;
  const reussie = mise === plis;
  let pointsMise: number;
  if (mise === 0) pointsMise = reussie ? 10 * manche : -10 * manche;
  else pointsMise = reussie ? 20 * mise : -10 * Math.abs(mise - plis);
  const b = reussie || bonusToujours ? bonus : 0;
  const a = reussie ? alliances : 0;
  const r = reussie ? rascal : -rascal;
  return { mise, plis, reussie, pointsMise, bonus: b, alliances: a, rascal: r, total: pointsMise + b + a + r };
}

function calculerScores(e: EtatPartie) {
  const miseFinale = (j: string) => (e.mises[j] ?? 0) + e.harry[j];
  const reussie = (j: string) => miseFinale(j) === e.plisGagnes[j];
  const alliances = parJoueur(e.joueurs, () => 0);
  for (const [butin, gagnant] of e.alliances) {
    if (reussie(butin) && reussie(gagnant)) {
      alliances[butin] += 20;
      alliances[gagnant] += 20;
    }
  }
  const resultats: ScoreManche[] = e.joueurs.map((j) => ({
    joueur: j,
    ...calculerScoreJoueur({
      manche: e.manche, mise: miseFinale(j), plis: e.plisGagnes[j], bonus: e.bonusManche[j],
      alliances: alliances[j], rascal: e.rascal[j], bonusToujours: e.bonusToujours,
    }),
  }));
  for (const r of resultats) e.scores[r.joueur] += r.total;
  e.historique.push(resultats);
  e.phase = 'fin_manche';
}

/** Classement final : les joueurs à égalité partagent la même place. */
export function classement(etat: EtatPartie): Array<{ joueur: string; score: number; place: number }> {
  const tries = [...etat.joueurs].sort((a, b) => etat.scores[b] - etat.scores[a]);
  return tries.map((joueur) => ({
    joueur,
    score: etat.scores[joueur],
    place: 1 + tries.filter((j) => etat.scores[j] > etat.scores[joueur]).length,
  }));
}
