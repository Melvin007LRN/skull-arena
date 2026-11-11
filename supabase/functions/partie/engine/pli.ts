// Un pli : qui peut jouer quoi, et qui le remporte (jeu de base + extension).
import { carteParId, COULEURS, type Carte, type Couleur, type NomPirate } from './cards.ts';

export type ModeTigresse = 'pirate' | 'fuite';

export interface CarteJouee {
  joueur: string;
  carteId: string;
  /** Obligatoire quand la carte est la Tigresse. */
  tigresse?: ModeTigresse;
  /** Carte 0/14 de l'extension : valeur choisie. */
  valeur?: 0 | 14;
  /** Joker 15 : couleur qu'il prend (absente si le noir est demandé ou si un personnage a ouvert). */
  couleur?: Couleur;
}

/** Rôle d'une carte dans le pli, une fois la Tigresse décidée. */
export type Role =
  | 'numero' | 'fuite' | 'pirate' | 'skull_king' | 'sirene' | 'second'
  | 'kraken' | 'baleine' | 'raie' // léviathans
  | 'davy' | 'planche' | 'salve'; // ne gagnent jamais

export function role(jouee: CarteJouee): Role {
  const c = carteParId(jouee.carteId);
  switch (c.type) {
    case 'numero':
    case 'double':
    case 'joker':
      return 'numero';
    case 'fuite':
    case 'butin':
      return 'fuite';
    case 'tigresse':
      return jouee.tigresse === 'pirate' ? 'pirate' : 'fuite';
    default:
      return c.type;
  }
}

const PERSONNAGES: ReadonlySet<Role> = new Set(['pirate', 'skull_king', 'sirene', 'second']);
const LEVIATHANS: ReadonlySet<Role> = new Set(['kraken', 'baleine', 'raie']);
const NE_GAGNENT_PAS: ReadonlySet<Role> = new Set(['kraken', 'baleine', 'raie', 'davy', 'planche', 'salve']);

/** Couleur et valeur réelles d'une carte numérotée posée (null si ce n'est pas une carte numérotée). */
export function numeroDe(j: CarteJouee): { couleur: Couleur | null; valeur: number } | null {
  const c = carteParId(j.carteId);
  if (c.type === 'numero') return { couleur: c.couleur, valeur: c.valeur };
  if (c.type === 'double') return { couleur: c.couleur, valeur: j.valeur ?? 14 };
  if (c.type === 'joker') return { couleur: j.couleur ?? null, valeur: 15 };
  return null;
}

/**
 * État de la couleur du pli :
 * - 'libre' : rien n'est encore décidé (pli vide, ou seulement des cartes qui laissent la main : Fuite, Butin,
 *   léviathans, Davy Jones, Planche, Salve) ;
 * - 'aucune' : un personnage a ouvert, aucune couleur n'est imposée ;
 * - une couleur.
 */
export function etatCouleur(cartes: readonly CarteJouee[]): Couleur | 'libre' | 'aucune' {
  for (const j of cartes) {
    const r = role(j);
    if (r === 'numero') {
      const n = numeroDe(j);
      if (n?.couleur) return n.couleur;
      continue;
    }
    if (PERSONNAGES.has(r)) return 'aucune';
  }
  return 'libre';
}

/** Couleur demandée (null si aucune couleur n'est imposée). */
export function couleurDemandee(cartes: readonly CarteJouee[]): Couleur | null {
  const e = etatCouleur(cartes);
  return e === 'libre' || e === 'aucune' ? null : e;
}

/** Couleur que prend un Joker 15 posé maintenant (undefined = le joueur choisit). */
export function couleurImposeeJoker(cartes: readonly CarteJouee[]): Couleur | null | undefined {
  const e = etatCouleur(cartes);
  if (e === 'libre') return undefined; // le joueur choisit
  if (e === 'aucune' || e === 'noir') return null; // pas de couleur à donner
  return e;
}

export const COULEURS_JOKER: readonly Couleur[] = COULEURS.filter((c) => c !== 'noir');

/** Cartes de la main que le joueur a le droit de poser. Le Joker 15 se pose toujours. */
export function cartesJouables(main: readonly string[], dejaJouees: readonly CarteJouee[]): string[] {
  const demandee = couleurDemandee(dejaJouees);
  if (!demandee) return [...main];
  const couleurDe = (c: Carte) => (c.type === 'numero' || c.type === 'double' ? c.couleur : null);
  const aLaCouleur = main.some((id) => couleurDe(carteParId(id)) === demandee);
  if (!aLaCouleur) return [...main];
  return main.filter((id) => {
    const co = couleurDe(carteParId(id));
    return co === null || co === demandee;
  });
}

export interface ResultatPli {
  /** Joueur qui remporte le pli, ou null (Kraken, Baleine ou Raie sans carte numérotée…). */
  gagnant: string | null;
  /** Joueur qui entame le pli suivant (avant un éventuel choix de Rosie). */
  prochainMeneur: string;
  /** Effet spécial appliqué. */
  effet: 'normal' | 'kraken' | 'baleine' | 'raie';
  /** Bonus gagnés par le gagnant dans ce pli (comptés seulement si sa mise est exacte). */
  bonus: number;
  /** Détail des bonus, pour l'affichage. */
  detailBonus: string[];
  /** Alliances de Butin : [joueur du Butin, gagnant du pli]. */
  alliances: Array<[string, string]>;
  /** Premier pouvoir activé (compatibilité d'affichage). */
  pouvoir: NomPirate | null;
  /** Pouvoirs activés pour le gagnant : celui de son Pirate, ou ceux des Pirates capturés par le Second. */
  pouvoirs: NomPirate[];
  /** Index, dans le pli, de la carte gagnante (pour la mise en avant). */
  indexGagnant: number | null;
  /** Index du Pirate jeté à la mer par le Supplice de la planche. */
  retire: number | null;
  /** Index des léviathans détruits par le Casier de Davy Jones. */
  detruits: number[];
  /** Bonus du Casier de Davy Jones : +20 par léviathan détruit, pour le joueur qui a posé le Casier. */
  davy: { joueur: string; points: number } | null;
}

/** Gagnant selon la hiérarchie normale, parmi `indices`, sans tenir compte des léviathans. */
function gagnantNormal(cartes: readonly CarteJouee[], indicesDepart: readonly number[]): number | null {
  const indices = indicesDepart.filter((i) => !NE_GAGNENT_PAS.has(role(cartes[i])));
  if (indices.length === 0) return null;
  const premier = (r: Role) => indices.find((i) => role(cartes[i]) === r);
  const skullKing = premier('skull_king');
  const sirene = premier('sirene');
  const second = premier('second');
  const pirate = premier('pirate');
  if (skullKing !== undefined && sirene !== undefined) return sirene;
  if (skullKing !== undefined) return skullKing;
  if (second !== undefined && sirene !== undefined) return sirene; // la Sirène bat le Second, même avec un Pirate
  if (second !== undefined) return second;
  if (pirate !== undefined) return pirate;
  if (sirene !== undefined) return sirene;

  const numeros = indices.filter((i) => role(cartes[i]) === 'numero');
  if (numeros.length === 0) return indices[0]; // uniquement des Fuites : la première posée gagne
  const n = (i: number) => numeroDe(cartes[i])!;
  const noirs = numeros.filter((i) => n(i).couleur === 'noir');
  const meneuse = numeros.map((i) => n(i).couleur).find((c) => c !== null) ?? null;
  const candidats = noirs.length > 0 ? noirs : numeros.filter((i) => n(i).couleur === meneuse);
  if (candidats.length === 0) return numeros[0];
  return candidats.reduce((best, i) => (n(i).valeur > n(best).valeur ? i : best)); // égalité : la première posée
}

/**
 * Résout un pli complet.
 * @param retire index du Pirate jeté à la mer par le Supplice de la planche (le pli se joue comme s'il n'était pas là).
 */
export function resoudrePli(cartes: readonly CarteJouee[], retire: number | null = null): ResultatPli {
  if (cartes.length < 1) throw new Error('Un pli doit contenir au moins une carte.');
  let actives = cartes.map((_, i) => i).filter((i) => i !== retire);

  // Casier de Davy Jones : tous les léviathans du pli sont détruits.
  const avecDavy = actives.some((i) => role(cartes[i]) === 'davy');
  const detruits = avecDavy ? actives.filter((i) => LEVIATHANS.has(role(cartes[i]))) : [];
  actives = actives.filter((i) => !detruits.includes(i));
  const indexDavy = avecDavy ? actives.find((i) => role(cartes[i]) === 'davy')! : -1;
  const davy = detruits.length > 0 ? { joueur: cartes[indexDavy].joueur, points: 20 * detruits.length } : null;

  // Plusieurs léviathans : seul le dernier posé compte.
  const leviathans = actives.filter((i) => LEVIATHANS.has(role(cartes[i])));
  const dernierLev = leviathans.length ? leviathans[leviathans.length - 1] : null;
  const effet = (dernierLev === null ? 'normal' : role(cartes[dernierLev])) as ResultatPli['effet'];

  const vide = {
    gagnant: null, bonus: 0, detailBonus: [] as string[], alliances: [] as Array<[string, string]>,
    pouvoir: null, pouvoirs: [] as NomPirate[], indexGagnant: null, retire, detruits, davy,
  };

  if (effet === 'kraken') {
    const auraitGagne = gagnantNormal(cartes, actives);
    return { ...vide, effet, prochainMeneur: cartes[auraitGagne ?? dernierLev!].joueur };
  }

  let idx: number | null;
  if (effet === 'baleine' || effet === 'raie') {
    // Baleine : la plus haute carte numérotée gagne. Raie : la plus basse. Égalité : la première posée.
    const numeros = actives.filter((i) => role(cartes[i]) === 'numero');
    if (numeros.length === 0) return { ...vide, effet, prochainMeneur: cartes[dernierLev!].joueur };
    const v = (i: number) => numeroDe(cartes[i])!.valeur;
    idx = numeros.reduce((best, i) => ((effet === 'baleine' ? v(i) > v(best) : v(i) < v(best)) ? i : best));
  } else {
    idx = gagnantNormal(cartes, actives);
  }
  if (idx === null) {
    // Personne ne peut gagner (par exemple seulement des cartes spéciales qui ne gagnent jamais).
    return { ...vide, effet, prochainMeneur: cartes[actives[0] ?? 0].joueur };
  }

  const gagnant = cartes[idx].joueur;
  const roleGagnant = role(cartes[idx]);
  let bonus = 0;
  const detailBonus: string[] = [];

  for (const i of actives) {
    const c = carteParId(cartes[i].carteId);
    if (c.type === 'numero' && c.valeur === 14) {
      const pts = c.couleur === 'noir' ? 20 : 10;
      bonus += pts;
      detailBonus.push(`14 ${c.couleur} capturé : +${pts}`);
    }
    if (c.type === 'numero' && c.bonusPli) {
      bonus += c.bonusPli;
      detailBonus.push(`${c.valeur} ${c.couleur} capturé : ${c.bonusPli > 0 ? '+' : ''}${c.bonusPli}`);
    }
  }
  if (effet === 'normal') {
    const nb = (r: Role) => actives.filter((i) => role(cartes[i]) === r).length;
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
    if ((roleGagnant === 'skull_king' || roleGagnant === 'sirene') && nb('second') > 0) {
      bonus += 30;
      detailBonus.push('Le Second capturé : +30');
    }
  }

  const alliances: Array<[string, string]> = actives
    .filter((i) => carteParId(cartes[i].carteId).type === 'butin' && cartes[i].joueur !== gagnant)
    .map((i) => [cartes[i].joueur, gagnant]);

  // Pouvoirs : le Pirate gagnant, ou tous les Pirates capturés par le Second (dans l'ordre où ils ont été posés).
  const pouvoirs: NomPirate[] = [];
  if (effet === 'normal') {
    const carteGagnante = carteParId(cartes[idx].carteId);
    if (carteGagnante.type === 'pirate') pouvoirs.push(carteGagnante.pirate);
    if (carteGagnante.type === 'second') {
      for (const i of actives) {
        const c = carteParId(cartes[i].carteId);
        if (c.type === 'pirate') pouvoirs.push(c.pirate);
      }
    }
  }

  return {
    gagnant, prochainMeneur: gagnant, effet, bonus, detailBonus, alliances,
    pouvoir: pouvoirs[0] ?? null, pouvoirs, indexGagnant: idx, retire, detruits, davy,
  };
}

/** Pirates (au sens du pli : Pirates, Mary, Tigresse jouée en Pirate) que le Supplice de la planche peut retirer. */
export function piratesDuPli(cartes: readonly CarteJouee[]): number[] {
  return cartes.map((_, i) => i).filter((i) => role(cartes[i]) === 'pirate');
}
