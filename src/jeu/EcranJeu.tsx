// Branche l'écran de jeu sur le serveur : état en temps réel, coups, réveil des robots, phrases rapides.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, messageErreur } from '../lib/supabase.ts';
import { appel, usePartie, type MembreSalon } from '../lib/jeu.ts';
import { TableJeu } from './TableJeu.tsx';
import { creerPaquet } from '../engine/cards.ts';
import { niveau } from '../lib/profil.ts';
import { usePhrases } from '../lib/phrases.ts';
import { chargerInventaire, utiliserObjet } from '../lib/boutique.ts';
import { son } from '../lib/sons.ts';
import './jeu.css';

const ANTI_SPAM_MS = 3000;

// Préchargement des illustrations : la main d'abord, puis tout le paquet, pour qu'aucune carte n'apparaisse en retard.
const dejaCharge = new Set<string>();
function precharger(ids: string[]) {
  for (const id of ids) {
    if (dejaCharge.has(id)) continue;
    dejaCharge.add(id);
    const img = new Image();
    img.decoding = 'async';
    img.src = `/cartes/${id}.webp`;
  }
}

export function EcranJeu({ partieId, membres, moi, hote, retourAccueil }: {
  partieId: string; membres: MembreSalon[]; moi: string; hote: string; retourAccueil: () => void;
}) {
  const { vue, main } = usePartie(partieId, moi);
  const phrases = usePhrases();
  const phrasesRef = useRef(phrases);
  phrasesRef.current = phrases;
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [bulle, setBulle] = useState<{ de: string; texte: string; cle: number } | null>(null);
  const canalChat = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const dernierEnvoi = useRef(0);
  const [presents, setPresents] = useState<string[] | undefined>(undefined);
  const [lancers, setLancers] = useState<Array<{ id: number; de: string; a: string; objet: string }>>([]);
  const [reactions, setReactions] = useState<Array<{ cle: number; de: string; emoji: string }>>([]);
  const [inventaire, setInventaire] = useState<Record<string, number>>({});
  const dernierEmoji = useRef(0);
  const [gain, setGain] = useState<{ xp: number; louidors: number; niveauAvant: number; niveauApres: number } | null>(null);
  const [bilan, setBilan] = useState<Array<{ adversaire: string; mes_victoires: number; ses_victoires: number; parties: number }>>([]);

  // Les joueurs qui quittent la table après la partie gardent leur nom à l'écran.
  const connus = useRef(new Map<string, MembreSalon>());
  const tousMembres = useMemo(() => {
    for (const m of membres) connus.current.set(m.joueur_id, m);
    return [...connus.current.values()];
  }, [membres]);

  // Record à battre : le meilleur score jamais réalisé par un pirate.
  const [record, setRecord] = useState<{ pseudo: string; score: number } | null>(null);
  useEffect(() => {
    supabase.from('profils').select('pseudo, meilleur_score').eq('banni', false).not('meilleur_score', 'is', null)
      .order('meilleur_score', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { const d = data as { pseudo: string; meilleur_score: number } | null; if (d) setRecord({ pseudo: d.pseudo, score: d.meilleur_score }); });
  }, []);
  useEffect(() => {
    if (main?.main) precharger(main.main);
  }, [main?.main]);
  useEffect(() => {
    const t = setTimeout(() => precharger(creerPaquet(Boolean(vue?.extension)).map((c) => c.id)), 300);
    return () => clearTimeout(t);
  }, [vue?.extension]);

  const envoyer = useCallback(async (coup: Record<string, unknown>) => {
    setEnCours(true);
    setErreur(null);
    try {
      await appel('jouer', { partie_id: partieId, coup });
      return true;
    } catch (e) {
      setErreur((e as Error).message);
      setTimeout(() => setErreur(null), 3500);
      return false;
    } finally {
      setEnCours(false);
    }
  }, [partieId]);

  // Objets lancés : enregistrés (et payés) par le serveur, reçus en temps réel par toute la table.
  useEffect(() => {
    chargerInventaire().then(setInventaire).catch(() => {});
    const canal = supabase.channel(`lancers-${partieId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lancers', filter: `partie_id=eq.${partieId}` }, ({ new: l }) => {
        const ligne = l as { id: number; de: string; a: string; objet: string };
        setLancers((x) => [...x.slice(-5), ligne]);
        setTimeout(() => son.impact(), 850);
        setTimeout(() => setLancers((x) => x.filter((y) => y.id !== ligne.id)), 3200);
      })
      .subscribe();
    return () => { supabase.removeChannel(canal); };
  }, [partieId]);

  const lancerObjet = useCallback(async (objet: string, cible: string) => {
    try {
      const reste = await utiliserObjet(objet, partieId, cible);
      setInventaire((i) => ({ ...i, [objet]: reste }));
      return true;
    } catch (e) {
      setErreur(messageErreur(e));
      setTimeout(() => setErreur(null), 3000);
      return false;
    }
  }, [partieId]);

  // Fin de partie : XP gagnée (enregistrée par le serveur), avec passage de niveau éventuel.
  const comptee = vue?.phase === 'fin_partie' && !vue.annulee && !vue.entrainement;
  useEffect(() => {
    if (!comptee) return;
    let essais = 0, fini = false;
    const chercher = async () => {
      const [{ data: h }, { data: p }] = await Promise.all([
        supabase.from('historique_parties').select('xp_gagne, louidors_gagnes').eq('partie_id', partieId).eq('joueur_id', moi).maybeSingle(),
        supabase.from('profils').select('xp').eq('id', moi).maybeSingle(),
      ]);
      if (fini) return;
      if (h && p) {
        setGain({ xp: h.xp_gagne, louidors: h.louidors_gagnes ?? 0, niveauAvant: niveau(p.xp - h.xp_gagne), niveauApres: niveau(p.xp) });
        const autresHumains = (vue?.joueurs ?? []).filter((j) => j !== moi && !vue?.robots?.includes(j));
        if (autresHumains.length) {
          const { data } = await supabase.rpc('bilan_face_a_face', { autres: autresHumains });
          setBilan((data ?? []) as typeof bilan);
        }
      }
      else if (++essais < 6) setTimeout(chercher, 1500);
    };
    const t = setTimeout(chercher, 1200);
    return () => { fini = true; clearTimeout(t); };
  }, [comptee, partieId, moi]);

  const salonId = membres[0]?.salon_id ?? tousMembres[0]?.salon_id;
  const rejouer = useCallback(async () => {
    try { await appel('rejouer', { salon_id: salonId }); } catch (e) { setErreur((e as Error).message); setTimeout(() => setErreur(null), 3500); }
  }, [salonId]);

  // Réveil toutes les 20 s : remplace les absents (2 min) et relance les robots si besoin.
  const finie = vue?.phase === 'fin_partie' || vue?.annulee;
  useEffect(() => {
    if (finie) return;
    const reveil = () => appel('reveiller', { partie_id: partieId }).catch(() => {});
    reveil();
    const t = setInterval(reveil, 20000);
    return () => clearInterval(t);
  }, [partieId, finie]);

  // Retour après une absence : on reprend la main à la manche suivante.
  const suisRemplace = !!vue?.remplaces?.includes(moi) && !vue?.definitifs?.includes(moi);
  useEffect(() => {
    if (!suisRemplace) return;
    const revenir = () => document.visibilityState === 'visible' && appel('revenir', { partie_id: partieId }).catch(() => {});
    revenir();
    document.addEventListener('visibilitychange', revenir);
    return () => document.removeEventListener('visibilitychange', revenir);
  }, [suisRemplace, partieId]);

  // Phrases rapides : diffusées en direct, la dernière remplace aussitôt la précédente.
  useEffect(() => {
    const canal = supabase.channel(`phrases-${partieId}`, { config: { broadcast: { self: true }, presence: { key: moi } } });
    // Présence : qui a la table ouverte en ce moment (pastille verte / grise).
    canal.on('presence', { event: 'sync' }, () => setPresents(Object.keys(canal.presenceState())));
    let minuterie = 0;
    canal.on('broadcast', { event: 'reaction' }, ({ payload }) => {
      const { de, emoji } = payload as { de: string; emoji: string };
      if (typeof emoji !== 'string' || emoji.length > 8) return;
      const cle = Date.now() + Math.random();
      setReactions((x) => [...x.slice(-8), { cle, de, emoji }]);
      setTimeout(() => setReactions((x) => x.filter((y) => y.cle !== cle)), 2200);
    });
    canal.on('broadcast', { event: 'phrase' }, ({ payload }) => {
      const { de, texte } = payload as { de: string; texte: string };
      if (!phrasesRef.current.includes(texte)) return;
      clearTimeout(minuterie);
      setBulle({ de, texte, cle: Date.now() });
      minuterie = window.setTimeout(() => setBulle(null), 2600);
    }).subscribe((statut) => { if (statut === 'SUBSCRIBED') canal.track({ en_ligne: true }).catch(() => {}); });
    canalChat.current = canal;
    return () => { clearTimeout(minuterie); supabase.removeChannel(canal); };
  }, [partieId, moi]);

  const envoyerReaction = useCallback((emoji: string) => {
    if (Date.now() - dernierEmoji.current < 1500) return;
    dernierEmoji.current = Date.now();
    canalChat.current?.send({ type: 'broadcast', event: 'reaction', payload: { de: moi, emoji } });
  }, [moi]);

  const envoyerPhrase = useCallback((texte: string) => {
    if (Date.now() - dernierEnvoi.current < ANTI_SPAM_MS) return;
    dernierEnvoi.current = Date.now();
    canalChat.current?.send({ type: 'broadcast', event: 'phrase', payload: { de: moi, texte } });
  }, [moi]);

  // En partie, on tente le plein écran et le verrouillage en paysage (fonctionne sur Android).
  useEffect(() => {
    const verrouiller = async () => {
      try {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape');
      } catch { /* iPhone : on affiche « Tourne ton téléphone » à la place */ }
    };
    document.addEventListener('pointerdown', verrouiller, { once: true });
    return () => document.removeEventListener('pointerdown', verrouiller);
  }, []);

  const sortir = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    retourAccueil();
  }, [retourAccueil]);
  // Après la partie, « Retour au port » libère aussi sa place dans le salon.
  const retourPort = useCallback(() => {
    if (salonId) appel('quitter', { salon_id: salonId }).catch(() => {});
    sortir();
  }, [salonId, sortir]);

  if (!vue || !main) {
    return <div className="jeu"><div className="jeu-decor" /><p className="jeu-chargement">Distribution des cartes…</p></div>;
  }

  return (
    <TableJeu
      vue={vue} main={main} membres={tousMembres} moi={moi} hote={hote} gain={gain} bilan={bilan} rejouer={rejouer}
      lancers={lancers} reactions={reactions} inventaire={inventaire} lancerObjet={lancerObjet} envoyerReaction={envoyerReaction}
      enCours={enCours} erreur={erreur} bulle={bulle} phrases={phrases} presents={presents} record={record}
      envoyer={envoyer} envoyerPhrase={envoyerPhrase}
      quitter={async () => { try { await appel('abandonner', { partie_id: partieId }); } catch { /* déjà finie */ } sortir(); }}
      exclure={(j) => appel('exclure', { salon_id: salonId, joueur_id: j }).catch((e) => setErreur((e as Error).message))}
      retourAccueil={finie ? retourPort : sortir}
    />
  );
}
