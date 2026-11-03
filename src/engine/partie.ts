// Déroulé complet d'une partie : distribution, mises, plis, pouvoirs, score de manche, fin de partie.
// Le moteur est "pur" : chaque action renvoie un nouvel état, sans rien modifier. Le serveur s'en sert pour
// valider chaque coup, et les robots pour choisir les leurs.
import { creerPaquet, cartesParJoueur, carteParId, type NomPirate } from './cards.ts';
import { creerHasard, melanger } from './hasard.ts';
import { cartesJouables, resoudrePli, type CarteJouee, type ModeTigresse, type ResultatPli } from './pli.ts';

export const NB_MANCHES = 10;

export class ErreurRegle extends Error {}

export type Phase =
  | 'mise' // tout le monde mise en secret
  | 'jeu' // les plis se jouent
  | 'pouvoir' // un pirate gagnant doit faire un choix (Rosie, Bendt, Rascal)
  | 'harry' // fin de manche : Harry choisit -1, 0 ou +1
  | 'fin_manche' // scores de la manche affichés, en attente de "Continuer"
  | 'fin_partie';

export type PouvoirEnAttente =
  | { type: 'rosie'; joueur: string }
  | { type: 'bendt'; joueur: string; aDefausser: number }
  | { type: 'rascal'; joueur: string };

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

export function creerPartie(joueurs: string[], graine: number): EtatPartie {
  if (joueurs.length < 2 || joueurs.length > 8) throw new ErreurRegle('Une partie se joue de 2 à 8 joueurs.');
  if (new Set(joueurs).size !== joueurs.length) throw new ErreurRegle('Chaque joueur doit être unique.');
  const hasard = creerHasard(graine);
  const couronne = Math.floor(hasard() * joueurs.length); // meneur tiré au sort
  const etat: EtatPartie = {
    joueurs: [...joueurs], graine, tirage: 1, manche: 0, cartesParJoueur: 0, couronne, phase: 'mise',
    mains: {}, nonDistribuees: [], defausse: [], mises: {}, plisGagnes: {}, bonusManche: {},
    detailBonusManche: {}, alliances: [], rascal: {}, harry: {}, harryEnAttente: [], meneur: joueurs[0],
    pliEnCours: [], numeroPli: 1, dernierPli: null, pouvoir: null, revelationJuanita: null,
    scores: parJoueur(joueurs, () => 0), historique: [],
  };
  return demarrerManche(etat, 1);
}

function demarrerManche(etat: EtatPartie, manche: number): EtatPartie {
  const e = etat;
  const n = e.joueurs.length;
  e.manche = manche;
  e.cartesParJoueur = cartesParJoueur(manche, n);
  if (manche > 1) e.couronne = (e.couronne + 1) % n; // la couronne tourne dans le sens des aiguilles d'une montre
  const hasard = creerHasard((e.graine ^ (e.tirage * 0x9e3779b1)) >>> 0);
  e.tirage += 1;
  const paquet = melanger(creerPaquet().map((c) => c.id), hasard);
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
  e.phase = 'mise';
  return e;
}

/** Joueur qui doit poser une carte maintenant (phase "jeu"). */
export function joueurActif(etat: EtatPartie): string | null {
  if (etat.phase !== 'jeu') return null;
  return joueurApres(etat, etat.meneur, etat.pliEnCours.length);
}

/** Cartes que ce joueur peut poser maintenant (vide si ce n'est pas son tour). */
export function cartesAutorisees(etat: EtatPartie, joueur: string): string[] {
  if (joueurActif(etat) !== joueur) return [];
  return cartesJouables(etat.mains[joueur], etat.pliEnCours);
}

export type Action =
  | { type: 'miser'; joueur: string; mise: number }
  | { type: 'jouer'; joueur: string; carteId: string; tigresse?: ModeTigresse }
  | { type: 'rosie'; joueur: string; choix: string }
  | { type: 'bendt'; joueur: string; defausse: string[] }
  | { type: 'rascal'; joueur: string; pari: 0 | 10 | 20 }
  | { type: 'harry'; joueur: string; ajustement: -1 | 0 | 1 }
  | { type: 'continuer' };

export function appliquer(etat: EtatPartie, action: Action): EtatPartie {
  const e = clone(etat);
  switch (action.type) {
    case 'miser':
      return miser(e, action.joueur, action.mise);
    case 'jouer':
      return jouer(e, action.joueur, action.carteId, action.tigresse);
    case 'rosie':
      return pouvoirRosie(e, action.joueur, action.choix);
    case 'bendt':
      return pouvoirBendt(e, action.joueur, action.defausse);
    case 'rascal':
      return pouvoirRascal(e, action.joueur, action.pari);
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

function jouer(e: EtatPartie, joueur: string, carteId: string, tigresse?: ModeTigresse): EtatPartie {
  verifierJoueur(e, joueur);
  if (e.phase !== 'jeu') throw new ErreurRegle("Ce n'est pas le moment de jouer une carte.");
  if (joueurActif(e) !== joueur) throw new ErreurRegle("Ce n'est pas ton tour.");
  if (!e.mains[joueur].includes(carteId)) throw new ErreurRegle("Tu n'as pas cette carte.");
  if (!cartesJouables(e.mains[joueur], e.pliEnCours).includes(carteId)) {
    throw new ErreurRegle('Tu dois suivre la couleur demandée (ou jouer une carte spéciale).');
  }
  const estTigresse = carteParId(carteId).type === 'tigresse';
  if (estTigresse && tigresse !== 'pirate' && tigresse !== 'fuite') {
    throw new ErreurRegle('Choisis si la Tigresse est jouée en Pirate ou en Fuite.');
  }
  e.mains[joueur] = e.mains[joueur].filter((id) => id !== carteId);
  e.pliEnCours.push(estTigresse ? { joueur, carteId, tigresse } : { joueur, carteId });
  e.revelationJuanita = null;
  if (e.pliEnCours.length < e.joueurs.length) return e;
  return terminerPli(e);
}

function terminerPli(e: EtatPartie): EtatPartie {
  const cartes = e.pliEnCours;
  const resultat = resoudrePli(cartes);
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
  activerPouvoir(e, resultat.gagnant, resultat.pouvoir, dernierDeLaManche);
  if (dernierDeLaManche && e.phase === 'jeu') finirManche(e);
  return e;
}

function activerPouvoir(e: EtatPartie, gagnant: string | null, pouvoir: NomPirate | null, dernier: boolean) {
  if (!gagnant || !pouvoir) return;
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
  e.pouvoir = null;
  e.phase = 'jeu';
  return e;
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
  e.pouvoir = null;
  e.phase = 'jeu';
  return e;
}

function pouvoirRascal(e: EtatPartie, joueur: string, pari: number): EtatPartie {
  verifierPouvoir(e, 'rascal', joueur);
  if (pari !== 0 && pari !== 10 && pari !== 20) throw new ErreurRegle('Le pari de Rascal est de 0, 10 ou 20 points.');
  e.rascal[joueur] = pari;
  e.pouvoir = null;
  e.phase = 'jeu';
  return e;
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
}): Omit<ScoreManche, 'joueur'> {
  const { manche, mise, plis, bonus, alliances, rascal } = args;
  const reussie = mise === plis;
  let pointsMise: number;
  if (mise === 0) pointsMise = reussie ? 10 * manche : -10 * manche;
  else pointsMise = reussie ? 20 * mise : -10 * Math.abs(mise - plis);
  const b = reussie ? bonus : 0;
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
      alliances: alliances[j], rascal: e.rascal[j],
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
