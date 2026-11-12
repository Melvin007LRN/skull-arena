// La Roue du Kraken : les règles, sans réseau ni base de données (façon « Crazy Time »).
// Une roue de 54 cases : doublons 1, 2, 5, 10 et quatre mini-jeux (Pièce maudite, Abysses,
// Chasse au trésor, Tempête du Kraken). Avant chaque tour, la Boussole peut désigner une case
// et la multiplier. Les gains rendent la mise en plus (une mise de 10 sur « 5 » qui sort = 60).
// Les probabilités sont réglées pour rendre environ 95 % des mises sur chaque case (voir les tests).

export const ZONES = ['1', '2', '5', '10', 'piece', 'abysses', 'chasse', 'tempete'] as const;
export type Zone = (typeof ZONES)[number];
export type Bonus = 'piece' | 'abysses' | 'chasse' | 'tempete';
export const estBonus = (z: Zone): z is Bonus => z === 'piece' || z === 'abysses' || z === 'chasse' || z === 'tempete';
export const NOMS_ZONES: Record<Zone, string> = {
  '1': '1', '2': '2', '5': '5', '10': '10', piece: 'Pièce maudite', abysses: 'Abysses', chasse: 'Chasse au trésor', tempete: 'Tempête du Kraken',
};

/** Les 54 cases dans l'ordre de la roue (1 : 21, 2 : 13, 5 : 7, 10 : 4, Pièce : 4, Abysses : 2, Chasse : 2, Tempête : 1). */
export const CASES: readonly Zone[] = [
  '1', '2', '1', '5', '1', 'piece', '2', '1', '10', '1', '2', '1', 'abysses', '1', '5', '2', '1', 'chasse',
  '1', '2', '1', '5', '1', 'piece', '2', '1', '10', '1', '2', '5', '1', 'tempete', '1', '2', '1', '5', '1',
  'piece', '2', '1', '10', '1', '2', '1', 'abysses', '2', '5', '2', 'chasse', '1', 'piece', '2', '10', '5',
];

/** Durées (ms). */
export const DELAI_MISES = 15000;
export const DELAI_BOUSSOLE = 3500;
export const DELAI_TOUR = 7500;
export const DELAI_PIECE = 6000;
export const DELAI_ABYSSES_CHUTE = 3200;
export const DELAI_CHOIX = 10000;
export const DELAI_REVELE = 5500;
export const DELAI_TEMPETE_TOUR = 7000;
export const DELAI_RESULTATS = 6000;
/** Un joueur reste « présent » tant qu'il a donné signe de vie depuis moins de ce délai. */
export const PRESENCE = 60000;
export const MISE_MIN_ROUE = 10;
export const MULT_MAX = 2500;

/** Mise maximale par case selon le niveau (comme au Blackjack). */
export function miseMaxRoue(niveau: number): number {
  const n = Math.max(1, Math.floor(niveau));
  if (n >= 100) return 10000;
  if (n >= 50) return 5000;
  return 50 + 25 * n;
}

// ---------------------------------------------------------------- tirages
export type Hasard = () => number;
function pondere<T>(h: Hasard, items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((s, [, p]) => s + p, 0);
  let r = h() * total;
  for (const [v, p] of items) { r -= p; if (r < 0) return v; }
  return items[items.length - 1][0];
}
function melanger<T>(h: Hasard, t: T[]): T[] {
  for (let i = t.length - 1; i > 0; i--) { const k = Math.floor(h() * (i + 1)); [t[i], t[k]] = [t[k], t[i]]; }
  return t;
}

/** Boussole : la case désignée (ou aucune) et son multiplicateur. */
export const BOUSSOLE_ZONES: ReadonlyArray<readonly [Zone | null, number]> = [
  ['1', 86], ['2', 92], ['5', 52], ['10', 35], ['piece', 60], ['abysses', 60], ['chasse', 60], ['tempete', 60], [null, 495],
];
export const BOUSSOLE_MULTS: ReadonlyArray<readonly [number, number]> = [[2, 35], [3, 25], [5, 20], [10, 12], [25, 6], [50, 2]];

/** Pièce maudite : multiplicateurs possibles de chaque face. */
export const PIECE_MULTS: ReadonlyArray<readonly [number, number]> = [
  [2, 13], [3, 13], [4, 12], [5, 12], [6, 10], [8, 9], [10, 8], [12, 7], [15, 5], [20, 4], [25, 3], [50, 2], [100, 1],
];
/** Abysses : 16 cases au fond (0 = « double » : tous les multiplicateurs doublent et le boulet retombe). */
export const ABYSSES_BASE = [200, 100, 50, 25, 0, 20, 15, 15, 16, 16, 20, 0, 25, 50, 100, 200] as const;
/** Chasse au trésor : 24 croix, chacune cache un multiplicateur. */
export const CHASSE_MULTS = [5, 5, 7, 7, 7, 10, 10, 10, 10, 10, 12, 12, 15, 15, 15, 17, 20, 20, 25, 25, 30, 40, 50, 75] as const;
/** Tempête du Kraken : la roue géante (32 cases). Les trois drapeaux sont à 0, 1/3 et 2/3 du tour. */
export const TEMPETE_MULTS = [10, 10, 10, 10, 10, 10, 25, 15, 15, 15, 15, 15, 20, 20, 20, 20, 25, 25, 25, 25, 30, 30, 40, 40, 50, 50, 50, 75, 75, 100, 150, 200] as const;
export const DRAPEAUX = ['rouge', 'bleu', 'or'] as const;
export type Drapeau = (typeof DRAPEAUX)[number];
const DECALAGE_DRAPEAU: Record<Drapeau, number> = { rouge: 0, bleu: 11, or: 21 };

// ---------------------------------------------------------------- état
export interface MisesJoueur { pseudo: string; photo: string | null; zones: Partial<Record<Zone, number>> }
export type EtatBonus =
  | { type: 'piece'; faces: { crane: number; couronne: number }; resultat: 'crane' | 'couronne' }
  | { type: 'abysses'; base: number[]; chutes: Array<{ arrivee: number; chemin: number[] }>; doubles: number; mult: number }
  | { type: 'chasse'; etape: 'choix' | 'revele'; choix: Record<string, number>; grille: number[] | null }
  | { type: 'tempete'; etape: 'choix' | 'tour'; roue: number[]; choix: Record<string, Drapeau>; arret: number | null };
export type PhaseRoue = 'attente' | 'mises' | 'boussole' | 'tour' | 'bonus' | 'resultats';

export interface EtatRoue {
  phase: PhaseRoue;
  manche: number;
  echeance: number | null;
  debut: number;
  mises: Record<string, MisesJoueur>;
  boussole: { zone: Zone | null; mult: number } | null;
  /** Case où la roue s'arrête (index dans CASES), connue au lancement du tour. */
  arret: number | null;
  bonus: EtatBonus | null;
  gains: Record<string, number>;
  historique: Array<{ zone: Zone; mult: number | null }>;
  presents: Record<string, number>;
}
/** Ce que seul le serveur connaît (les multiplicateurs cachés de la Chasse au trésor). */
export interface SecretRoue { grille: number[] | null }

export class ErreurRoue extends Error {}

export function nouvelEtatRoue(): EtatRoue {
  return { phase: 'attente', manche: 0, echeance: null, debut: 0, mises: {}, boussole: null, arret: null, bonus: null, gains: {}, historique: [], presents: {} };
}

/** Le joueur donne signe de vie (la roue continue de tourner tant que quelqu'un regarde). */
export function signaler(e: EtatRoue, joueur: string, maintenant: number): void {
  e.presents[joueur] = maintenant;
  for (const [j, t] of Object.entries(e.presents)) if (maintenant - t > PRESENCE * 3) delete e.presents[j];
}
const quelquunEstLa = (e: EtatRoue, maintenant: number) => Object.values(e.presents).some((t) => maintenant - t < PRESENCE);

function ouvrirMises(e: EtatRoue, maintenant: number): void {
  e.phase = 'mises'; e.manche += 1; e.debut = maintenant; e.echeance = maintenant + DELAI_MISES;
  e.mises = {}; e.boussole = null; e.arret = null; e.bonus = null; e.gains = {};
}

/** Pose des jetons. Renvoie le montant à débiter. */
export function miserRoue(e: EtatRoue, joueur: { id: string; pseudo: string; photo: string | null; niveau: number },
  zones: Partial<Record<Zone, number>>, maintenant: number): number {
  if (e.phase === 'attente' || e.phase === 'resultats') {
    if (e.phase === 'resultats' && e.echeance !== null && maintenant < e.echeance) throw new ErreurRoue('Les mises rouvrent dans un instant.');
    ouvrirMises(e, maintenant);
  }
  if (e.phase !== 'mises' || (e.echeance !== null && maintenant >= e.echeance)) throw new ErreurRoue('Les mises sont fermées pour ce tour.');
  const max = miseMaxRoue(joueur.niveau);
  const m = e.mises[joueur.id] ?? { pseudo: joueur.pseudo, photo: joueur.photo, zones: {} };
  let total = 0;
  for (const [z, v] of Object.entries(zones) as Array<[Zone, number]>) {
    if (!ZONES.includes(z)) throw new ErreurRoue('Case inconnue.');
    if (!Number.isInteger(v) || v <= 0) continue;
    const deja = m.zones[z] ?? 0;
    if (deja + v > max) throw new ErreurRoue(`Mise max à ton niveau : ${max} par case.`);
    m.zones[z] = deja + v; total += v;
  }
  if (total <= 0) throw new ErreurRoue('Mise invalide.');
  const somme = Object.values(m.zones).reduce((s, v) => s + (v ?? 0), 0);
  if (somme < MISE_MIN_ROUE) throw new ErreurRoue(`Mise minimale : ${MISE_MIN_ROUE}.`);
  e.mises[joueur.id] = m;
  signaler(e, joueur.id, maintenant);
  return total;
}

/** Retire toutes ses mises du tour (tant que les mises sont ouvertes). Renvoie le montant à rendre. */
export function retirerMises(e: EtatRoue, joueur: string, maintenant: number): number {
  if (e.phase !== 'mises' || (e.echeance !== null && maintenant >= e.echeance)) throw new ErreurRoue('Trop tard, la roue va tourner.');
  const m = e.mises[joueur];
  if (!m) return 0;
  const total = Object.values(m.zones).reduce((s, v) => s + (v ?? 0), 0);
  delete e.mises[joueur];
  return total;
}

/** Choix du joueur dans un mini-jeu (une croix de la carte, ou un drapeau). */
export function choisir(e: EtatRoue, joueur: string, choix: number | Drapeau, maintenant: number): void {
  const b = e.bonus;
  if (e.phase !== 'bonus' || !b || (e.echeance !== null && maintenant >= e.echeance)) throw new ErreurRoue('Pas de choix à faire maintenant.');
  if (!e.mises[joueur]?.zones[b.type]) throw new ErreurRoue('Tu n’as pas misé sur ce mini-jeu.');
  if (b.type === 'chasse' && b.etape === 'choix') {
    if (typeof choix !== 'number' || !Number.isInteger(choix) || choix < 0 || choix >= CHASSE_MULTS.length) throw new ErreurRoue('Croix invalide.');
    b.choix[joueur] = choix;
  } else if (b.type === 'tempete' && b.etape === 'choix') {
    if (!DRAPEAUX.includes(choix as Drapeau)) throw new ErreurRoue('Drapeau invalide.');
    b.choix[joueur] = choix as Drapeau;
  } else throw new ErreurRoue('Pas de choix à faire maintenant.');
}

/** Fait avancer la roue quand la minuterie expire. Renvoie vrai si l'état a changé. */
export function avancer(e: EtatRoue, s: SecretRoue, h: Hasard, maintenant: number): boolean {
  if (e.echeance === null || maintenant < e.echeance) return false;
  switch (e.phase) {
    case 'mises':
      if (!Object.keys(e.mises).length) { e.phase = 'attente'; e.echeance = null; return true; }
      e.phase = 'boussole'; e.debut = maintenant; e.echeance = maintenant + DELAI_BOUSSOLE;
      e.boussole = { zone: pondere(h, BOUSSOLE_ZONES), mult: pondere(h, BOUSSOLE_MULTS) };
      return true;
    case 'boussole':
      e.phase = 'tour'; e.debut = maintenant; e.echeance = maintenant + DELAI_TOUR;
      e.arret = Math.floor(h() * CASES.length);
      return true;
    case 'tour': {
      const z = CASES[e.arret!];
      if (!estBonus(z)) { regler(e, maintenant); return true; }
      lancerBonus(e, s, z, h, maintenant);
      return true;
    }
    case 'bonus': {
      const b = e.bonus!;
      if (b.type === 'chasse' && b.etape === 'choix') {
        // Ceux qui n'ont pas choisi reçoivent une croix au hasard ; puis on révèle tout.
        for (const j of Object.keys(e.mises)) if (e.mises[j].zones.chasse && b.choix[j] === undefined) b.choix[j] = Math.floor(h() * CHASSE_MULTS.length);
        b.etape = 'revele'; b.grille = s.grille; s.grille = null; e.debut = maintenant; e.echeance = maintenant + DELAI_REVELE;
        return true;
      }
      if (b.type === 'tempete' && b.etape === 'choix') {
        for (const j of Object.keys(e.mises)) if (e.mises[j].zones.tempete && !b.choix[j]) b.choix[j] = DRAPEAUX[Math.floor(h() * 3)];
        b.etape = 'tour'; b.arret = Math.floor(h() * b.roue.length); e.debut = maintenant; e.echeance = maintenant + DELAI_TEMPETE_TOUR;
        return true;
      }
      regler(e, maintenant);
      return true;
    }
    case 'resultats':
      if (quelquunEstLa(e, maintenant)) ouvrirMises(e, maintenant);
      else { e.phase = 'attente'; e.echeance = null; e.mises = {}; e.gains = {}; e.bonus = null; e.boussole = null; e.arret = null; }
      return true;
    default:
      return false;
  }
}

function lancerBonus(e: EtatRoue, s: SecretRoue, z: Bonus, h: Hasard, maintenant: number): void {
  e.phase = 'bonus'; e.debut = maintenant;
  if (z === 'piece') {
    let a = pondere(h, PIECE_MULTS), b = pondere(h, PIECE_MULTS);
    if (a === b) b = pondere(h, PIECE_MULTS);
    e.bonus = { type: 'piece', faces: { crane: a, couronne: b }, resultat: h() < 0.5 ? 'crane' : 'couronne' };
    e.echeance = maintenant + DELAI_PIECE;
  } else if (z === 'abysses') {
    const base = [...ABYSSES_BASE];
    const chutes: Array<{ arrivee: number; chemin: number[] }> = [];
    let doubles = 0, mult = 0;
    for (let essai = 0; essai < 4; essai++) {
      const chemin: number[] = [];
      let pos = 0;
      for (let rang = 0; rang < 15; rang++) { const d = h() < 0.5 ? 0 : 1; chemin.push(d); pos += d; }
      if (base[pos] === 0 && doubles < 3) { chutes.push({ arrivee: pos, chemin }); doubles++; continue; }
      if (base[pos] === 0) { // après trois doubles, le boulet glisse sur la case voisine
        pos = pos === 4 ? 5 : 10;
      }
      chutes.push({ arrivee: pos, chemin });
      mult = base[pos] * 2 ** doubles;
      break;
    }
    e.bonus = { type: 'abysses', base, chutes, doubles, mult };
    e.echeance = maintenant + DELAI_ABYSSES_CHUTE * chutes.length + 2500;
  } else if (z === 'chasse') {
    s.grille = melanger(h, [...CHASSE_MULTS]);
    e.bonus = { type: 'chasse', etape: 'choix', choix: {}, grille: null };
    e.echeance = maintenant + DELAI_CHOIX;
  } else {
    e.bonus = { type: 'tempete', etape: 'choix', roue: melanger(h, [...TEMPETE_MULTS]), choix: {}, arret: null };
    e.echeance = maintenant + DELAI_CHOIX;
  }
}

/** Multiplicateur obtenu par un joueur dans le mini-jeu (avant la Boussole). */
export function multBonus(b: EtatBonus, joueur: string): number {
  if (b.type === 'piece') return b.faces[b.resultat];
  if (b.type === 'abysses') return b.mult;
  if (b.type === 'chasse') { const c = b.choix[joueur]; return b.grille && c !== undefined ? b.grille[c] : 0; }
  if (b.arret === null) return 0;
  const d = b.choix[joueur] ?? 'rouge';
  return b.roue[(b.arret + DECALAGE_DRAPEAU[d]) % b.roue.length];
}
/** Case de la roue géante pointée par un drapeau. */
export const caseDrapeau = (b: Extract<EtatBonus, { type: 'tempete' }>, d: Drapeau) =>
  b.arret === null ? null : (b.arret + DECALAGE_DRAPEAU[d]) % b.roue.length;

/** Calcule les gains de chacun et passe aux résultats. */
function regler(e: EtatRoue, maintenant: number): void {
  const z = CASES[e.arret!];
  const boost = e.boussole && e.boussole.zone === z ? e.boussole.mult : 1;
  e.gains = {};
  let multAffiche: number | null = null;
  for (const [j, m] of Object.entries(e.mises)) {
    const mise = m.zones[z] ?? 0;
    if (!mise) continue;
    const mult = Math.min(MULT_MAX, (estBonus(z) ? multBonus(e.bonus!, j) : Number(z)) * boost);
    e.gains[j] = mise * mult + mise;
  }
  if (estBonus(z) && e.bonus) {
    multAffiche = e.bonus.type === 'piece' || e.bonus.type === 'abysses' ? multBonus(e.bonus, '') * boost : null;
  } else multAffiche = Number(z) * boost;
  e.historique = [{ zone: z, mult: multAffiche }, ...e.historique].slice(0, 12);
  e.phase = 'resultats'; e.debut = maintenant; e.echeance = maintenant + DELAI_RESULTATS;
}

/** Les gains à verser (une fois, au passage aux résultats). */
export function gainsRoue(e: EtatRoue): Array<{ joueur: string; montant: number }> {
  return Object.entries(e.gains).filter(([, v]) => v > 0).map(([joueur, montant]) => ({ joueur, montant }));
}

/** Espérance de gain (mise rendue comprise) pour 1 Louidor misé sur une case. Sert aux tests. */
export function esperance(z: Zone): number {
  const tot = (t: ReadonlyArray<readonly [unknown, number]>) => t.reduce((s, [, p]) => s + p, 0);
  const pBous = (BOUSSOLE_ZONES.find(([zz]) => zz === z)?.[1] ?? 0) / tot(BOUSSOLE_ZONES);
  const eB = BOUSSOLE_MULTS.reduce((s, [m, p]) => s + m * p, 0) / tot(BOUSSOLE_MULTS);
  const pCase = CASES.filter((c) => c === z).length / CASES.length;
  let eM: number;
  if (z === 'piece') eM = PIECE_MULTS.reduce((s, [m, p]) => s + m * p, 0) / tot(PIECE_MULTS);
  else if (z === 'chasse') eM = CHASSE_MULTS.reduce((s, m) => s + m, 0) / CHASSE_MULTS.length;
  else if (z === 'tempete') eM = TEMPETE_MULTS.reduce((s, m) => s + m, 0) / TEMPETE_MULTS.length;
  else if (z === 'abysses') {
    const c = (n: number, k: number) => { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return r; };
    const w = ABYSSES_BASE.map((_, k) => c(15, k) / 2 ** 15);
    const pd = ABYSSES_BASE.reduce((s, v, i) => s + (v === 0 ? w[i] : 0), 0);
    const en = ABYSSES_BASE.reduce((s, v, i) => s + (v ? w[i] * v : 0), 0) / (1 - pd);
    eM = [0, 1, 2].reduce((s, d) => s + pd ** d * (1 - pd) * 2 ** d * en, 0) + pd ** 3 * 8 * en;
  } else eM = Number(z);
  return pCase * (eM * (1 + pBous * (eB - 1)) + 1);
}
