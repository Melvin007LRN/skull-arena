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

function note(freq: number, debut: number, duree: number, volume = 0.12, type: OscillatorType = 'sine') {
  if (!ctx) return;
  const t = ctx.currentTime + debut;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(gain).connect(ctx.destination);
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
};

export function vibrer(ms = 60) {
  try { navigator.vibrate?.(ms); } catch { /* non disponible (iPhone) */ }
}
