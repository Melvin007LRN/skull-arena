import { supabase } from './supabase.ts';

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
}

export const PSEUDO_REGEX = /^[A-Za-z0-9_\-À-ÿ]{3,16}$/;
export const CHANGEMENTS_PSEUDO_MAX = 3;
export const PARTIES_AVANT_CLASSEMENT = 5;

export function niveau(xp: number): number {
  return 1 + Math.floor(Math.max(xp, 0) / 100);
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
