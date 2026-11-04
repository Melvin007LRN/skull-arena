// Amis : demandes, liste en temps réel, présence en ligne et invitations dans un salon.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.ts';

// ---------- Présence : qui a l'appli ouverte en ce moment ----------
let enLigne = new Set<string>();
const abonnesPresence = new Set<() => void>();
let canalPresence: ReturnType<typeof supabase.channel> | null = null;

export function demarrerPresence(moi: string) {
  if (canalPresence) return () => {};
  const canal = supabase.channel('en-ligne', { config: { presence: { key: moi } } });
  canal.on('presence', { event: 'sync' }, () => {
    enLigne = new Set(Object.keys(canal.presenceState()));
    abonnesPresence.forEach((f) => f());
  }).subscribe((statut) => { if (statut === 'SUBSCRIBED') canal.track({ depuis: Date.now() }).catch(() => {}); });
  canalPresence = canal;
  return () => {
    supabase.removeChannel(canal);
    canalPresence = null;
    enLigne = new Set();
  };
}

export function useEnLigne(): Set<string> {
  const [, maj] = useState(0);
  useEffect(() => {
    const f = () => maj((n) => n + 1);
    abonnesPresence.add(f);
    return () => { abonnesPresence.delete(f); };
  }, []);
  return enLigne;
}

// ---------- Liste d'amis ----------
export interface Ami { id: string; pseudo: string; photo_url: string | null; cadre: string | null; xp: number; statut: 'attente' | 'acceptee'; recue: boolean }

export function useAmis(moi: string) {
  const [amis, setAmis] = useState<Ami[] | null>(null);

  const charger = useCallback(async () => {
    const { data } = await supabase.from('amities').select('demandeur, destinataire, statut').neq('statut', 'retiree');
    const liens = (data ?? []) as Array<{ demandeur: string; destinataire: string; statut: 'attente' | 'acceptee' }>;
    const autres = liens.map((l) => (l.demandeur === moi ? l.destinataire : l.demandeur));
    if (autres.length === 0) return setAmis([]);
    const { data: profils } = await supabase.from('profils').select('id, pseudo, photo_url, cadre, xp').in('id', autres);
    const parId = new Map(((profils ?? []) as Array<Pick<Ami, 'id' | 'pseudo' | 'photo_url' | 'cadre' | 'xp'>>).map((p) => [p.id, p]));
    setAmis(liens.flatMap((l) => {
      const autre = l.demandeur === moi ? l.destinataire : l.demandeur;
      const p = parId.get(autre);
      return p ? [{ ...p, statut: l.statut, recue: l.destinataire === moi }] : [];
    }).sort((a, b) => a.pseudo.localeCompare(b.pseudo)));
  }, [moi]);

  useEffect(() => {
    charger();
    const canal = supabase.channel(`amis-${moi}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'amities', filter: `demandeur=eq.${moi}` }, charger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'amities', filter: `destinataire=eq.${moi}` }, charger)
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [moi, charger]);

  return { amis, recharger: charger };
}

async function rpc<T = unknown>(nom: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nom, params);
  if (error) throw error;
  return data as T;
}

export const demanderAmi = (pseudo: string) => rpc<'demande' | 'deja' | 'acceptee' | 'deja_demande'>('demander_ami', { pseudo_ami: pseudo });
export const repondreAmi = (autre: string, accepter: boolean) => rpc('repondre_ami', { autre, accepter });
export const retirerAmi = (autre: string) => rpc('retirer_ami', { autre });
export const inviterAmi = (ami: string, salon: string) => rpc('inviter_ami', { ami, salon });

// ---------- Invitations reçues ----------
export interface Invitation { id: number; de: string; pseudo: string; code: string; salon_id: string }

export function useInvitations(moi: string) {
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  useEffect(() => {
    const canal = supabase.channel(`invitations-${moi}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'invitations', filter: `a=eq.${moi}` }, async ({ new: ligne }) => {
        const l = ligne as { id: number; de: string; code: string; salon_id: string };
        const { data } = await supabase.from('profils').select('pseudo').eq('id', l.de).maybeSingle();
        setInvitation({ ...l, pseudo: (data as { pseudo: string } | null)?.pseudo ?? 'Un ami' });
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [moi]);
  // Une invitation non traitée disparaît après 30 secondes.
  useEffect(() => {
    if (!invitation) return;
    const t = setTimeout(() => setInvitation(null), 30000);
    return () => clearTimeout(t);
  }, [invitation]);
  return { invitation, fermer: () => setInvitation(null) };
}
