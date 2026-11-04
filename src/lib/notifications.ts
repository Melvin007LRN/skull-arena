// Notifications sur le téléphone (Web Push) : activation, état, et envoi après une invitation, un message ou une demande d'ami.
import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase.ts';
import { estInstallee, estIPhone } from './installation.ts';

const CLE_PUBLIQUE = 'BGe-DgBUgDjbHZCSm82vpLY34jqlCHxWCmOVgyY9QwSInhsAML2pekOzc1v7ZqvBvMeEU-iPNcBXct14ysWXwoU';

function versOctets(b64: string): Uint8Array {
  const t = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((b64.length + 3) % 4);
  return Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
}

export type EtatNotif = 'chargement' | 'actives' | 'inactives' | 'refusees' | 'iphone-installer' | 'non-supportees';

async function lireEtat(): Promise<EtatNotif> {
  const support = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (!support) return estIPhone() && !estInstallee() ? 'iphone-installer' : 'non-supportees';
  if (Notification.permission === 'denied') return 'refusees';
  const reg = await navigator.serviceWorker.getRegistration();
  const abo = await reg?.pushManager.getSubscription();
  return abo && Notification.permission === 'granted' ? 'actives' : 'inactives';
}

export function useNotifications() {
  const [etat, setEtat] = useState<EtatNotif>('chargement');
  const rafraichir = useCallback(() => { lireEtat().then(setEtat).catch(() => setEtat('non-supportees')); }, []);
  useEffect(() => { rafraichir(); }, [rafraichir]);

  const activer = useCallback(async () => {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') { rafraichir(); return false; }
    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;
    const abo = (await reg.pushManager.getSubscription())
      ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(CLE_PUBLIQUE) });
    const j = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const { error } = await supabase.rpc('enregistrer_abo', { adresse: j.endpoint, cle_publique: j.keys.p256dh, cle_auth: j.keys.auth });
    if (error) throw error;
    rafraichir();
    return true;
  }, [rafraichir]);

  const desactiver = useCallback(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    const abo = await reg?.pushManager.getSubscription();
    if (abo) {
      await supabase.rpc('desactiver_abonnement', { endpoint: abo.endpoint });
      await abo.unsubscribe();
    }
    rafraichir();
  }, [rafraichir]);

  return { etat, activer, desactiver };
}

/** Quand on se reconnecte, on rattache l'abonnement existant au compte (au cas où un autre compte l'aurait utilisé). */
export async function rattacherAbonnement() {
  try {
    if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return;
    const reg = await navigator.serviceWorker.getRegistration();
    const abo = await reg?.pushManager.getSubscription();
    if (!abo) return;
    const j = abo.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await supabase.rpc('enregistrer_abo', { adresse: j.endpoint, cle_publique: j.keys.p256dh, cle_auth: j.keys.auth });
  } catch { /* sans gravité */ }
}

/** Demande au serveur de prévenir le destinataire sur son téléphone (le serveur vérifie l'événement). */
export function notifier(type: 'invitation' | 'message' | 'ami', cible: string) {
  supabase.functions.invoke('notifier', { body: { type, cible } }).catch(() => {});
}
