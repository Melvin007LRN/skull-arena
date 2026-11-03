// Ce que chaque joueur a le droit de voir. Le serveur garde l'état complet et n'envoie que ces vues.
import type { EtatPartie, Phase, PliTermine, PouvoirEnAttente, ScoreManche } from './partie.ts';
import type { CarteJouee } from './pli.ts';
import { cartesAutorisees, joueurActif } from './partie.ts';

export interface VuePublique {
  joueurs: string[];
  manche: number;
  cartesParJoueur: number;
  couronne: number;
  phase: Phase;
  /** Pendant la mise : seulement qui a misé. Ensuite : les mises révélées. */
  aMise: Record<string, boolean>;
  mises: Record<string, number> | null;
  harry: Record<string, number>;
  plisGagnes: Record<string, number>;
  cartesEnMain: Record<string, number>;
  meneur: string;
  joueurActif: string | null;
  pliEnCours: CarteJouee[];
  numeroPli: number;
  dernierPli: PliTermine | null;
  pouvoir: PouvoirEnAttente | null;
  /** Juanita : on dit seulement qui regarde, pas les cartes. */
  juanitaRegarde: string | null;
  harryEnAttente: string[];
  alliances: Array<[string, string]>;
  rascal: Record<string, number>;
  scores: Record<string, number>;
  historique: ScoreManche[][];
}

export interface VuePrivee {
  main: string[];
  jouables: string[];
  revelationJuanita: string[] | null;
}

export function vuePublique(e: EtatPartie): VuePublique {
  const revelees = e.phase !== 'mise';
  return {
    joueurs: e.joueurs,
    manche: e.manche,
    cartesParJoueur: e.cartesParJoueur,
    couronne: e.couronne,
    phase: e.phase,
    aMise: Object.fromEntries(e.joueurs.map((j) => [j, e.mises[j] !== null])),
    mises: revelees ? Object.fromEntries(e.joueurs.map((j) => [j, e.mises[j] ?? 0])) : null,
    harry: e.harry,
    plisGagnes: e.plisGagnes,
    cartesEnMain: Object.fromEntries(e.joueurs.map((j) => [j, e.mains[j].length])),
    meneur: e.meneur,
    joueurActif: joueurActif(e),
    pliEnCours: e.pliEnCours,
    numeroPli: e.numeroPli,
    dernierPli: e.dernierPli,
    pouvoir: e.pouvoir,
    juanitaRegarde: e.revelationJuanita?.joueur ?? null,
    harryEnAttente: e.harryEnAttente,
    alliances: e.alliances,
    rascal: e.rascal,
    scores: e.scores,
    historique: e.historique,
  };
}

export function vuePrivee(e: EtatPartie, joueur: string): VuePrivee {
  return {
    main: e.mains[joueur] ?? [],
    jouables: cartesAutorisees(e, joueur),
    revelationJuanita: e.revelationJuanita?.joueur === joueur ? e.revelationJuanita.cartes : null,
  };
}
