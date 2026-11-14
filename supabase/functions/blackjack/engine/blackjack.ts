// Blackjack du Capitaine : les règles, sans réseau ni base de données.
// Sabot de 6 jeux. Le croupier tire jusqu'à 17 (il reste sur 17 souple) et regarde sa carte cachée
// quand il montre un As ou une figure (s'il a blackjack, la donne s'arrête). Blackjack payé 3 pour 2.
// Doubler sur deux cartes (aussi après une séparation), une seule séparation par donne (les As séparés
// reçoivent une carte chacun). Paris annexes : Paires parfaites, 21+3 et Assurance.
// Le serveur garde le sabot et la carte cachée du croupier ; les joueurs ne voient que l'état public.

export const COULEURS_BJ = ['pique', 'coeur', 'carreau', 'trefle'] as const;
export const RANGS_BJ = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R'] as const;
export type CouleurBJ = (typeof COULEURS_BJ)[number];
export type RangBJ = (typeof RANGS_BJ)[number];

export const SIEGES_BJ = 5;
export const MISE_MIN_BJ = 10;
/** Durées (ms). */
export const DELAI_MISES = 15000;
export const DELAI_TOUR = 20000;
export const DELAI_ASSURANCE = 10000;
export const DELAI_RESULTATS = 6000;
export const DELAI_CARTE_DONNE = 520;
export const DELAI_CARTE_CROUPIER = 950;

/** Niveau donné à l'admin : aucune limite de mise (seulement ses Louidors). */
export const NIVEAU_SANS_LIMITE = 1_000_000;
/** Mise maximale selon le niveau : plus on monte, plus on peut miser gros. */
export function miseMax(niveau: number): number {
  if (niveau >= NIVEAU_SANS_LIMITE) return 1_000_000_000;
  const n = Math.max(1, Math.floor(niveau));
  if (n >= 100) return 10000;
  if (n >= 50) return 5000;
  return 50 + 25 * n;
}

export function rangDe(carte: string): RangBJ { return carte.split('_')[1] as RangBJ; }
export function couleurDe(carte: string): CouleurBJ { return carte.split('_')[0] as CouleurBJ; }
const estRouge = (c: string) => couleurDe(c) === 'coeur' || couleurDe(c) === 'carreau';
const valeurCarte = (c: string) => { const r = rangDe(c); return r === 'A' ? 11 : r === 'V' || r === 'D' || r === 'R' ? 10 : Number(r); };

/** Valeur d'une main : les As valent 11 tant que ça ne fait pas dépasser 21. */
export function valeurMain(cartes: readonly string[]): { total: number; souple: boolean } {
  let total = 0, as = 0;
  for (const c of cartes) { const v = valeurCarte(c); if (v === 11) as++; total += v; }
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

// ---------------- Paris annexes ----------------
export interface ResultatAnnexe { pari: 'paires' | '21+3' | 'assurance'; nom: string; mise: number; gain: number }

/** Paires parfaites : les deux premières cartes du joueur. */
export function evaluerPaires(c: readonly string[]): { nom: string; multiple: number } | null {
  if (c.length < 2 || rangDe(c[0]) !== rangDe(c[1])) return null;
  if (couleurDe(c[0]) === couleurDe(c[1])) return { nom: 'Paire parfaite', multiple: 25 };
  if (estRouge(c[0]) === estRouge(c[1])) return { nom: 'Paire colorée', multiple: 12 };
  return { nom: 'Paire mixte', multiple: 5 };
}

const ORDRE: Record<string, number> = { A: 1, V: 11, D: 12, R: 13 };
const rangNum = (c: string) => ORDRE[rangDe(c)] ?? Number(rangDe(c));
/** 21+3 : les deux cartes du joueur et la carte visible du croupier, comme une main de poker. */
export function evaluer213(c: readonly string[]): { nom: string; multiple: number } | null {
  if (c.length < 3) return null;
  const couleur = c.every((x) => couleurDe(x) === couleurDe(c[0]));
  const rangs = c.map(rangNum).sort((a, b) => a - b);
  const brelan = rangs[0] === rangs[2];
  const suite = (rangs[1] === rangs[0] + 1 && rangs[2] === rangs[1] + 1) || (rangs[0] === 1 && rangs[1] === 12 && rangs[2] === 13);
  if (brelan && couleur) return { nom: 'Brelan assorti', multiple: 100 };
  if (suite && couleur) return { nom: 'Quinte flush', multiple: 40 };
  if (brelan) return { nom: 'Brelan', multiple: 30 };
  if (suite) return { nom: 'Suite', multiple: 10 };
  if (couleur) return { nom: 'Couleur', multiple: 5 };
  return null;
}

// ---------------- État de la table ----------------
export type EtatMain = 'joue' | 'reste' | 'saute' | 'blackjack' | 'double';
export interface MainBJ { cartes: string[]; mise: number; etat: EtatMain; separee?: boolean; resultat?: 'gagne' | 'perdu' | 'egalite' | 'blackjack'; gain?: number }
export interface SiegeBJ {
  joueur: string; pseudo: string; photo: string | null; cadre: string | null; niveau: number;
  mise: number;
  /** Paris annexes posés avec la mise. */
  annexes: { paires: number; vingtEtUn: number };
  /** null : pas encore décidé ; 0 : refusée. */
  assurance: number | null;
  mains: MainBJ[];
  /** Main en cours (après une séparation). */
  active: number;
  absences: number;
  resultatsAnnexes?: ResultatAnnexe[];
  dernierGain?: number;
}
export type PhaseBJ = 'mises' | 'assurance' | 'jeu' | 'resultats';
export interface EtatBJ {
  phase: PhaseBJ;
  manche: number;
  /** Fin de la fenêtre en cours (ms depuis 1970), ou null s'il n'y a pas de minuterie. */
  echeance: number | null;
  sieges: Array<SiegeBJ | null>;
  croupier: { cartes: string[]; cachee: boolean };
  /** Siège dont c'est le tour. */
  tour: number | null;
  /** Début de la donne et ordre des sièges servis (pour distribuer les cartes une à une à l'écran). */
  donneA?: number;
  ordre?: number[];
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

/** Durée de la distribution à l'écran. */
export function dureeDonne(nbJoueurs: number): number { return (nbJoueurs + 1) * 2 * DELAI_CARTE_DONNE + 300; }

type Identite = Pick<SiegeBJ, 'joueur' | 'pseudo' | 'photo' | 'cadre' | 'niveau'>;
const siegeVide = (s: Identite): SiegeBJ => ({ ...s, mise: 0, annexes: { paires: 0, vingtEtUn: 0 }, assurance: null, mains: [], active: 0, absences: 0 });

/** Un joueur s'assoit (au premier siège libre, ou à celui demandé). */
export function asseoir(e: EtatBJ, s: Identite, place?: number): number {
  const deja = e.sieges.findIndex((x) => x?.joueur === s.joueur);
  if (deja >= 0) { e.sieges[deja]!.niveau = s.niveau; return deja; } // niveau à jour (mise max)
  const i = place !== undefined && e.sieges[place] === null ? place : e.sieges.findIndex((x) => x === null);
  if (i < 0) throw new ErreurBJ('La table est complète (5 places). Réessaie dans un instant.');
  e.sieges[i] = siegeVide(s);
  return i;
}

/** Un joueur se lève : ses mains en cours sont abandonnées (mises perdues). */
export function lever(e: EtatBJ, joueur: string, secret: SecretBJ, maintenant: number): void {
  const i = e.sieges.findIndex((x) => x?.joueur === joueur);
  if (i < 0) return;
  e.sieges[i] = null;
  if (e.phase === 'jeu' && e.tour === i) passerAuSuivant(e, secret, maintenant, true);
  if (e.phase === 'assurance') finSiAssuranceComplete(e, secret, maintenant);
  if (e.phase === 'mises' && !e.sieges.some((x) => x)) e.echeance = null;
}

/** Mise avant la donne (avec ses paris annexes). Renvoie le total à débiter. */
export function miser(e: EtatBJ, joueur: string, mise: number, annexes: { paires?: number; vingtEtUn?: number }, secret: SecretBJ, maintenant: number, seul = false): number {
  if (e.phase !== 'mises') throw new ErreurBJ('Attends la prochaine donne pour miser.');
  const s = e.sieges.find((x) => x?.joueur === joueur);
  if (!s) throw new ErreurBJ('Assieds-toi d’abord à la table.');
  if (s.mise > 0) throw new ErreurBJ('Ta mise est déjà posée.');
  const max = miseMax(s.niveau);
  if (!Number.isInteger(mise) || mise < MISE_MIN_BJ) throw new ErreurBJ(`La mise minimale est de ${MISE_MIN_BJ} Louidors.`);
  if (mise > max) throw new ErreurBJ(`À ton niveau, tu peux miser jusqu’à ${max} Louidors.`);
  const paires = Math.max(0, Math.floor(annexes.paires ?? 0)), vingtEtUn = Math.max(0, Math.floor(annexes.vingtEtUn ?? 0));
  if (paires > mise || vingtEtUn > mise) throw new ErreurBJ('Un pari annexe ne peut pas dépasser ta mise principale.');
  s.mise = mise;
  s.annexes = { paires, vingtEtUn };
  s.absences = 0;
  const assis = e.sieges.filter((x): x is SiegeBJ => x !== null);
  if (seul || assis.every((x) => x.mise > 0)) distribuer(e, secret, maintenant);
  else if (e.echeance === null) e.echeance = maintenant + DELAI_MISES;
  return mise + paires + vingtEtUn;
}

/** Distribue deux cartes à chaque joueur qui a misé et au croupier (dont une cachée), une à une. */
export function distribuer(e: EtatBJ, secret: SecretBJ, maintenant: number): void {
  // Ceux qui n'ont pas misé passent leur tour ; deux tours sans miser et ils quittent la table.
  e.sieges = e.sieges.map((s) => {
    if (!s || s.mise > 0) return s;
    return s.absences + 1 >= 2 ? null : { ...s, absences: s.absences + 1, mains: [] };
  });
  const joueurs = e.sieges.map((s, i) => (s && s.mise > 0 ? i : -1)).filter((i) => i >= 0);
  if (joueurs.length === 0) { e.echeance = null; return; }
  e.manche += 1;
  for (const i of joueurs) { const s = e.sieges[i]!; s.mains = [{ cartes: [], mise: s.mise, etat: 'joue' }]; s.active = 0; s.assurance = null; s.resultatsAnnexes = []; }
  e.croupier = { cartes: [], cachee: true };
  for (let tour = 0; tour < 2; tour++) {
    for (const i of joueurs) e.sieges[i]!.mains[0].cartes.push(tirer(secret));
    if (tour === 0) e.croupier.cartes.push(tirer(secret)); else secret.cachee = tirer(secret);
  }
  e.donneA = maintenant;
  e.ordre = joueurs;
  const visible = e.croupier.cartes[0];
  for (const i of joueurs) {
    const s = e.sieges[i]!, m = s.mains[0];
    if (estBlackjack(m.cartes)) m.etat = 'blackjack';
    // Les paris annexes se règlent dès la donne.
    if (s.annexes.paires > 0) { const r = evaluerPaires(m.cartes); s.resultatsAnnexes!.push({ pari: 'paires', nom: r?.nom ?? 'Pas de paire', mise: s.annexes.paires, gain: r ? s.annexes.paires * (r.multiple + 1) : 0 }); }
    if (s.annexes.vingtEtUn > 0) { const r = evaluer213([...m.cartes, visible]); s.resultatsAnnexes!.push({ pari: '21+3', nom: r?.nom ?? 'Rien', mise: s.annexes.vingtEtUn, gain: r ? s.annexes.vingtEtUn * (r.multiple + 1) : 0 }); }
  }
  const finDonne = maintenant + dureeDonne(joueurs.length);
  e.tour = null;
  if (rangDe(visible) === 'A') { e.phase = 'assurance'; e.echeance = finDonne + DELAI_ASSURANCE; return; }
  regarderSousLaCarte(e, secret, finDonne);
}

/** Le croupier regarde sa carte cachée (As ou figure visible) : s'il a blackjack, la donne s'arrête. */
function regarderSousLaCarte(e: EtatBJ, secret: SecretBJ, depart: number): void {
  const visible = e.croupier.cartes[0];
  if (secret.cachee && valeurCarte(visible) >= 10 && estBlackjack([visible, secret.cachee])) { jouerCroupier(e, secret, depart, true); return; }
  // Pas de blackjack : les assurances sont perdues, on joue.
  for (const s of e.sieges) if (s && s.assurance && s.mains.length) s.resultatsAnnexes!.push({ pari: 'assurance', nom: 'Assurance perdue', mise: s.assurance, gain: 0 });
  e.phase = 'jeu';
  e.tour = null;
  passerAuSuivant(e, secret, depart, false);
}

/** Pendant la fenêtre d'assurance (le croupier montre un As). Renvoie le montant à débiter. */
export function assurer(e: EtatBJ, joueur: string, prendre: boolean, secret: SecretBJ, maintenant: number): number {
  if (e.phase !== 'assurance') throw new ErreurBJ('L’assurance n’est proposée que quand le croupier montre un As.');
  const s = e.sieges.find((x) => x?.joueur === joueur);
  if (!s || !s.mains.length) throw new ErreurBJ('Tu ne joues pas cette donne.');
  if (s.assurance !== null) throw new ErreurBJ('Tu as déjà répondu.');
  const prix = prendre ? Math.max(1, Math.floor(s.mise / 2)) : 0;
  s.assurance = prix;
  finSiAssuranceComplete(e, secret, maintenant);
  return prix;
}

function finSiAssuranceComplete(e: EtatBJ, secret: SecretBJ, maintenant: number): void {
  if (e.phase !== 'assurance') return;
  if (e.sieges.every((s) => !s || !s.mains.length || s.assurance !== null)) finAssurance(e, secret, maintenant);
}
function finAssurance(e: EtatBJ, secret: SecretBJ, maintenant: number): void {
  for (const s of e.sieges) if (s && s.mains.length && s.assurance === null) s.assurance = 0;
  regarderSousLaCarte(e, secret, Math.max(maintenant, (e.donneA ?? 0) + dureeDonne(e.ordre?.length ?? 1)));
}

/** Passe à la main suivante (même joueur après une séparation), puis au joueur suivant, puis au croupier. */
function passerAuSuivant(e: EtatBJ, secret: SecretBJ, maintenant: number, siegeSuivant: boolean): void {
  if (e.tour !== null && !siegeSuivant) {
    const s = e.sieges[e.tour];
    if (s) {
      const k = s.mains.findIndex((m, idx) => idx > s.active && m.etat === 'joue');
      if (k >= 0) { s.active = k; e.echeance = maintenant + DELAI_TOUR; return; }
    }
  }
  const depart = e.tour === null ? 0 : e.tour + 1;
  for (let i = depart; i < SIEGES_BJ; i++) {
    const s = e.sieges[i];
    const k = s ? s.mains.findIndex((m) => m.etat === 'joue') : -1;
    if (s && k >= 0) { e.tour = i; s.active = k; e.echeance = maintenant + DELAI_TOUR; return; }
  }
  jouerCroupier(e, secret, maintenant, false);
}

export type CoupBJ = 'tirer' | 'rester' | 'doubler' | 'separer';

/** Ce que coûte un coup (doubler, séparer) avant de le jouer. */
export function coutDuCoup(e: EtatBJ, joueur: string, coup: CoupBJ): number {
  if (e.phase !== 'jeu' || e.tour === null) return 0;
  const s = e.sieges[e.tour];
  if (!s || s.joueur !== joueur) return 0;
  return coup === 'doubler' || coup === 'separer' ? s.mains[s.active]?.mise ?? 0 : 0;
}

export function peutSeparer(s: SiegeBJ): boolean {
  const m = s.mains[s.active];
  return s.mains.length === 1 && !!m && m.etat === 'joue' && m.cartes.length === 2 && valeurCarte(m.cartes[0]) === valeurCarte(m.cartes[1]);
}
export function peutDoubler(s: SiegeBJ): boolean {
  const m = s.mains[s.active];
  return !!m && m.etat === 'joue' && m.cartes.length === 2;
}

/** Tirer, rester, doubler ou séparer. */
export function agir(e: EtatBJ, joueur: string, coup: CoupBJ, secret: SecretBJ, maintenant: number): void {
  if (e.phase !== 'jeu' || e.tour === null) throw new ErreurBJ('Ce n’est pas le moment de jouer.');
  const s = e.sieges[e.tour];
  if (!s || s.joueur !== joueur) throw new ErreurBJ('Ce n’est pas ton tour.');
  const m = s.mains[s.active];
  if (!m || m.etat !== 'joue') throw new ErreurBJ('Cette main est terminée.');
  if (coup === 'tirer') {
    m.cartes.push(tirer(secret));
    const v = valeurMain(m.cartes).total;
    if (v > 21) m.etat = 'saute';
    else if (v === 21) m.etat = 'reste';
    else { e.echeance = maintenant + DELAI_TOUR; return; }
  } else if (coup === 'doubler') {
    if (!peutDoubler(s)) throw new ErreurBJ('On ne double qu’avec ses deux premières cartes.');
    m.mise *= 2;
    m.cartes.push(tirer(secret));
    m.etat = valeurMain(m.cartes).total > 21 ? 'saute' : 'double';
  } else if (coup === 'separer') {
    if (!peutSeparer(s)) throw new ErreurBJ('On ne sépare qu’une paire, une seule fois par donne.');
    const as = rangDe(m.cartes[0]) === 'A';
    const a: MainBJ = { cartes: [m.cartes[0], tirer(secret)], mise: m.mise, etat: 'joue', separee: true };
    const b: MainBJ = { cartes: [m.cartes[1], tirer(secret)], mise: m.mise, etat: 'joue', separee: true };
    for (const x of [a, b]) if (as || valeurMain(x.cartes).total === 21) x.etat = 'reste'; // As séparés : une carte chacun
    s.mains = [a, b];
    s.active = 0;
    if (a.etat === 'joue') { e.echeance = maintenant + DELAI_TOUR; return; }
  } else m.etat = 'reste';
  passerAuSuivant(e, secret, maintenant, false);
}

/** Le temps est écoulé : mises closes, joueur qui reste, assurance refusée, ou nouvelle donne. */
export function delaiEcoule(e: EtatBJ, secret: SecretBJ, maintenant: number): boolean {
  if (e.echeance === null || maintenant < e.echeance) return false;
  if (e.phase === 'mises') { e.echeance = null; distribuer(e, secret, maintenant); return true; }
  if (e.phase === 'assurance') { finAssurance(e, secret, maintenant); return true; }
  if (e.phase === 'jeu' && e.tour !== null) {
    const s = e.sieges[e.tour];
    if (s) for (const m of s.mains) if (m.etat === 'joue') m.etat = 'reste';
    passerAuSuivant(e, secret, maintenant, true);
    return true;
  }
  if (e.phase === 'resultats') { nouvelleDonne(e); return true; }
  return false;
}

/** Le croupier retourne sa carte et tire jusqu'à 17, puis on règle chaque main. */
function jouerCroupier(e: EtatBJ, secret: SecretBJ, maintenant: number, blackjackCroupier: boolean): void {
  e.tour = null;
  if (secret.cachee) e.croupier.cartes.push(secret.cachee);
  secret.cachee = null;
  e.croupier.cachee = false;
  const enJeu = e.sieges.some((s) => s?.mains.some((m) => m.etat === 'reste' || m.etat === 'double'));
  if (enJeu && !blackjackCroupier) while (valeurMain(e.croupier.cartes).total < 17) e.croupier.cartes.push(tirer(secret));
  const croupier = valeurMain(e.croupier.cartes).total;
  const bjCroupier = estBlackjack(e.croupier.cartes);
  for (const s of e.sieges) {
    if (!s || !s.mains.length) continue;
    let mises = s.annexes.paires + s.annexes.vingtEtUn + (s.assurance ?? 0), recu = 0;
    if (s.assurance && bjCroupier) s.resultatsAnnexes!.push({ pari: 'assurance', nom: 'Assurance payée', mise: s.assurance, gain: s.assurance * 3 });
    for (const m of s.mains) {
      const v = valeurMain(m.cartes).total;
      if (m.etat === 'blackjack') { m.resultat = bjCroupier ? 'egalite' : 'blackjack'; m.gain = bjCroupier ? m.mise : Math.floor(m.mise * 2.5); }
      else if (m.etat === 'saute' || bjCroupier) { m.resultat = 'perdu'; m.gain = 0; }
      else if (croupier > 21 || v > croupier) { m.resultat = 'gagne'; m.gain = m.mise * 2; }
      else if (v === croupier) { m.resultat = 'egalite'; m.gain = m.mise; }
      else { m.resultat = 'perdu'; m.gain = 0; }
      mises += m.mise; recu += m.gain;
    }
    recu += (s.resultatsAnnexes ?? []).reduce((t, r) => t + r.gain, 0);
    s.dernierGain = recu - mises;
  }
  e.phase = 'resultats';
  e.revelationA = maintenant + DELAI_CARTE_CROUPIER * Math.max(1, e.croupier.cartes.length - 1);
  e.echeance = e.revelationA + DELAI_RESULTATS;
}

/** Tout ce qu'il faut verser à la fin de la donne (mises rendues comprises), par joueur. */
export function gains(e: EtatBJ): Array<{ joueur: string; montant: number }> {
  const out: Array<{ joueur: string; montant: number }> = [];
  for (const s of e.sieges) {
    if (!s || !s.mains.length) continue;
    const montant = s.mains.reduce((t, m) => t + (m.gain ?? 0), 0) + (s.resultatsAnnexes ?? []).reduce((t, r) => t + r.gain, 0);
    if (montant > 0) out.push({ joueur: s.joueur, montant });
  }
  return out;
}

/** Prépare la donne suivante : on garde les joueurs assis, on efface les mains. */
export function nouvelleDonne(e: EtatBJ): void {
  e.phase = 'mises';
  e.echeance = null;
  e.tour = null;
  e.revelationA = undefined;
  e.donneA = undefined;
  e.ordre = undefined;
  e.croupier = { cartes: [], cachee: false };
  e.sieges = e.sieges.map((s) => (s ? { ...s, mise: 0, annexes: { paires: 0, vingtEtUn: 0 }, assurance: null, mains: [], active: 0, resultatsAnnexes: [] } : null));
}
