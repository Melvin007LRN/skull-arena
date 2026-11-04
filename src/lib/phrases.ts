// Phrases rapides : la liste est gérée par l'admin (table phrases_rapides), avec une liste de secours.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';

export const PHRASES_DEFAUT = [
  'C’est très fort', 'Ah oui les jean', 'Bravo', 'Pardon', 'Masterclass', 'Tu fais chauffer', 'C’est pour moi', 'Il va la chercher',
];

export interface Phrase { id: number; texte: string; ordre: number }

export async function chargerPhrases(): Promise<Phrase[]> {
  const { data, error } = await supabase.from('phrases_rapides').select('id, texte, ordre').eq('supprimee', false).order('ordre');
  if (error) throw error;
  return (data ?? []) as Phrase[];
}

export function usePhrases(): string[] {
  const [phrases, setPhrases] = useState<string[]>(PHRASES_DEFAUT);
  useEffect(() => {
    chargerPhrases().then((l) => { if (l.length > 0) setPhrases(l.map((p) => p.texte)); }).catch(() => {});
  }, []);
  return phrases;
}
