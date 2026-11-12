// Client du Blackjack du Capitaine : appels au serveur et suivi en temps réel d'une table.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import type { EtatBJ } from '../engine/blackjack.ts';

export interface TableBJ { id: string; type: 'public' | 'solo' | 'privee'; code: string | null }

export async function appelBJ<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('blackjack', { body: { action, ...params } });
  if (error) {
    let message = 'Connexion au serveur impossible. Réessaie.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try { const corps = await ctx.json(); if (corps?.erreur) message = corps.erreur; } catch { /* réponse illisible */ }
    }
    throw new Error(message);
  }
  return data as T;
}

/** L'état public d'une table, mis à jour en direct. */
export function useTableBJ(id: string | null): EtatBJ | null {
  const [etat, setEtat] = useState<EtatBJ | null>(null);
  useEffect(() => {
    if (!id) return;
    let actif = true;
    const charger = () => supabase.from('bj_tables').select('etat').eq('id', id).maybeSingle()
      .then(({ data }) => { if (actif && data) setEtat(data.etat as EtatBJ); });
    charger();
    const canal = supabase.channel(`bj-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bj_tables', filter: `id=eq.${id}` },
        (msg) => setEtat((msg.new as { etat: EtatBJ }).etat))
      .subscribe();
    const t = setInterval(charger, 10000); // filet de sécurité si une notification se perd
    return () => { actif = false; clearInterval(t); supabase.removeChannel(canal); };
  }, [id]);
  return etat;
}

/** Jetons proposés (valeur en Louidors). */
export const JETONS = [10, 50, 100, 500, 1000, 5000] as const;
