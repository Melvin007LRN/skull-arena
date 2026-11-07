// Sons du jeu : synthétisés en direct (aucun fichier à télécharger), dans une ambiance de taverne de navire.
// Harpe (cordes pincées), cartes en papier, bois, cloche de bord, tambour, vagues… et une réverbération douce.
// Le mode silencieux de l'iPhone les coupe.
let ctx: AudioContext | null = null;
let bus: GainNode | null = null; // tout passe par ici : compression + réverbération

/** Sur iPhone, le son ne peut démarrer qu'après un premier toucher : on prépare le contexte à ce moment-là. */
export function debloquerSon() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume?.()?.catch(() => {}); return; }
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
    construireBus(ctx);
  } catch {
    ctx = null;
  }
}

function construireBus(c: AudioContext) {
  const comp = c.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  const sortie = c.createGain(); sortie.gain.value = 0.9;
  comp.connect(sortie).connect(c.destination);
  bus = c.createGain();
  bus.connect(comp);
  // Réverbération : une petite cale de navire en bois
  const duree = 2.2, n = Math.floor(c.sampleRate * duree);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2);
  }
  const rev = c.createConvolver(); rev.buffer = ir;
  const humide = c.createGain(); humide.gain.value = 0.28;
  const filtre = c.createBiquadFilter(); filtre.type = 'lowpass'; filtre.frequency.value = 4200;
  bus.connect(filtre).connect(rev).connect(humide).connect(comp);
}

const maintenant = (debut = 0) => (ctx ? ctx.currentTime + debut : 0);

/** Enveloppe douce sur un gain (attaque, puis extinction). */
function enveloppe(g: GainNode, t: number, vol: number, attaque: number, duree: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(vol, 0.0002), t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
}

// ---------- Harpe : corde pincée (algorithme de Karplus-Strong), notes gardées en mémoire ----------
const cordes = new Map<number, AudioBuffer>();
function corde(freq: number): AudioBuffer | null {
  if (!ctx) return null;
  const cle = Math.round(freq * 10);
  const deja = cordes.get(cle);
  if (deja) return deja;
  const sr = ctx.sampleRate, duree = freq < 150 ? 3.2 : 2.4, n = Math.floor(sr * duree);
  const buf = ctx.createBuffer(1, n, sr);
  const d = buf.getChannelData(0);
  const p = Math.max(2, Math.round(sr / freq - 0.5)); // la moyenne de deux échantillons ajoute un demi-pas
  // pincement doux : bruit adouci (doigt sur la corde plutôt qu'onglet)
  let prec = 0;
  for (let i = 0; i < p; i++) { const x = Math.random() * 2 - 1; prec = prec * 0.55 + x * 0.45; d[i] = prec; }
  const amorti = freq < 200 ? 0.9985 : freq < 500 ? 0.9975 : 0.996;
  for (let i = p; i < n; i++) d[i] = amorti * 0.5 * (d[i - p] + d[i - p + 1]);
  // petite montée pour éviter le clic, normalisation
  let max = 0;
  for (let i = 0; i < n; i++) max = Math.max(max, Math.abs(d[i]));
  for (let i = 0; i < n; i++) d[i] = (d[i] / (max || 1)) * (i < 40 ? i / 40 : 1);
  cordes.set(cle, buf);
  return buf;
}

function harpe(freq: number, debut = 0, vol = 0.22, sortie?: AudioNode) {
  if (!ctx || !bus) return;
  const b = corde(freq); if (!b) return;
  const t = maintenant(debut);
  const s = ctx.createBufferSource(); s.buffer = b;
  const g = ctx.createGain(); g.gain.value = vol;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(9000, freq * 9);
  s.connect(f).connect(g).connect(sortie ?? bus);
  s.start(t);
}
/** Accord arpégé (comme une main qui glisse sur la harpe). */
function arpege(freqs: number[], debut = 0, ecart = 0.06, vol = 0.18, sortie?: AudioNode) {
  freqs.forEach((f, i) => harpe(f, debut + i * ecart, vol * (1 - i * 0.05), sortie));
}

// ---------- Percussions et bruitages naturels ----------
let bruitBlanc: AudioBuffer | null = null;
function bruitSource(duree: number): AudioBufferSourceNode | null {
  if (!ctx) return null;
  if (!bruitBlanc) {
    const n = ctx.sampleRate * 3;
    bruitBlanc = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = bruitBlanc.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  const s = ctx.createBufferSource(); s.buffer = bruitBlanc;
  s.loop = true; // départ au hasard dans le bruit : on boucle pour ne jamais tomber à court
  return s;
}
/** Bruit filtré (papier, eau, vent, souffle). */
function souffle(debut: number, duree: number, vol: number, type: BiquadFilterType, freq: number, q = 0.7, attaque = 0.005, versFreq?: number) {
  if (!ctx || !bus) return;
  const s = bruitSource(duree); if (!s) return;
  const t = maintenant(debut);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (versFreq) f.frequency.exponentialRampToValueAtTime(versFreq, t + duree);
  const g = ctx.createGain(); enveloppe(g, t, vol, attaque, duree);
  s.connect(f).connect(g).connect(bus);
  s.start(t, Math.random() * 2.5); s.stop(t + duree + 0.05);
}
/** Ton qui descend (coup sourd : tambour, bois, impact). */
function coup(de: number, a: number, debut: number, duree: number, vol: number, type: OscillatorType = 'sine') {
  if (!ctx || !bus) return;
  const t = maintenant(debut);
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(de, t); o.frequency.exponentialRampToValueAtTime(a, t + duree * 0.8);
  const g = ctx.createGain(); enveloppe(g, t, vol, 0.004, duree);
  o.connect(g).connect(bus); o.start(t); o.stop(t + duree + 0.05);
}
/** Cloche de bord : partiels inharmoniques qui résonnent longtemps. */
function cloche(freq: number, debut = 0, vol = 0.12, duree = 2.6) {
  if (!ctx || !bus) return;
  const t = maintenant(debut);
  [[1, 1], [2.0, 0.55], [2.76, 0.4], [5.4, 0.2], [8.9, 0.08]].forEach(([r, v]) => {
    const o = ctx!.createOscillator(); o.type = 'sine'; o.frequency.value = freq * r;
    const g = ctx!.createGain(); enveloppe(g, t, vol * v, 0.003, duree / Math.sqrt(r));
    o.connect(g).connect(bus!); o.start(t); o.stop(t + duree);
  });
}
/** Tambour de bord (grosse caisse feutrée). */
const tambour = (debut = 0, vol = 0.32) => { coup(110, 48, debut, 0.55, vol); souffle(debut, 0.08, vol * 0.25, 'lowpass', 900); };
/** Coup de bois (planche, bloc de bois). */
const bois = (debut = 0, vol = 0.3, f = 520) => { coup(f, f * 0.7, debut, 0.09, vol, 'triangle'); souffle(debut, 0.03, vol * 0.5, 'bandpass', f * 3, 2); };
/** Une carte qui glisse et se pose (papier sur le bois). */
function carteGlisse(debut = 0, vol = 1) {
  const v = 0.85 + Math.random() * 0.3;
  souffle(debut, 0.08 * v, 0.42 * vol, 'bandpass', 2600 * v, 0.9, 0.004, 1500);
  souffle(debut + 0.05, 0.06, 0.3 * vol, 'lowpass', 1400);
  coup(170 * v, 110, debut + 0.055, 0.07, 0.16 * vol);
}
/** Pièces d'or qui tintent. */
function tintement(debut = 0, vol = 0.12) {
  const f = 2200 + Math.random() * 900;
  [[1, 1], [2.7, 0.5], [4.1, 0.25]].forEach(([r, v]) => {
    if (!ctx || !bus) return;
    const t = maintenant(debut);
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f * r;
    const g = ctx.createGain(); enveloppe(g, t, vol * v, 0.002, 0.35 / r);
    o.connect(g).connect(bus); o.start(t); o.stop(t + 0.4);
  });
}
/** Vague qui roule. */
const vague = (debut = 0, vol = 0.12, duree = 2.4) => souffle(debut, duree, vol, 'lowpass', 300, 0.5, duree * 0.4, 900);

// Gammes (ré mineur, la couleur des chants de marins)
const H: Record<string, number> = {
  A1: 55, D2: 73.4, F2: 87.3, G2: 98, A2: 110, C3: 130.8, D3: 146.8, E3: 164.8, F3: 174.6, G3: 196, A3: 220, Bb3: 233.1, C4: 261.6,
  D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, Bb4: 466.2, C5: 523.3, D5: 587.3, E5: 659.3, F5: 698.5, A5: 880, D6: 1174.7,
};
const accord = (...n: string[]) => n.map((x) => H[x]);

/** Bandes-son des grandes bêtes (4 s) : profondeurs, vagues, harpe inquiétante. */
export const sonBete = {
  kraken: () => {
    tambour(0, 0.4); tambour(0.9, 0.45); vague(0, 0.16, 3.6);
    coup(70, 34, 0.85, 2.6, 0.22, 'sine'); coup(52, 30, 0.9, 2.8, 0.16, 'triangle');
    arpege(accord('D2', 'A2', 'D3', 'F3', 'Bb3'), 1.0, 0.12, 0.22); harpe(H.A3, 2.4, 0.16); harpe(H.D3, 2.9, 0.2);
  },
  baleine: () => {
    vague(0, 0.2, 3.8); souffle(0.8, 1.6, 0.14, 'bandpass', 1200, 0.6, 0.05, 400); // le jaillissement
    coup(150, 90, 0.85, 2.4, 0.12, 'sine'); coup(220, 140, 1.4, 2, 0.06, 'sine'); // chant de la baleine
    tambour(0.9, 0.3); arpege(accord('D3', 'A3', 'D4', 'F4', 'A4'), 1.1, 0.1, 0.18); harpe(H.E4, 2.4, 0.14);
  },
  raie: () => {
    souffle(0, 2.6, 0.08, 'bandpass', 600, 0.8, 0.6, 2400); vague(0.4, 0.12, 3);
    arpege(accord('A3', 'D4', 'F4', 'A4', 'D5', 'F5'), 0.6, 0.09, 0.15); harpe(H.E5, 1.6, 0.1); harpe(H.D5, 2.1, 0.12); harpe(H.A4, 2.6, 0.12);
  },
};

export const son = {
  /** Carte posée sur la table */
  carte: () => carteGlisse(0, 1.1),
  /** Distribution : une carte par battement, lentement (plus de cartes = plus long) */
  distribuer: (nb: number, intervalle: number) => {
    debloquerSon();
    for (let k = 0; k < Math.min(nb, 90); k++) carteGlisse(0.05 + k * intervalle, 0.75);
  },
  /** Pli gagné : les cartes ramassées et deux notes de harpe */
  pli: () => { souffle(0, 0.22, 0.25, 'bandpass', 2200, 0.7, 0.02, 900); harpe(H.D4, 0.1, 0.16); harpe(H.A4, 0.2, 0.14); },
  /** À moi de jouer : la cloche de bord */
  tour: () => { cloche(880, 0, 0.07, 1.8); harpe(H.D5, 0.02, 0.08); },
  /** Le Skull King l'emporte */
  skull: () => { tambour(0, 0.4); arpege(accord('D2', 'A2', 'D3', 'F3', 'A3'), 0.05, 0.05, 0.22); },
  kraken: () => { tambour(0, 0.35); vague(0, 0.12, 1.4); },
  baleine: () => { vague(0, 0.14, 1.6); harpe(H.A3, 0.1, 0.14); },
  /** 3, 2, 1 : coup de bois */
  decompte: () => bois(0, 0.32, 480),
  /** « À l'abordage ! » : tambour, cloche et accord de harpe */
  abordage: () => { tambour(0, 0.3); cloche(660, 0.02, 0.08, 2); arpege(accord('D3', 'A3', 'D4', 'F4', 'A4', 'D5'), 0.04, 0.045, 0.16); },
  /** Victoire : grand arpège montant, cloche et tambours */
  fanfare: () => {
    tambour(0, 0.32); tambour(0.45, 0.32); tambour(0.9, 0.4);
    arpege(accord('D3', 'F3', 'A3', 'D4', 'F4', 'A4', 'D5', 'F5', 'A5'), 0.05, 0.08, 0.2);
    arpege(accord('C3', 'G3', 'C4', 'E4', 'G4', 'C5'), 0.95, 0.06, 0.16);
    arpege(accord('D3', 'A3', 'D4', 'F4', 'A4', 'D5', 'D6'), 1.5, 0.05, 0.2);
    cloche(587, 1.5, 0.1, 3); [1.6, 1.75, 1.9, 2.1].forEach((t) => tintement(t, 0.05));
  },
  /** Coup de tonnerre (manche 10, tempête) : grondement qui roule */
  tonnerre: () => { souffle(0, 0.25, 0.25, 'lowpass', 2500, 0.5, 0.005, 400); souffle(0.1, 2.6, 0.3, 'lowpass', 260, 0.6, 0.4, 70); coup(60, 35, 0.05, 2, 0.12); },
  /** Grand coup */
  exploit: () => { tambour(0, 0.3); arpege(accord('D4', 'F4', 'A4', 'D5'), 0.05, 0.06, 0.16); },
  /** Objet qui atterrit sur un joueur : petit coup sourd */
  impact: () => { coup(220, 90, 0, 0.2, 0.3); souffle(0, 0.12, 0.22, 'lowpass', 1600); },
  /** Régicide : la Sirène terrasse le roi */
  regicide: () => { tambour(0, 0.35); arpege(accord('A3', 'D4', 'F4', 'A4', 'D5', 'F5', 'A5'), 0.05, 0.07, 0.18); cloche(880, 0.5, 0.06, 2.4); },
  /** Le roi frappe */
  roiFrappe: () => { tambour(0, 0.42); tambour(0.22, 0.32); arpege(accord('D2', 'A2', 'D3', 'F3', 'A3', 'D4'), 0.3, 0.05, 0.2); },
  /** Abordage (pirate qui capture) : tambours et accord vif */
  abordageFort: () => { tambour(0, 0.32); tambour(0.15, 0.28); souffle(0.02, 0.2, 0.08, 'highpass', 3000); arpege(accord('D3', 'F3', 'A3', 'D4', 'F4'), 0.2, 0.04, 0.18); },
  krakenFort: () => { tambour(0, 0.4); vague(0, 0.14, 1.8); arpege(accord('D2', 'A2', 'D3', 'F3'), 0.2, 0.1, 0.2); },
  baleineForte: () => { vague(0, 0.16, 1.8); coup(150, 95, 0.2, 1.4, 0.1); harpe(H.D4, 0.3, 0.14); harpe(H.A4, 0.45, 0.12); },
  /** Pièces d'or */
  piece: () => { tintement(0); tintement(0.06, 0.09); },
};

// ---------- Musique : chant de marins à la harpe (domaine public), avec le ressac en fond ----------
const CLE_MUSIQUE = 'skull-musique';
// « What shall we do with a drunken sailor » (ré dorien) : [note, temps]
const CHANT: [string, number][] = [
  ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['D4', 1], ['F4', 1], ['A4', 1],
  ['G4', 1], ['G4', .5], ['G4', .5], ['G4', 1], ['G4', .5], ['G4', .5], ['G4', 1], ['C4', 1], ['E4', 1], ['G4', 1],
  ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['Bb4', 1], ['C5', 1], ['D5', 1],
  ['C5', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['D4', 2], ['D4', 2],
];
// Accords par mesure de 4 temps
const GRILLE: string[][] = [
  ['D2', 'A2', 'D3', 'F3', 'A3'], ['D2', 'A2', 'D3', 'F3', 'A3'], ['C3', 'G3', 'C4', 'E4'], ['C3', 'G3', 'C4', 'E4'],
  ['D2', 'A2', 'D3', 'F3', 'A3'], ['F2', 'C3', 'F3', 'A3'], ['C3', 'G3', 'C4', 'E4'], ['D2', 'A2', 'D3', 'F3', 'A3'], ['D2', 'A2', 'D3', 'F3', 'A3'],
];
let boucle = 0;
let maitre: GainNode | null = null;
let ressac: { arreter: () => void } | null = null;
let tempete = false;
let couplet = 0;

function jouerBoucle() {
  if (!ctx || !maitre) return;
  // Couplet 1 : lent et rêveur · couplet 2 : un peu plus entraînant. Tempête : plus rapide et plus grave.
  const lent = couplet % 2 === 0;
  const TEMPS = tempete ? 0.3 : lent ? 0.5 : 0.4;
  const oct = tempete ? 0.5 : 1;
  let t = 0.1;
  for (const [n, d] of CHANT) {
    harpe(H[n] * oct * (lent ? 1 : 2), t, lent ? 0.42 : 0.34, maitre);
    if (!lent && d >= 1) harpe(H[n] * oct, t, 0.2, maitre); // doublé à l'octave
    t += d * TEMPS;
  }
  // Accompagnement : accords arpégés, une mesure = 4 temps
  GRILLE.forEach((a, m) => {
    const notes = a.map((x) => H[x] * oct);
    const debut = 0.1 + m * 4 * TEMPS;
    if (lent) {
      notes.forEach((f, i) => harpe(f, debut + i * TEMPS * 0.5, 0.2 - i * 0.02, maitre!));
      notes.slice(1).reverse().forEach((f, i) => harpe(f, debut + (notes.length + i) * TEMPS * 0.5, 0.12, maitre!));
    } else {
      harpe(notes[0], debut, 0.3, maitre!); arpege(notes.slice(1), debut + TEMPS, 0.03, 0.16, maitre!);
      harpe(notes[1], debut + 2 * TEMPS, 0.22, maitre!); arpege(notes.slice(1), debut + 3 * TEMPS, 0.03, 0.14, maitre!);
    }
  });
  couplet++;
  boucle = window.setTimeout(jouerBoucle, (t + 2 * TEMPS) * 1000);
}

/** Le ressac : des vagues douces qui vont et viennent. */
function demarrerRessac(): { arreter: () => void } | null {
  if (!ctx || !bus) return null;
  const s = bruitSource(4); if (!s) return null;
  s.loop = true;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420;
  const g = ctx.createGain(); g.gain.value = 0.0001;
  const lfo = ctx.createOscillator(); lfo.frequency.value = 0.11;
  const lg = ctx.createGain(); lg.gain.value = 0.035;
  const base = ctx.createConstantSource(); base.offset.value = 0.045;
  lfo.connect(lg).connect(g.gain); base.connect(g.gain);
  s.connect(f).connect(g).connect(bus);
  s.start(); lfo.start(); base.start();
  return {
    arreter: () => {
      if (!ctx) return;
      g.gain.cancelScheduledValues(ctx.currentTime);
      base.offset.setTargetAtTime(0, ctx.currentTime, 0.3); lg.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      setTimeout(() => { try { s.stop(); lfo.stop(); base.stop(); } catch { /* déjà arrêté */ } }, 1500);
    },
  };
}

export const musique = {
  // Activée par défaut : on peut la couper dans les réglages
  active(): boolean { try { return localStorage.getItem(CLE_MUSIQUE) !== '0'; } catch { return true; } },
  demarrer() {
    debloquerSon();
    if (!ctx || !bus || maitre) return;
    ctx.resume?.()?.catch(() => {});
    maitre = ctx.createGain();
    maitre.gain.value = 0.0001;
    maitre.gain.setTargetAtTime(0.32, ctx.currentTime, 1.2); // entrée en fondu
    maitre.connect(bus);
    couplet = 0;
    jouerBoucle();
    ressac = demarrerRessac();
  },
  arreter() {
    clearTimeout(boucle);
    if (maitre && ctx) {
      const g = maitre;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.3);
      setTimeout(() => g.disconnect(), 1500);
    }
    ressac?.arreter(); ressac = null;
    maitre = null;
  },
  tempete(v: boolean) { tempete = v; },
  basculer(): boolean {
    const v = !musique.active();
    try { localStorage.setItem(CLE_MUSIQUE, v ? '1' : '0'); } catch { /* stockage indisponible */ }
    if (v) musique.demarrer(); else musique.arreter();
    return v;
  },
};

const CLE_VIBRATIONS = 'skull-vibrations';
export const vibrations = {
  actives(): boolean { try { return localStorage.getItem(CLE_VIBRATIONS) !== '0'; } catch { return true; } },
  regler(v: boolean) { try { localStorage.setItem(CLE_VIBRATIONS, v ? '1' : '0'); } catch { /* stockage indisponible */ } },
};

export function vibrer(ms = 60) {
  if (!vibrations.actives()) return;
  try { navigator.vibrate?.(ms); } catch { /* non disponible (iPhone) */ }
}

