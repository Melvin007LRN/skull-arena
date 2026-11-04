// Social : messages privés, chat de salon, blocages et signalements.
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase.ts';

async function rpc<T = unknown>(nom: string, params: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(nom, params);
  if (error) throw error;
  return data as T;
}

// ---------- Ouvrir un profil ou une conversation depuis n'importe quel écran ----------
export interface Social { ouvrirProfil: (joueur: string) => void; ouvrirMessages: (ami: string) => void }
export const ContexteSocial = createContext<Social>({ ouvrirProfil: () => {}, ouvrirMessages: () => {} });
export const useSocial = () => useContext(ContexteSocial);

// ---------- Blocages et signalements ----------
export const bloquer = (joueur: string, valeur: boolean) => rpc('bloquer', { joueur, valeur });
export const signaler = (cible: string, motif: string, contexte?: string) => rpc('signaler', { cible, motif, contexte: contexte ?? null });
export const MOTIFS_SIGNALEMENT = ['Insultes ou propos haineux', 'Pseudo ou photo inappropriés', 'Harcèlement', 'Triche', 'Autre'];

let bloquesCache: Set<string> = new Set();
const abonnesBlocages = new Set<() => void>();
export async function rechargerBlocages() {
  const { data } = await supabase.from('blocages').select('bloque').eq('actif', true);
  bloquesCache = new Set(((data ?? []) as Array<{ bloque: string }>).map((b) => b.bloque));
  abonnesBlocages.forEach((f) => f());
}
/** Joueurs que j'ai bloqués (leurs messages sont masqués). */
export function useBloques(): Set<string> {
  const [, maj] = useState(0);
  useEffect(() => {
    const f = () => maj((n) => n + 1);
    abonnesBlocages.add(f);
    if (abonnesBlocages.size === 1) rechargerBlocages().catch(() => {});
    return () => { abonnesBlocages.delete(f); };
  }, []);
  return bloquesCache;
}

// ---------- Messages privés ----------
export interface MessagePrive { id: number; de: string; a: string; texte: string; lu: boolean; cree_le: string }

export function useConversation(moi: string, ami: string) {
  const [messages, setMessages] = useState<MessagePrive[] | null>(null);
  const charger = useCallback(async () => {
    const { data } = await supabase.from('messages_prives').select('*')
      .or(`and(de.eq.${moi},a.eq.${ami}),and(de.eq.${ami},a.eq.${moi})`)
      .order('cree_le', { ascending: false }).limit(20);
    setMessages(((data ?? []) as MessagePrive[]).reverse());
    rpc('marquer_lus', { autre: ami }).catch(() => {});
  }, [moi, ami]);
  useEffect(() => {
    charger();
    const canal = supabase.channel(`conversation-${moi}-${ami}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_prives', filter: `a=eq.${moi}` }, ({ new: m }) => {
        if ((m as MessagePrive).de === ami) { setMessages((l) => [...(l ?? []), m as MessagePrive].slice(-20)); rpc('marquer_lus', { autre: ami }).catch(() => {}); }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_prives', filter: `de=eq.${moi}` }, ({ new: m }) => {
        if ((m as MessagePrive).a === ami) setMessages((l) => (l?.some((x) => x.id === (m as MessagePrive).id) ? l : [...(l ?? []), m as MessagePrive].slice(-20)));
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [moi, ami, charger]);
  const envoyer = (texte: string) => rpc('envoyer_message', { a: ami, texte });
  return { messages, envoyer };
}

/** Nombre de messages non lus, par expéditeur. */
let nonLusCache: Record<string, number> = {};
const abonnesNonLus = new Set<() => void>();
let canalNonLus: ReturnType<typeof supabase.channel> | null = null;
async function rechargerNonLus(moi: string) {
  const { data } = await supabase.from('messages_prives').select('de').eq('a', moi).eq('lu', false).limit(500);
  const c: Record<string, number> = {};
  for (const m of (data ?? []) as Array<{ de: string }>) c[m.de] = (c[m.de] ?? 0) + 1;
  nonLusCache = c;
  abonnesNonLus.forEach((f) => f());
}
export function demarrerNonLus(moi: string) {
  if (canalNonLus) return () => {};
  rechargerNonLus(moi).catch(() => {});
  canalNonLus = supabase.channel(`non-lus-${moi}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'messages_prives', filter: `a=eq.${moi}` }, () => { rechargerNonLus(moi).catch(() => {}); })
    .subscribe();
  return () => { if (canalNonLus) supabase.removeChannel(canalNonLus); canalNonLus = null; nonLusCache = {}; };
}
export function useNonLus(): Record<string, number> {
  const [, maj] = useState(0);
  useEffect(() => {
    const f = () => maj((n) => n + 1);
    abonnesNonLus.add(f);
    return () => { abonnesNonLus.delete(f); };
  }, []);
  return nonLusCache;
}
export const totalNonLus = (n: Record<string, number>) => Object.values(n).reduce((a, b) => a + b, 0);

// ---------- Chat de la salle d'attente ----------
export interface MessageSalon { id: number; de: string; pseudo: string; texte: string; cree_le: string }

export function useChatSalon(salonId: string) {
  const [messages, setMessages] = useState<MessageSalon[]>([]);
  useEffect(() => {
    let actif = true;
    supabase.from('messages_salon').select('id, de, pseudo, texte, cree_le').eq('salon_id', salonId)
      .order('cree_le', { ascending: false }).limit(40)
      .then(({ data }) => { if (actif) setMessages(((data ?? []) as MessageSalon[]).reverse()); });
    const canal = supabase.channel(`chat-salon-${salonId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages_salon', filter: `salon_id=eq.${salonId}` }, ({ new: m }) => {
        setMessages((l) => (l.some((x) => x.id === (m as MessageSalon).id) ? l : [...l, m as MessageSalon].slice(-40)));
      })
      .subscribe();
    return () => { actif = false; supabase.removeChannel(canal); };
  }, [salonId]);
  const envoyer = (texte: string) => rpc('envoyer_message_salon', { salon: salonId, texte });
  return { messages, envoyer };
}

// ---------- Admin : signalements ----------
export interface Signalement { id: number; auteur: string; cible: string; motif: string; contexte: string | null; traite: boolean; cree_le: string }
export async function chargerSignalements(): Promise<Signalement[]> {
  const { data, error } = await supabase.from('signalements').select('*').order('cree_le', { ascending: false }).limit(200);
  if (error) throw error;
  return (data ?? []) as Signalement[];
}
export const traiterSignalement = (id: number) => rpc('admin_traiter_signalement', { signalement: id });
