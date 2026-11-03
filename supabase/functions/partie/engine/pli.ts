// Un pli : qui peut jouer quoi, et qui le remporte.
import { carteParId, type Carte, type Couleur, type NomPirate } from './cards.ts';

export type ModeTigresse = 'pirate' | 'fuite';

export interface CarteJouee {
  joueur: string;
  carteId: string;
  /** Obligatoire quand la carte est la Tigresse. */
  tigresse?: ModeTigresse;
}

/** Rôle d'une carte dans le pli, une fois la Tigresse décidée. */
export type Role = 'numero' | 'fuite' | 'pirate' | 'skull_king' | 'sirene' | 'kraken' | 'baleine';

export function role(jouee: CarteJouee): Role {
  const c = carteParId(jouee.carteId);
  switch (c.type) {
    case 'numero':
      return 'numero';
    case 'fuite':
    case 'butin':
      return 'fuite';
    case 'tigresse':
      return jouee.tigresse === 'pirate' ? 'pirate' : 'fuite';
    case 'pirate':
      return 'pirate';
    case 'skull_king':
      return 'skull_king';
    case 'sirene':
      return 'sirene';
    case 'kraken':
      return 'kraken';
    case 'baleine':
      return 'baleine';
  }
}

const PERSONNAGES: ReadonlySet<Role> = new Set(['pirate', 'skull_king', 'sirene']);

/**
 * Couleur demandée : la première carte qui n'est ni une Fuite, ni un Butin, ni un Kraken, ni une Baleine décide.
 * Si c'est une carte numérotée, sa couleur est demandée ; si c'est un personnage, aucune couleur n'est imposée.
 */
export function couleurDemandee(cartes: readonly CarteJouee[]): Couleur | null {
  for (const j of cartes) {
    const r = role(j);
    if (r === 'numero') {
      const c = carteParId(j.carteId) as Extract<Carte, { type: 'numero' }>;
      return c.couleur;
    }
    if (PERSONNAGES.has(r)) return null;
  }
  return null;
}

/** Cartes de la main que le joueur a le droit de poser. */
export function cartesJouables(main: readonly string[], dejaJouees: readonly CarteJouee[]): string[] {
  const demandee = couleurDemandee(dejaJouees);
  if (!demandee) return [...main];
  const aLaCouleur = main.some((id) => {
    const c = carteParId(id);
    return c.type === 'numero' && c.couleur === demandee;
  });
  if (!aLaCouleur) return [...main];
  return main.filter((id) => {
    const c = carteParId(id);
    return c.type !== 'numero' || c.couleur === demandee;
  });
}

export interface ResultatPli {
  /** Joueur qui remporte le pli, ou null (Kraken, ou Baleine avec uniquement des spéciales). */
  gagnant: string | null;
  /** Joueur qui entame le pli suivant (avant un éventuel choix de Rosie). */
  prochainMeneur: string;
  /** Effet spécial appliqué. */
  effet: 'normal' | 'kraken' | 'baleine';
  /** Bonus gagnés par le gagnant dans ce pli (comptés seulement si sa mise est exacte). */
  bonus: number;
  /** Détail des bonus, pour l'affichage. */
  detailBonus: string[];
  /** Alliances de Butin : [joueur du Butin, gagnant du pli]. */
  alliances: Array<[string, string]>;
  /** Pirate dont le pouvoir s'active (le gagnant l'a joué et a gagné avec). */
  pouvoir: NomPirate | null;
  /** Index, dans le pli, de la carte gagnante (pour la mise en avant). */
  indexGagnant: number | null;
}

/** Gagnant selon la hiérarchie normale, sans tenir compte du Kraken ni de la Baleine. Renvoie l'index dans `cartes`. */
function gagnantNormal(cartes: readonly CarteJouee[]): number | null {
  const indices = cartes.map((_, i) => i).filter((i) => {
    const r = role(cartes[i]);
    return r !== 'kraken' && r !== 'baleine';
  });
  if (indices.length === 0) return null;
  const premier = (r: Role) => indices.find((i) => role(cartes[i]) === r);
  const skullKing = premier('skull_king');
  const sirene = premier('sirene');
  const pirate = premier('pirate');
  if (skullKing !== undefined && sirene !== undefined) return sirene;
  if (skullKing !== undefined) return skullKing;
  if (pirate !== undefined) return pirate;
  if (sirene !== undefined) return sirene;

  const numeros = indices.filter((i) => role(cartes[i]) === 'numero');
  if (numeros.length === 0) return indices[0]; // uniquement des Fuites : la première posée gagne
  const valeurDe = (i: number) => carteParId(cartes[i].carteId) as Extract<Carte, { type: 'numero' }>;
  const noirs = numeros.filter((i) => valeurDe(i).couleur === 'noir');
  const candidats = noirs.length > 0 ? noirs : numeros.filter((i) => valeurDe(i).couleur === valeurDe(numeros[0]).couleur);
  return candidats.reduce((best, i) => (valeurDe(i).valeur > valeurDe(best).valeur ? i : best));
}

export function resoudrePli(cartes: readonly CarteJouee[]): ResultatPli {
  if (cartes.length < 2) throw new Error('Un pli doit contenir au moins 2 cartes.');
  const idxKraken = cartes.findIndex((j) => role(j) === 'kraken');
  const idxBaleine = cartes.findIndex((j) => role(j) === 'baleine');
  // Si le Kraken et la Baleine sont dans le même pli, seul l'effet de la seconde posée s'applique.
  let effet: ResultatPli['effet'] = 'normal';
  if (idxKraken >= 0 && idxBaleine >= 0) effet = idxKraken > idxBaleine ? 'kraken' : 'baleine';
  else if (idxKraken >= 0) effet = 'kraken';
  else if (idxBaleine >= 0) effet = 'baleine';

  const vide: Omit<ResultatPli, 'prochainMeneur' | 'effet'> = {
    gagnant: null, bonus: 0, detailBonus: [], alliances: [], pouvoir: null, indexGagnant: null,
  };

  if (effet === 'kraken') {
    const auraitGagne = gagnantNormal(cartes);
    return { ...vide, effet, prochainMeneur: cartes[auraitGagne ?? idxKraken].joueur };
  }

  let idx: number | null;
  if (effet === 'baleine') {
    const numeros = cartes.map((_, i) => i).filter((i) => role(cartes[i]) === 'numero');
    if (numeros.length === 0) {
      return { ...vide, effet, prochainMeneur: cartes[idxBaleine].joueur };
    }
    const v = (i: number) => (carteParId(cartes[i].carteId) as Extract<Carte, { type: 'numero' }>).valeur;
    idx = numeros.reduce((best, i) => (v(i) > v(best) ? i : best)); // égalité : la première posée gagne
  } else {
    idx = gagnantNormal(cartes);
  }
  if (idx === null) throw new Error('Pli sans gagnant inattendu.');

  const gagnant = cartes[idx].joueur;
  const roleGagnant = role(cartes[idx]);
  let bonus = 0;
  const detailBonus: string[] = [];

  for (const j of cartes) {
    const c = carteParId(j.carteId);
    if (c.type === 'numero' && c.valeur === 14) {
      const pts = c.couleur === 'noir' ? 20 : 10;
      bonus += pts;
      detailBonus.push(`14 ${c.couleur} capturé : +${pts}`);
    }
  }
  if (effet === 'normal') {
    const nb = (r: Role) => cartes.filter((j) => role(j) === r).length;
    if (roleGagnant === 'sirene' && nb('skull_king') > 0) {
      bonus += 40;
      detailBonus.push('Skull King pris par une Sirène : +40');
    } else if (roleGagnant === 'skull_king' && nb('pirate') > 0) {
      bonus += 30 * nb('pirate');
      detailBonus.push(`${nb('pirate')} Pirate(s) pris par le Skull King : +${30 * nb('pirate')}`);
    } else if (roleGagnant === 'pirate' && nb('sirene') > 0) {
      bonus += 20 * nb('sirene');
      detailBonus.push(`${nb('sirene')} Sirène(s) prise(s) par un Pirate : +${20 * nb('sirene')}`);
    }
  }

  const alliances: Array<[string, string]> = cartes
    .filter((j) => carteParId(j.carteId).type === 'butin' && j.joueur !== gagnant)
    .map((j) => [j.joueur, gagnant]);

  const carteGagnante = carteParId(cartes[idx].carteId);
  const pouvoir = effet === 'normal' && carteGagnante.type === 'pirate' ? carteGagnante.pirate : null;

  return { gagnant, prochainMeneur: gagnant, effet, bonus, detailBonus, alliances, pouvoir, indexGagnant: idx };
}
