// Cartes de Skull Arena : 74 cartes du jeu de base (Kraken, Baleine blanche et Butin inclus)
// + 19 cartes de l'extension (7, 8 et 0/14 de chaque couleur, Joker 15, Mary Thorne, le Second,
// Raie tachetée, Casier de Davy Jones, Supplice de la planche, Dernière salve).
// Chaque carte a un identifiant fixe qui correspond aussi au nom de son image (ex. "jaune_9" -> jaune_9.webp).

export type Couleur = 'jaune' | 'violet' | 'vert' | 'noir';
export type NomPirate = 'rosie' | 'bendt' | 'rascal' | 'juanita' | 'harry' | 'mary';

export type Carte =
  /** `bonusPli` : 7 et 8 de l'extension (-5 / +5 au gagnant du pli si sa mise est exacte). */
  | { id: string; type: 'numero'; couleur: Couleur; valeur: number; bonusPli?: number }
  /** Extension : vaut 0 ou 14 au choix du joueur, sans bonus. */
  | { id: string; type: 'double'; couleur: Couleur }
  /** Extension : un 15 jaune, violet ou vert. */
  | { id: string; type: 'joker' }
  | { id: string; type: 'second' }
  | { id: string; type: 'raie' }
  | { id: string; type: 'davy' }
  | { id: string; type: 'planche' }
  | { id: string; type: 'salve' }
  | { id: string; type: 'fuite' }
  | { id: string; type: 'pirate'; pirate: NomPirate }
  | { id: string; type: 'tigresse' }
  | { id: string; type: 'skull_king' }
  | { id: string; type: 'sirene' }
  | { id: string; type: 'kraken' }
  | { id: string; type: 'baleine' }
  | { id: string; type: 'butin' };

export const COULEURS: readonly Couleur[] = ['jaune', 'violet', 'vert', 'noir'];
export const PIRATES: readonly NomPirate[] = ['rosie', 'bendt', 'rascal', 'juanita', 'harry'];

/** Noms affichés en français. */
export const NOMS_PIRATES: Record<NomPirate, string> = {
  rosie: 'Rosie de Laney',
  bendt: 'Bendt le Bandit',
  rascal: 'Rascal de Roatan',
  juanita: 'Juanita Jade',
  harry: 'Harry le Géant',
  mary: 'Mary Thorne',
};

export function creerPaquet(extension = false): Carte[] {
  const paquet: Carte[] = [];
  for (const couleur of COULEURS) {
    for (let valeur = 1; valeur <= 14; valeur++) {
      paquet.push({ id: `${couleur}_${valeur}`, type: 'numero', couleur, valeur });
    }
  }
  for (let i = 1; i <= 5; i++) paquet.push({ id: `fuite_${i}`, type: 'fuite' });
  for (const pirate of PIRATES) paquet.push({ id: `pirate_${pirate}`, type: 'pirate', pirate });
  paquet.push({ id: 'tigresse', type: 'tigresse' });
  paquet.push({ id: 'skull_king', type: 'skull_king' });
  paquet.push({ id: 'sirene_1', type: 'sirene' }, { id: 'sirene_2', type: 'sirene' });
  paquet.push({ id: 'kraken', type: 'kraken' });
  paquet.push({ id: 'baleine', type: 'baleine' });
  paquet.push({ id: 'butin_1', type: 'butin' }, { id: 'butin_2', type: 'butin' });
  if (extension) paquet.push(...CARTES_EXTENSION);
  return paquet;
}

export const CARTES_EXTENSION: readonly Carte[] = [
  ...COULEURS.flatMap((couleur): Carte[] => [
    { id: `${couleur}_7x`, type: 'numero', couleur, valeur: 7, bonusPli: -5 },
    { id: `${couleur}_8x`, type: 'numero', couleur, valeur: 8, bonusPli: 5 },
    { id: `${couleur}_0_14`, type: 'double', couleur },
  ]),
  { id: 'joker_15', type: 'joker' },
  { id: 'pirate_mary', type: 'pirate', pirate: 'mary' },
  { id: 'second', type: 'second' },
  { id: 'raie', type: 'raie' },
  { id: 'davy_jones', type: 'davy' },
  { id: 'planche', type: 'planche' },
  { id: 'salve', type: 'salve' },
];

export const TAILLE_PAQUET = 74;
export const TAILLE_PAQUET_EXTENSION = 74 + 19;

const INDEX = new Map(creerPaquet(true).map((c) => [c.id, c]));

export function carteParId(id: string): Carte {
  const carte = INDEX.get(id);
  if (!carte) throw new Error(`Carte inconnue : ${id}`);
  return carte;
}

export function estNumero(c: Carte): c is Extract<Carte, { type: 'numero' }> {
  return c.type === 'numero';
}

/** Nombre de cartes distribuées à chaque joueur : N à la manche N, limité par la taille du paquet (9 à 8 joueurs en manche 10, sans l'extension). */
export function cartesParJoueur(manche: number, nbJoueurs: number, extension = false): number {
  return Math.min(manche, Math.floor((extension ? TAILLE_PAQUET_EXTENSION : TAILLE_PAQUET) / nbJoueurs));
}
