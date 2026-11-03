// Cartes de Skull Arena : 74 cartes du jeu de base (extensions Kraken, Baleine blanche et Butin incluses).
// Chaque carte a un identifiant fixe qui correspond aussi au nom de son image (ex. "jaune_9" -> jaune_9.webp).

export type Couleur = 'jaune' | 'violet' | 'vert' | 'noir';
export type NomPirate = 'rosie' | 'bendt' | 'rascal' | 'juanita' | 'harry';

export type Carte =
  | { id: string; type: 'numero'; couleur: Couleur; valeur: number }
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
};

export function creerPaquet(): Carte[] {
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
  return paquet;
}

export const TAILLE_PAQUET = 74;

const INDEX = new Map(creerPaquet().map((c) => [c.id, c]));

export function carteParId(id: string): Carte {
  const carte = INDEX.get(id);
  if (!carte) throw new Error(`Carte inconnue : ${id}`);
  return carte;
}

export function estNumero(c: Carte): c is Extract<Carte, { type: 'numero' }> {
  return c.type === 'numero';
}

/** Nombre de cartes distribuées à chaque joueur : N à la manche N, limité par la taille du paquet (9 à 8 joueurs en manche 10). */
export function cartesParJoueur(manche: number, nbJoueurs: number): number {
  return Math.min(manche, Math.floor(TAILLE_PAQUET / nbJoueurs));
}
