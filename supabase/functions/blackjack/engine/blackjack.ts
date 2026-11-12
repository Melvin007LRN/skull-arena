// Blackjack du Capitaine : les règles, sans réseau ni base de données.
// Sabot de 6 jeux, le croupier tire jusqu'à 17 (il reste sur 17 souple), blackjack payé 3 contre 2.
// Le serveur garde le sabot et la carte cachée du croupier ; les joueurs ne voient que l'état public.

export const COULEURS_BJ = ['pique', 'coeur', 'carreau', 'trefle'] as const;
export const RANGS_BJ = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'] as const;
export type CouleurBJ = (typeof COULEURS_BJ)[number];
export type RangBJ = (typeof RANGS_BJ)[number];

export const SIEGES_BJ = 5;
export const MISE_MIN_BJ = 10;
/** Durées (ms) des fenêtres de jeu. */
export const DELAI_MISES = 15000;
export const DELAI_TOUR = 20000;
export const DELAI_RESULTATS = 5000;
export const DELAI_CARTE_CROUPIER = 900;

/** Mise maximale selon le niveau : plus on monte, plus on peut miser gros. */
export function miseMax(niveau: number): number {
  const n = Math.max(1, Math.floor(niveau));
  if (n >= 100) return 10000;
  if (n >= 50) return 5000;
  return 50 + 25 * n;
}

export function rangDe(carte: string): RangBJ { return carte.split('_')[1] as RangBJ; }
export function couleurDe(carte: string): CouleurBJ { return carte.split('_')[0] as CouleurBJ; }

/** Valeur d'une main : les As valent 11 tant que ça ne fait pas dépasser 21. */
export function valeurMain(cartes: readonly string[]): { total: number; souple: boolean } {
  let total = 0, as = 0;
  for (const c of cartes) {
    const r = rangDe(c);
    if (r === 'A') { as++; total += 11; } else if (r === 'V' || r === 'D' || r === 'R') total += 10; else total += Number(r);
  }
  while (total > 21 && as > 0) { total -= 10; as--; }
  return { total, souple: as > 0 };
}
export const estBlackjack = (cartes: readonly string[]) => cartes.length === 2 && valeurMain(cartes).total === 21;

/** Générateur pseudo-aléatoire déterministe (mulberry32). */
function hasard(graine: number) {
  let s = graine >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function nouveauSabot(graine: number, jeux = 6): string[] {
  const s: string[] = [];
  for (let j = 0; j < jeux; j++) for (const c of COULEURS_BJ) for (const r of RANGS_BJ) s.push(`${c}_${r}`);
  const h = hasard(graine);
  for (let i = s.length - 1; i > 0; i--) { const k = Math.floor(h() * (i + 1)); [s[i], s[k]] = [s[k], s[i]]; }
  return s;
}

export type EtatMain = 'joue' | 'reste' | 'saute' | 'blackjack' | 'double';
export interface MainBJ { cartes: string[]; mise: number; etat: EtatMain; resultat?: 'gagne' | 'perdu' | 'egalite' | 'blackjack'; gain?: number }
export interface SiegeBJ {
  joueur: string; pseudo: string; photo: string | null; cadre: string | null; niveau: number;
  mise: number; main: MainBJ | null; absences: number; dernierGain?: number;
}
export type PhaseBJ = 'mises' | 'jeu' | 'resultats';
export interface EtatBJ {
  phase: PhaseBJ;
  manche: number;
  /** Fin de la fenêtre en cours (ms depuis 1970), ou null s'il n'y a pas de minuterie. */
  echeance: number | null;
  sieges: Array<SiegeBJ | null>;
  croupier: { cartes: string[]; cachee: boolean };
  /** Siège dont c'est le tour. */
  tour: number | null;
  /** Fin de la révélation du croupier (pour l'animation). */
  revelationA?: number;
}
export interface SecretBJ { sabot: string[]; cachee: string | null; graine: number }

export class ErreurBJ extends Error {}

export function nouvelEtat(): EtatBJ {
  return { phase: 'mises', manche: 0, echeance: null, sieges: Array(SIEGES_BJ).fill(null), croupier: { cartes: [], cachee: false }, tour: null };
}

function tirer(secret: SecretBJ): string {
  if (secret.sabot.length < 20) { secret.graine = (secret.graine * 1103515245 + 12345) >>> 0; secret.sabot = nouveauSabot(secret.graine); }
  return secret.sabot.pop()!;
}

/** Un joueur s'assoit (au premier siège libre, ou à celui demandé). */
export function asseoir(e: EtatBJ, s: Omit<SiegeBJ, 'mise' | 'main' | 'absences'>, place?: number): number {
  const deja = e.sieges.findIndex((x) => x?.joueur === s.joueur);
  if (deja >= 0) return deja;
  const i = place !== undefined && e.sieges[place] === null ? place : e.sieges.findIndex((x) => x === null);
  if (i < 0) throw new ErreurBJ('La table est complète (5 places). Réessaie dans un instant.');
  e.sieges[i] = { ...s, mise: 0, main: null, absences: 0 };
  return i;
}

/** Un joueur se lève : sa main en cours est abandonnée (mise perdue). */
export function lever(e: EtatBJ, joueur: string, secret: SecretBJ, maintenant: number): void {
  const i = e.sieges.findIndex((x) => x?.joueur === joueur);
  if (i < 0) return;
  e.sieges[i] = null;
  if (e.phase === 'jeu' && e.tour === i) passerAuSuivant(e, secret, maintenant);
  if (e.phase === 'mises' && !e.sieges.some((x) => x)) e.echeance = null;
}

/** Mise avant la donne. La première mise lance le compte à rebours ; quand tout le monde a misé, on distribue. */
export function miser(e: EtatBJ, joueur: string, mise: number, secret: SecretBJ, maintenant: number, seul = false): void {
  if (e.phase !== 'mises') throw new ErreurBJ('Attends la prochaine donne pour miser.');
  const s = e.sieges.find((x) => x?.joueur === joueur);
  if (!s) throw new ErreurBJ('Assieds-toi d’abord à la table.');
  if (s.mise > 0) throw new ErreurBJ('Ta mise est déjà posée.');
  const max = miseMax(s.niveau);
  if (!Number.isInteger(mise) || mise < MISE_MIN_BJ) throw new ErreurBJ(`La mise minimale est de ${MISE_MIN_BJ} Louidors.`);
  if (mise > max) throw new ErreurBJ(`À ton niveau, tu peux miser jusqu’à ${max} Louidors.`);
  s.mise = mise;
  s.absences = 0;
  const assis = e.sieges.filter((x): x is SiegeBJ => x !== null);
  if (seul || assis.every((x) => x.mise > 0)) distribuer(e, secret, maintenant);
  else if (e.echeance === null) e.echeance = maintenant + DELAI_MISES;
}

/** Distribue deux cartes à chaque joueur qui a misé et au croupier (dont une cachée). */
export function distribuer(e: EtatBJ, secret: SecretBJ, maintenant: number): void {
  // Ceux qui n'ont pas misé passent leur tour ; deux tours sans miser et ils quittent la table.
  e.sieges = e.sieges.map((s) => {
    if (!s || s.mise > 0) return s;
    return s.absences + 1 >= 2 ? null : { ...s, absences: s.absences + 1, main: null };
  });
  const joueurs = e.sieges.map((s, i) => (s && s.mise > 0 ? i : -1)).filter((i) => i >= 0);
  if (joueurs.length === 0) { e.echeance = null; return; }
  e.manche += 1;
  for (const i of joueurs) e.sieges[i]!.main = { cartes: [], mise: e.sieges[i]!.mise, etat: 'joue' };
  e.croupier = { cartes: [], cachee: true };
  for (let tour = 0; tour < 2; tour++) {
    for (const i of joueurs) e.sieges[i]!.main!.cartes.push(tirer(secret));
    if (tour === 0) e.croupier.cartes.push(tirer(secret)); else secret.cachee = tirer(secret);
  }
  for (const i of joueurs) { const m = e.sieges[i]!.main!; if (estBlackjack(m.cartes)) m.etat = 'blackjack'; }
  e.phase = 'jeu';
  e.tour = null;
  passerAuSuivant(e, secret, maintenant);
}

function passerAuSuivant(e: EtatBJ, secret: SecretBJ, maintenant: number): void {
  const depart = e.tour === null ? 0 : e.tour + 1;
  for (let i = depart; i < SIEGES_BJ; i++) {
    if (e.sieges[i]?.main?.etat === 'joue') { e.tour = i; e.echeance = maintenant + DELAI_TOUR; return; }
  }
  jouerCroupier(e, secret, maintenant);
}

/** Tirer, rester ou doubler. */
export function agir(e: EtatBJ, joueur: string, action: 'tirer' | 'rester' | 'doubler', secret: SecretBJ, maintenant: number): { supplement: number } {
  if (e.phase !== 'jeu' || e.tour === null) throw new ErreurBJ('Ce n’est pas le moment de jouer.');
  const s = e.sieges[e.tour];
  if (!s || s.joueur !== joueur) throw new ErreurBJ('Ce n’est pas ton tour.');
  const m = s.main!;
  let supplement = 0;
  if (action === 'tirer') {
    m.cartes.push(tirer(secret));
    const v = valeurMain(m.cartes).total;
    if (v > 21) m.etat = 'saute';
    else if (v === 21) m.etat = 'reste';
    else { e.echeance = maintenant + DELAI_TOUR; return { supplement }; }
  } else if (action === 'doubler') {
    if (m.cartes.length !== 2) throw new ErreurBJ('On ne double qu’avec ses deux premières cartes.');
    supplement = m.mise;
    m.mise *= 2;
    m.cartes.push(tirer(secret));
    m.etat = valeurMain(m.cartes).total > 21 ? 'saute' : 'double';
  } else m.etat = 'reste';
  passerAuSuivant(e, secret, maintenant);
  return { supplement };
}

/** Le temps de jouer est écoulé : le joueur reste. */
export function delaiEcoule(e: EtatBJ, secret: SecretBJ, maintenant: number): boolean {
  if (e.echeance === null || maintenant < e.echeance) return false;
  if (e.phase === 'mises') { e.echeance = null; distribuer(e, secret, maintenant); return true; }
  if (e.phase === 'jeu' && e.tour !== null) {
    const s = e.sieges[e.tour];
    if (s?.main) s.main.etat = 'reste';
    passerAuSuivant(e, secret, maintenant);
    return true;
  }
  if (e.phase === 'resultats') { nouvelleDonne(e); return true; }
  return false;
}

/** Le croupier retourne sa carte et tire jusqu'à 17, puis on paie. */
function jouerCroupier(e: EtatBJ, secret: SecretBJ, maintenant: number): void {
  e.tour = null;
  if (secret.cachee) e.croupier.cartes.push(secret.cachee);
  secret.cachee = null;
  e.croupier.cachee = false;
  const enJeu = e.sieges.some((s) => s?.main && (s.main.etat === 'reste' || s.main.etat === 'double'));
  if (enJeu) while (valeurMain(e.croupier.cartes).total < 17) e.croupier.cartes.push(tirer(secret));
  const croupier = valeurMain(e.croupier.cartes).total;
  const bjCroupier = estBlackjack(e.croupier.cartes);
  for (const s of e.sieges) {
    const m = s?.main;
    if (!s || !m) continue;
    const v = valeurMain(m.cartes).total;
    if (m.etat === 'blackjack') { m.resultat = bjCroupier ? 'egalite' : 'blackjack'; m.gain = bjCroupier ? m.mise : Math.floor(m.mise * 2.5); }
    else if (m.etat === 'saute') { m.resultat = 'perdu'; m.gain = 0; }
    else if (bjCroupier) { m.resultat = 'perdu'; m.gain = 0; }
    else if (croupier > 21 || v > croupier) { m.resultat = 'gagne'; m.gain = m.mise * 2; }
    else if (v === croupier) { m.resultat = 'egalite'; m.gain = m.mise; }
    else { m.resultat = 'perdu'; m.gain = 0; }
    s.dernierGain = m.gain - m.mise;
  }
  e.phase = 'resultats';
  e.revelationA = maintenant + DELAI_CARTE_CROUPIER * Math.max(1, e.croupier.cartes.length - 1);
  e.echeance = e.revelationA + DELAI_RESULTATS;
}

/** Gains à verser à la fin de la donne (mise rendue comprise). */
export function gains(e: EtatBJ): Array<{ joueur: string; montant: number }> {
  return e.sieges.filter((s): s is SiegeBJ => !!s?.main && (s.main.gain ?? 0) > 0).map((s) => ({ joueur: s.joueur, montant: s.main!.gain! }));
}

/** Prépare la donne suivante : on garde les joueurs assis, on efface les mains. */
export function nouvelleDonne(e: EtatBJ): void {
  e.phase = 'mises';
  e.echeance = null;
  e.tour = null;
  e.revelationA = undefined;
  e.croupier = { cartes: [], cachee: false };
  e.sieges = e.sieges.map((s) => (s ? { ...s, mise: 0, main: null } : null));
}
