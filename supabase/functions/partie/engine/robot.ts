// Cerveau des robots : un seul niveau, « correct ». Le robot estime ses plis pour miser,
// puis essaie de gagner exactement le nombre de plis annoncé.
import { carteParId, type Carte } from './cards.ts';
import { cartesJouables, resoudrePli, type CarteJouee } from './pli.ts';
import { joueurActif, type Action, type EtatPartie } from './partie.ts';

/** Force approximative d'une carte (plus c'est haut, plus elle a de chances de gagner un pli). */
function force(c: Carte): number {
  switch (c.type) {
    case 'skull_king': return 100;
    case 'pirate': return 92;
    case 'tigresse': return 91;
    case 'sirene': return 88;
    case 'numero': return c.couleur === 'noir' ? 60 + c.valeur : c.valeur * 3;
    case 'baleine': return 8;
    case 'kraken': return 2;
    case 'fuite':
    case 'butin': return 0;
  }
}

/** Probabilité estimée qu'une carte remporte un pli, selon le nombre de joueurs. */
function chanceDeGagner(c: Carte, nbJoueurs: number): number {
  const dilution = Math.sqrt(3 / Math.max(2, nbJoueurs));
  switch (c.type) {
    case 'skull_king': return 0.85;
    case 'pirate': return 0.7;
    case 'tigresse': return 0.6;
    case 'sirene': return 0.55;
    case 'numero':
      if (c.couleur === 'noir') return Math.min(0.85, (0.1 + (c.valeur / 14) * 0.7) * dilution);
      return c.valeur >= 12 ? (0.18 + (c.valeur - 12) * 0.12) * dilution : c.valeur >= 10 ? 0.08 * dilution : 0.02;
    default: return 0;
  }
}

export function miseRobot(main: readonly string[], nbJoueurs: number): number {
  const total = main.reduce((s, id) => s + chanceDeGagner(carteParId(id), nbJoueurs), 0);
  return Math.max(0, Math.min(main.length, Math.round(total)));
}

/** Est-ce que cette carte, posée maintenant, gagnerait le pli tel qu'il est ? */
function gagneMaintenant(pli: readonly CarteJouee[], moi: string, id: string, tigresse?: 'pirate' | 'fuite'): boolean {
  const essai: CarteJouee[] = [...pli, tigresse ? { joueur: moi, carteId: id, tigresse } : { joueur: moi, carteId: id }];
  if (essai.length < 2) return false;
  return resoudrePli(essai).gagnant === moi;
}

function choisirCarte(e: EtatPartie, moi: string): { carteId: string; tigresse?: 'pirate' | 'fuite' } {
  const main = e.mains[moi];
  const jouables = cartesJouables(main, e.pliEnCours);
  const mise = (e.mises[moi] ?? 0) + e.harry[moi];
  const besoin = mise - e.plisGagnes[moi]; // plis qu'il reste à gagner
  const veutGagner = besoin > 0;
  const dernierAJouer = e.pliEnCours.length === e.joueurs.length - 1;
  const trie = [...jouables].sort((a, b) => force(carteParId(a)) - force(carteParId(b))); // du plus faible au plus fort
  const mode = (id: string) => (carteParId(id).type === 'tigresse' ? (veutGagner ? 'pirate' : 'fuite') : undefined);
  const avec = (id: string) => ({ carteId: id, tigresse: mode(id) });

  // Ouvrir le pli
  if (e.pliEnCours.length === 0) {
    if (veutGagner) {
      // Avec beaucoup de plis à faire, on attaque avec une carte forte ; sinon on garde les atouts pour plus tard.
      const restants = main.length;
      return avec(besoin >= restants / 2 ? trie[trie.length - 1] : trie[Math.floor(trie.length / 2)]);
    }
    const sur = trie.find((id) => ['fuite', 'butin', 'kraken'].includes(carteParId(id).type));
    return avec(sur ?? trie[0]);
  }

  const gagnantes = trie.filter((id) => gagneMaintenant(e.pliEnCours, moi, id, mode(id)));
  const perdantes = trie.filter((id) => !gagnantes.includes(id));

  if (veutGagner) {
    if (gagnantes.length > 0) {
      // Dernier à jouer : la plus petite carte qui gagne suffit. Sinon, une carte solide pour résister aux suivants.
      return avec(dernierAJouer ? gagnantes[0] : gagnantes[gagnantes.length > 1 ? 1 : 0]);
    }
    return avec(perdantes[0]); // impossible de gagner : on se débarrasse de la plus faible
  }
  // On veut perdre : poser la plus forte carte qui perd quand même (pour se débarrasser des cartes dangereuses).
  if (perdantes.length > 0) {
    const sansKraken = perdantes.filter((id) => carteParId(id).type !== 'kraken');
    const pool = dernierAJouer ? perdantes : sansKraken.length > 0 ? sansKraken : perdantes;
    return avec(pool[pool.length - 1]);
  }
  return avec(trie[0]);
}

/** Action que ferait le robot `moi` maintenant, ou null s'il n'a rien à faire. */
export function actionRobot(e: EtatPartie, moi: string): Action | null {
  switch (e.phase) {
    case 'mise':
      return e.mises[moi] === null ? { type: 'miser', joueur: moi, mise: miseRobot(e.mains[moi], e.joueurs.length) } : null;
    case 'jeu':
      return joueurActif(e) === moi ? { type: 'jouer', joueur: moi, ...choisirCarte(e, moi) } : null;
    case 'pouvoir': {
      const p = e.pouvoir;
      if (!p || p.joueur !== moi) return null;
      const besoin = (e.mises[moi] ?? 0) + e.harry[moi] - e.plisGagnes[moi];
      if (p.type === 'rosie') {
        const suivant = e.joueurs[(e.joueurs.indexOf(moi) + 1) % e.joueurs.length];
        return { type: 'rosie', joueur: moi, choix: besoin > 0 ? moi : suivant };
      }
      if (p.type === 'rascal') {
        const restants = e.mains[moi].length;
        const pari = besoin === 0 && restants <= 2 ? 20 : Math.abs(besoin) <= 1 ? 10 : 0;
        return { type: 'rascal', joueur: moi, pari: pari as 0 | 10 | 20 };
      }
      // Bendt : on garde ce qui aide à atteindre la mise.
      const trie = [...e.mains[moi]].sort((a, b) => force(carteParId(a)) - force(carteParId(b)));
      const defausse = besoin > 0 ? trie.slice(0, p.aDefausser) : trie.slice(trie.length - p.aDefausser);
      return { type: 'bendt', joueur: moi, defausse };
    }
    case 'harry': {
      if (!e.harryEnAttente.includes(moi)) return null;
      const ecart = e.plisGagnes[moi] - ((e.mises[moi] ?? 0) + e.harry[moi]);
      const ajustement = ecart === 1 ? 1 : ecart === -1 ? -1 : 0;
      return { type: 'harry', joueur: moi, ajustement };
    }
    default:
      return null;
  }
}
