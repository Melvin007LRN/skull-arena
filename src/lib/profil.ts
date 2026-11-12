import { supabase } from './supabase.ts';
import type { Perso } from './perso.ts';

export interface Profil {
  id: string;
  pseudo: string;
  photo_url: string | null;
  changements_pseudo: number;
  est_admin: boolean;
  banni: boolean;
  xp: number;
  parties_jouees: number;
  victoires: number;
  meilleur_score: number | null;
  points_total: number;
  mises_reussies: number;
  mises_total: number;
  regicides: number;
  fantomes: number;
  badges: string[];
  louidors: number;
  cadre: string | null;
  couleur_nom?: string | null;
  perso?: Perso | null;
}

export const PSEUDO_REGEX = /^[A-Za-z0-9_\-À-ÿ]{3,16}$/;
export const CHANGEMENTS_PSEUDO_MAX = 3;
export const PARTIES_AVANT_CLASSEMENT = 1;

export function niveau(xp: number): number {
  return 1 + Math.floor(Math.max(xp, 0) / 100);
}

/** Avancement dans le niveau en cours, de 0 à 1. */
export function progressionNiveau(xp: number): number {
  return (Math.max(xp, 0) % 100) / 100;
}

export function grade(n: number): string {
  if (n >= 200) return 'Légende';
  if (n >= 100) return 'Amiral';
  if (n >= 50) return 'Capitaine';
  if (n >= 25) return 'Quartier-maître';
  if (n >= 10) return 'Matelot';
  return 'Mousse';
}

/** Points moyens par partie. */
export function pointsMoyens(p: Profil): number | null {
  return p.parties_jouees > 0 ? Math.round(p.points_total / p.parties_jouees) : null;
}

export function precisionMises(p: Profil): number | null {
  return p.mises_total > 0 ? Math.round((100 * p.mises_reussies) / p.mises_total) : null;
}

export const BADGES = [
  { id: 'centurion', nom: 'Centurion', icone: '🏆', condition: '100 victoires' },
  { id: 'devin', nom: 'Devin', icone: '🔮', condition: 'Réussir ses 10 mises sur une même partie' },
  { id: 'regicide', nom: 'Régicide', icone: '👑', condition: 'Capturer 25 fois le Skull King avec une Sirène' },
  { id: 'fantome', nom: 'Fantôme', icone: '🫥', condition: 'Réussir 10 fois une mise de 0 à la manche 10' },
  { id: 'legende', nom: 'Légende des mers', icone: '💰', condition: 'Marquer 500 points ou plus en une partie' },
] as const;

export type IdBadge = (typeof BADGES)[number]['id'];

/** Progression vers chaque badge : [valeur actuelle, objectif]. */
export function progressionBadge(p: Profil, id: IdBadge): { obtenu: boolean; actuel: number; objectif: number } {
  switch (id) {
    case 'centurion': return { obtenu: p.victoires >= 100, actuel: Math.min(p.victoires, 100), objectif: 100 };
    case 'regicide': return { obtenu: (p.regicides ?? 0) >= 25, actuel: Math.min(p.regicides ?? 0, 25), objectif: 25 };
    case 'fantome': return { obtenu: (p.fantomes ?? 0) >= 10, actuel: Math.min(p.fantomes ?? 0, 10), objectif: 10 };
    default: {
      const obtenu = (p.badges ?? []).includes(id);
      return { obtenu, actuel: obtenu ? 1 : 0, objectif: 1 };
    }
  }
}

export interface LigneHistorique {
  partie_id: string;
  rang: number;
  nb_joueurs: number;
  score: number;
  xp_gagne: number;
  victoire: boolean;
  abandon: boolean;
  mises_reussies: number;
  joue_le: string;
}

export async function chargerHistorique(joueur: string, limite = 10): Promise<LigneHistorique[]> {
  const { data, error } = await supabase.from('historique_parties').select('*').eq('joueur_id', joueur)
    .order('joue_le', { ascending: false }).limit(limite);
  if (error) throw error;
  return (data ?? []) as LigneHistorique[];
}

export type LigneClassement = Pick<Profil, 'id' | 'pseudo' | 'photo_url' | 'cadre' | 'xp' | 'parties_jouees' | 'victoires' | 'points_total' | 'meilleur_score' | 'mises_reussies' | 'mises_total'> & { pm: number };

/** Classement permanent : joueurs ayant au moins 5 parties, triés par points moyens (PM), puis victoires. */
export async function chargerClassement(): Promise<LigneClassement[]> {
  const { data, error } = await supabase.from('profils')
    .select('id, pseudo, photo_url, cadre, xp, parties_jouees, victoires, points_total, meilleur_score, mises_reussies, mises_total')
    .eq('banni', false).gte('parties_jouees', PARTIES_AVANT_CLASSEMENT).limit(1000);
  if (error) throw error;
  return ((data ?? []) as Omit<LigneClassement, 'pm'>[])
    .map((p) => ({ ...p, pm: Math.round(p.points_total / p.parties_jouees) }))
    .sort((a, b) => b.victoires - a.victoires || a.parties_jouees - b.parties_jouees || b.pm - a.pm || b.xp - a.xp);
}

// Avis de recherche : le pirate qui a le plus de victoires depuis toujours.
export async function chargerRecordVictoires(): Promise<{ id: string; pseudo: string; photo_url: string | null; cadre: string | null; victoires: number; parties_jouees: number } | null> {
  const { data, error } = await supabase.from('profils')
    .select('id, pseudo, photo_url, cadre, victoires, parties_jouees')
    .eq('banni', false).gt('victoires', 0)
    .order('victoires', { ascending: false }).order('parties_jouees', { ascending: true }).limit(1);
  if (error) throw error;
  return (data?.[0] ?? null) as never;
}

export async function chargerProfil(id: string): Promise<Profil | null> {
  const { data, error } = await supabase.from('profils').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Profil | null;
}

export async function pseudoDisponible(pseudo: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('pseudo_disponible', { p: pseudo });
  if (error) throw error;
  return data === true;
}

/** Recadre la photo en carré 256 px et l'envoie dans le dossier du joueur. */
export async function envoyerPhoto(userId: string, fichier: File, ancienneUrl: string | null): Promise<string> {
  const blob = await recadrerCarre(fichier, 256);
  const chemin = `${userId}/photo-${Date.now()}.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(chemin, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  const url = supabase.storage.from('avatars').getPublicUrl(chemin).data.publicUrl;
  const { error: e2 } = await supabase.rpc('changer_photo', { url });
  if (e2) throw e2;
  if (ancienneUrl) {
    const ancien = ancienneUrl.split('/avatars/')[1];
    if (ancien?.startsWith(`${userId}/`)) await supabase.storage.from('avatars').remove([ancien]);
  }
  return url;
}

async function recadrerCarre(fichier: File, taille: number): Promise<Blob> {
  const url = URL.createObjectURL(fichier);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => ko(new Error("Cette image n'a pas pu être lue."));
      i.src = url;
    });
    const cote = Math.min(img.naturalWidth, img.naturalHeight);
    const canvas = document.createElement('canvas');
    canvas.width = taille;
    canvas.height = taille;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, (img.naturalWidth - cote) / 2, (img.naturalHeight - cote) / 2, cote, cote, 0, 0, taille, taille);
    return await new Promise<Blob>((ok, ko) =>
      canvas.toBlob((b) => (b ? ok(b) : ko(new Error('Conversion impossible.'))), 'image/jpeg', 0.86),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function supprimerMonCompte(userId: string): Promise<void> {
  const { data } = await supabase.storage.from('avatars').list(userId);
  if (data && data.length > 0) await supabase.storage.from('avatars').remove(data.map((f) => `${userId}/${f.name}`));
  const { error } = await supabase.rpc('supprimer_mon_compte');
  if (error) throw error;
  await supabase.auth.signOut();
}

export interface LigneSaison { id: string; pseudo: string; photo_url: string | null; cadre: string | null; xp: number; parties: number; victoires: number; pm: number }

/** Classement de la saison (mois en cours) : au moins 3 parties ce mois-ci. */
export async function chargerClassementSaison(): Promise<LigneSaison[]> {
  const { data, error } = await supabase.rpc('classement_saison');
  if (error) throw error;
  return (data ?? []) as LigneSaison[];
}

export const nomSaison = () => new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'Europe/Paris' });

// ---------- Défis du jour ----------
export const DEFIS: Record<string, { icone: string; texte: string }> = {
  mise_zero: { icone: '🫥', texte: 'Réussis une mise de 0' },
  mise_haute: { icone: '🎯', texte: 'Réussis une mise de 4 plis ou plus' },
  six_mises: { icone: '🔮', texte: 'Réussis au moins 6 mises dans une partie' },
  victoire: { icone: '👑', texte: 'Gagne une partie' },
  podium: { icone: '🥉', texte: 'Termine sur le podium (3 joueurs ou plus)' },
  quatorze_noir: { icone: '🏴‍☠️', texte: 'Capture le 14 noir' },
  regicide: { icone: '🧜', texte: 'Capture le Skull King avec une Sirène' },
  chasseur: { icone: '💀', texte: 'Capture un Pirate avec le Skull King' },
  bonus_50: { icone: '💰', texte: 'Marque 50 points de bonus dans une partie' },
  deux_cents: { icone: '🔥', texte: 'Termine une partie avec 200 points ou plus' },
};

export async function chargerDefisDuJour(): Promise<Array<{ id: string; reussi: boolean }>> {
  const [{ data: ids }, { data: jour }] = await Promise.all([supabase.rpc('defis_du_jour'), supabase.rpc('jour_paris')]);
  const { data: faits } = await supabase.from('defis_reussis').select('defi').eq('jour', jour as string);
  const reussis = new Set(((faits ?? []) as Array<{ defi: string }>).map((f) => f.defi));
  return ((ids ?? []) as string[]).map((id) => ({ id, reussi: reussis.has(id) }));
}
