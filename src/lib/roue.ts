// Client de la Roue du Kraken : appels au serveur et suivi en direct de la roue publique.
import { useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import type { EtatRoue } from '../engine/roue.ts';

export async function appelRoue<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('roue', { body: { action, ...params } });
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

/** L'état public de la roue, mis à jour en direct. */
export function useRoue(id: string | null): EtatRoue | null {
  const [etat, setEtat] = useState<EtatRoue | null>(null);
  useEffect(() => {
    if (!id) return;
    let actif = true;
    const charger = () => supabase.from('roue_tables').select('etat').eq('id', id).maybeSingle()
      .then(({ data }) => { if (actif && data) setEtat(data.etat as EtatRoue); });
    charger();
    const canal = supabase.channel(`roue-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roue_tables', filter: `id=eq.${id}` },
        (msg) => setEtat((msg.new as { etat: EtatRoue }).etat))
      .subscribe();
    const t = setInterval(charger, 10000); // filet de sécurité si une notification se perd
    // Signe de vie : la roue continue de tourner tant que quelqu'un regarde.
    const vie = setInterval(() => { appelRoue('present', { table_id: id }).catch(() => {}); }, 20000);
    return () => { actif = false; clearInterval(t); clearInterval(vie); supabase.removeChannel(canal); };
  }, [id]);
  return etat;
}
