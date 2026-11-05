// Néons de pseudo : la couleur du nom d'un pirate, achetée à la boutique et vue par tous en partie.
import type { CSSProperties } from 'react';

export interface Neon { id: string; nom: string; couleurs: string[]; anime?: boolean }

export const NEONS: Record<string, Neon> = {
  neon_rouge: { id: 'neon_rouge', nom: 'Néon Rubis', couleurs: ['#ff2a4a'] },
  neon_cyan: { id: 'neon_cyan', nom: 'Néon Lagon', couleurs: ['#2ee6ff'] },
  neon_vert: { id: 'neon_vert', nom: 'Néon Émeraude', couleurs: ['#2dff7a'] },
  neon_violet: { id: 'neon_violet', nom: 'Néon Améthyste', couleurs: ['#b866ff'] },
  neon_rose: { id: 'neon_rose', nom: 'Néon Corail', couleurs: ['#ff4fd8'] },
  neon_orange: { id: 'neon_orange', nom: 'Néon Braise', couleurs: ['#ff7a1a'] },
  neon_glace: { id: 'neon_glace', nom: 'Néon Glacier', couleurs: ['#cfefff'] },
  neon_or: { id: 'neon_or', nom: 'Néon Doublon', couleurs: ['#ffcc33'] },
  neon_arcenciel: { id: 'neon_arcenciel', nom: 'Néon Arc-en-ciel', couleurs: ['#ff2a4a', '#ffcc33', '#2dff7a', '#2ee6ff', '#b866ff'], anime: true },
};

const clair = (h: string) => {
  const n = parseInt(h.slice(1), 16);
  const f = (x: number) => Math.round(x * 0.35 + 255 * 0.65).toString(16).padStart(2, '0');
  return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`;
};

/** Style du pseudo selon le néon équipé (null : style par défaut). */
export function styleNeon(id: string | null | undefined): { style?: CSSProperties; className: string } {
  const n = id ? NEONS[id] : undefined;
  if (!n) return { className: 'pseudo-neon' };
  if (n.anime) return { className: 'pseudo-neon arc-en-ciel' };
  const c = n.couleurs[0];
  return {
    className: 'pseudo-neon perso',
    style: { ['--neon-clair' as string]: clair(c), ['--neon-ombre' as string]: `0 0 4px ${c}, 0 0 10px ${c}, 0 0 20px ${c}`, ['--neon-nom' as string]: c },
  };
}
