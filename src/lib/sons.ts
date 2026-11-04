// Petits sons synthétisés (aucun fichier à télécharger). Le mode silencieux du téléphone les coupe.
let ctx: AudioContext | null = null;

/** Sur iPhone, le son ne peut démarrer qu'après un premier toucher : on prépare le contexte à ce moment-là. */
export function debloquerSon() {
  if (ctx) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = new AC();
  } catch {
    ctx = null;
  }
}

function note(freq: number, debut: number, duree: number, volume = 0.12, type: OscillatorType = 'sine', sortie?: AudioNode) {
  if (!ctx) return;
  const t = ctx.currentTime + debut;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(gain).connect(sortie ?? ctx.destination);
  osc.start(t);
  osc.stop(t + duree + 0.02);
}

function bruit(duree: number, volume = 0.18) {
  if (!ctx) return;
  const n = Math.floor(ctx.sampleRate * duree);
  const buffer = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  const src = ctx.createBufferSource();
  const filtre = ctx.createBiquadFilter();
  filtre.type = 'bandpass';
  filtre.frequency.value = 1800;
  const gain = ctx.createGain();
  gain.gain.value = volume;
  src.buffer = buffer;
  src.connect(filtre).connect(gain).connect(ctx.destination);
  src.start();
}

export const son = {
  carte: () => bruit(0.09),
  pli: () => { note(660, 0, 0.18); note(880, 0.09, 0.25); },
  tour: () => { note(523, 0, 0.12, 0.08, 'triangle'); note(784, 0.1, 0.2, 0.08, 'triangle'); },
  skull: () => { note(110, 0, 0.6, 0.18, 'sawtooth'); note(82, 0.05, 0.7, 0.14, 'sawtooth'); },
  kraken: () => { note(70, 0, 0.9, 0.2, 'square'); bruit(0.5, 0.1); },
  baleine: () => { note(196, 0, 0.8, 0.12); note(147, 0.2, 0.9, 0.12); },
  decompte: () => note(440, 0, 0.15, 0.1, 'triangle'),
  abordage: () => { note(392, 0, 0.15); note(523, 0.12, 0.15); note(659, 0.24, 0.35); },
  /** Fanfare de victoire */
  fanfare: () => {
    const m: [number, number, number][] = [[392, 0, 0.14], [392, 0.15, 0.14], [392, 0.3, 0.14], [523, 0.45, 0.5], [466, 0.95, 0.16], [523, 1.12, 0.16], [659, 1.3, 0.25], [784, 1.55, 0.9]];
    for (const [f, t, d] of m) { note(f, t, d, 0.11, 'triangle'); note(f / 2, t, d, 0.05, 'square'); }
    note(1047, 1.55, 0.9, 0.05, 'sine');
  },
  /** Petit tintement de pièce */
  piece: () => { note(1568, 0, 0.08, 0.05, 'triangle'); note(2093, 0.05, 0.12, 0.04, 'triangle'); },
};

// ---------- Musique d'ambiance : un chant de marins (domaine public), joué doucement en boucle ----------
const CLE_MUSIQUE = 'skull-musique';
const N: Record<string, number> = { C3: 131, D3: 147, E3: 165, F3: 175, G3: 196, A3: 220, B3: 247, C4: 262, D4: 294, E4: 330, F4: 349, G4: 392, A4: 440, B4: 494, C5: 523, D5: 587 };
// [note, temps] : « What shall we do with a drunken sailor »
const MELODIE: [string, number][] = [
  ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['D4', 1], ['F4', 1], ['A4', 1],
  ['G4', 1], ['G4', .5], ['G4', .5], ['G4', 1], ['G4', .5], ['G4', .5], ['G4', 1], ['C4', 1], ['E4', 1], ['G4', 1],
  ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['A4', .5], ['A4', .5], ['A4', 1], ['B4', 1], ['C5', 1], ['D5', 1],
  ['C5', 1], ['A4', 1], ['G4', 1], ['E4', 1], ['D4', 2], ['D4', 2],
];
const BASSE = ['D3', 'A3', 'D3', 'A3', 'C3', 'G3', 'C3', 'G3', 'D3', 'A3', 'D3', 'A3', 'C3', 'G3', 'D3', 'D3'];
const TEMPS = 0.36;
let boucle = 0;
let maitre: GainNode | null = null;

function jouerBoucle() {
  if (!ctx || !maitre) return;
  let t = 0.05;
  for (const [n, d] of MELODIE) { note(N[n], t, d * TEMPS * 0.9, 0.5, 'triangle', maitre); t += d * TEMPS; }
  BASSE.forEach((n, i) => note(N[n], 0.05 + i * 2 * TEMPS, 1.6 * TEMPS, 0.35, 'sine', maitre!));
  boucle = window.setTimeout(jouerBoucle, (t + 2 * TEMPS) * 1000);
}

export const musique = {
  active(): boolean { try { return localStorage.getItem(CLE_MUSIQUE) === '1'; } catch { return false; } },
  demarrer() {
    debloquerSon();
    if (!ctx || maitre) return;
    ctx.resume?.();
    maitre = ctx.createGain();
    maitre.gain.value = 0.09;
    maitre.connect(ctx.destination);
    jouerBoucle();
  },
  arreter() {
    clearTimeout(boucle);
    if (maitre && ctx) {
      const g = maitre;
      g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.15);
      setTimeout(() => g.disconnect(), 800);
    }
    maitre = null;
  },
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
