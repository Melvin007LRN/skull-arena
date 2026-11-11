// Côté navigateur : appels à l'arbitre du serveur et abonnements en temps réel aux salons et parties.
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase.ts';
import type { VuePublique, VuePrivee } from '../engine/vues.ts';
import type { Perso } from './perso.ts';

export interface Salon {
  id: string;
  code: string;
  public: boolean;
  hote: string;
  statut: 'attente' | 'en_jeu' | 'terminee';
  entrainement: boolean;
  /** Partie avec les 19 cartes de l'extension. */
  extension?: boolean;
}

export interface MembreSalon {
  salon_id: string;
  joueur_id: string;
  pseudo: string;
  photo_url: string | null;
  cadre?: string | null;
  couleur_nom?: string | null;
  perso?: Perso | null;
  est_robot: boolean;
  pret: boolean;
  place: number;
}

export type VueJeu = VuePublique & {
  continuer: string[];
  debutManche: string;
  partieId: string;
  robots: string[];
  remplaces: string[];
  definitifs: string[];
  entrainement: boolean;
  annulee: boolean;
  rapide?: boolean;
  stats?: Record<string, { sk: number; pir: number; q14n: number; q14: number; kraken: number }>;
};

/** Appelle l'arbitre. En cas de refus, lève une erreur avec le message en français. */
export async function appel<T = unknown>(action: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.functions.invoke('partie', { body: { action, ...params } });
  if (error) {
    let message = 'Connexion au serveur impossible. Réessaie.';
    const ctx = (error as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const corps = await ctx.json();
        if (corps?.erreur) message = corps.erreur;
      } catch { /* réponse illisible */ }
    }
    throw new Error(message);
  }
  return data as T;
}

/** Salon en cours du joueur (en attente ou en jeu), pour y revenir automatiquement. */
export async function salonEnCours(moi: string): Promise<string | null> {
  const { data } = await supabase
    .from('salon_joueurs')
    .select('salon_id, salons!inner(statut, maj_le)')
    .eq('joueur_id', moi)
    .in('salons.statut', ['attente', 'en_jeu']);
  const liste = (data ?? []) as unknown as Array<{ salon_id: string; salons: { statut: string; maj_le: string } }>;
  liste.sort((a, b) => b.salons.maj_le.localeCompare(a.salons.maj_le));
  for (const l of liste) {
    // Une partie qu'on a quittée (robot jusqu'à la fin) ne doit pas nous ramener à table.
    const { data: p } = await supabase.from('parties').select('vue').eq('salon_id', l.salon_id)
      .order('cree_le', { ascending: false }).limit(1).maybeSingle();
    const definitifs = ((p?.vue as { definitifs?: string[] } | undefined)?.definitifs) ?? [];
    if (!definitifs.includes(moi)) return l.salon_id;
  }
  return null;
}

export function useSalonsPublics() {
  const [salons, setSalons] = useState<Array<Salon & { nb: number; hotePseudo: string }>>([]);
  const charger = useCallback(async () => {
    const { data } = await supabase
      .from('salons')
      .select('*, salon_joueurs(pseudo, joueur_id)')
      .eq('public', true)
      .eq('statut', 'attente')
      .order('cree_le', { ascending: false })
      .limit(30);
    const liste = (data ?? []) as Array<Salon & { salon_joueurs: Array<{ pseudo: string; joueur_id: string }> }>;
    setSalons(
      liste
        .map((s) => ({ ...s, nb: s.salon_joueurs.length, hotePseudo: s.salon_joueurs.find((j) => j.joueur_id === s.hote)?.pseudo ?? '?' }))
        .filter((s) => s.nb > 0 && s.nb < (s.extension ? 9 : 8)),
    );
  }, []);
  useEffect(() => {
    charger();
    const canal = supabase
      .channel('salons-publics')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salons' }, charger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salon_joueurs' }, charger)
      .subscribe();
    const t = setInterval(charger, 15000);
    return () => {
      clearInterval(t);
      supabase.removeChannel(canal);
    };
  }, [charger]);
  return salons;
}

/** Salon, ses joueurs et sa partie en cours, tenus à jour en temps réel. */
export function useSalon(salonId: string, moi: string) {
  const [salon, setSalon] = useState<Salon | null | undefined>(undefined);
  const [membres, setMembres] = useState<MembreSalon[]>([]);
  const [partieId, setPartieId] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const [s, m, p] = await Promise.all([
      supabase.from('salons').select('*').eq('id', salonId).maybeSingle(),
      supabase.from('salon_joueurs').select('*').eq('salon_id', salonId).order('place'),
      supabase.from('parties').select('id').eq('salon_id', salonId).order('cree_le', { ascending: false }).limit(1),
    ]);
    setSalon((s.data as Salon | null) ?? null);
    setMembres((m.data as MembreSalon[] | null) ?? []);
    setPartieId(p.data?.[0]?.id ?? null);
  }, [salonId]);

  useEffect(() => {
    charger();
    const canal = supabase
      .channel(`salon-${salonId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salons', filter: `id=eq.${salonId}` }, charger)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salon_joueurs', filter: `salon_id=eq.${salonId}` }, charger)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'parties', filter: `salon_id=eq.${salonId}` }, charger)
      .subscribe();
    const t = setInterval(charger, 20000); // filet de sécurité si une notification se perd
    return () => {
      clearInterval(t);
      supabase.removeChannel(canal);
    };
  }, [salonId, charger]);

  const suisDedans = membres.some((m) => m.joueur_id === moi);
  return { salon, membres, partieId, suisDedans, recharger: charger };
}

/** Vue publique de la partie + ma main, en temps réel. */
export function usePartie(partieId: string | null, moi: string) {
  const [vue, setVueBrute] = useState<VueJeu | null>(null);
  const [main, setMainBrute] = useState<VuePrivee | null>(null);
  // Les notifications peuvent arriver dans le désordre : on ignore toute version plus ancienne.
  const versionVue = useRef(-1);
  const versionMain = useRef(-1);
  const setVue = (v: VueJeu, version: number) => {
    if (version < versionVue.current) return;
    versionVue.current = version;
    setVueBrute(v);
  };
  const setMain = (v: VuePrivee, version: number) => {
    if (version < versionMain.current) return;
    versionMain.current = version;
    setMainBrute(v);
  };

  const charger = useCallback(async () => {
    if (!partieId) return;
    const [p, m] = await Promise.all([
      supabase.from('parties').select('vue, version').eq('id', partieId).maybeSingle(),
      supabase.from('mains').select('vue, version').eq('partie_id', partieId).eq('joueur_id', moi).maybeSingle(),
    ]);
    if (p.data) setVue(p.data.vue as VueJeu, p.data.version as number);
    if (m.data) setMain(m.data.vue as VuePrivee, m.data.version as number);
  }, [partieId, moi]);

  useEffect(() => {
    if (!partieId) return;
    versionVue.current = -1;
    versionMain.current = -1;
    charger();
    const canal = supabase
      .channel(`partie-${partieId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'parties', filter: `id=eq.${partieId}` },
        (msg) => {
          const ligne = msg.new as { vue: VueJeu; version: number };
          setVue(ligne.vue, ligne.version);
        })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mains', filter: `partie_id=eq.${partieId}` },
        (msg) => {
          const ligne = msg.new as { joueur_id?: string; vue?: VuePrivee; version?: number };
          if (ligne?.joueur_id === moi && ligne.vue) setMain(ligne.vue, ligne.version ?? 0);
        })
      .subscribe((statut) => {
        if (statut === 'SUBSCRIBED') charger();
      });
    const t = setInterval(charger, 15000);
    const auRetour = () => document.visibilityState === 'visible' && charger();
    document.addEventListener('visibilitychange', auRetour);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', auRetour);
      supabase.removeChannel(canal);
    };
  }, [partieId, moi, charger]);

  return { vue, main, recharger: charger };
}

export function lienInvitation(code: string): string {
  return `${window.location.origin}/?salon=${code}`;
}

export async function partagerInvitation(code: string): Promise<'partage' | 'copie'> {
  const url = lienInvitation(code);
  const texte = `Rejoins-moi sur Skull Arena ! Code du salon : ${code}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: 'Skull Arena', text: texte, url });
      return 'partage';
    } catch { /* annulé : on copie à la place */ }
  }
  await navigator.clipboard?.writeText(`${texte}\n${url}`);
  return 'copie';
}
