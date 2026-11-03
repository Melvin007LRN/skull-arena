import { createClient } from '@supabase/supabase-js';

// Ces deux valeurs sont publiques par nature (elles sont envoyées à chaque navigateur) ;
// la sécurité repose sur les règles de la base de données, pas sur leur secret.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://qhhzuphsuvjwovlwodbn.supabase.co';
const CLE = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_p6kLtGlRUMSc6sy7PD01fQ_fLo2sos1';

export const supabase = createClient(URL, CLE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

/** Traduit les messages d'erreur de Supabase en français clair. */
export function messageErreur(e: unknown): string {
  const brut = (e as { message?: string })?.message ?? String(e);
  const m = brut.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email ou mot de passe incorrect.';
  if (m.includes('user already registered') || m.includes('already been registered')) return 'Un compte existe déjà avec cet email.';
  if (m.includes('password should be at least')) return 'Le mot de passe doit faire au moins 6 caractères.';
  if (m.includes('unable to validate email') || m.includes('invalid format')) return "Cette adresse email n'est pas valide.";
  if (m.includes('email not confirmed')) return "Ton email n'est pas encore confirmé.";
  if (m.includes('rate limit') || m.includes('too many')) return 'Trop de tentatives. Réessaie dans quelques minutes.';
  if (m.includes('database error saving new user')) return "Impossible de créer le compte : vérifie ton pseudo et réessaie.";
  if (m.includes('failed to fetch') || m.includes('network')) return 'Connexion impossible. Vérifie ton réseau.';
  if (m.includes('new password should be different')) return "Le nouveau mot de passe doit être différent de l'ancien.";
  return brut;
}
