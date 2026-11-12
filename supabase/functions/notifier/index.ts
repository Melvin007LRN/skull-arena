// Notifications sur le téléphone : invitation dans un salon, message privé, demande d'ami.
// Le serveur vérifie que l'événement existe vraiment (envoyé par l'appelant) avant de notifier le destinataire.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { envoyer, type Vapid } from './webpush.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
const reponse = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
const il_y_a = (s: number) => new Date(Date.now() - s * 1000).toISOString();

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const corpsReq = await req.json();
    const { type, cible, titre, corps, secret } = corpsReq;
    // Annonce à tous les pirates : réservée à l'admin, ou lancée depuis la base avec un secret à usage unique.
    if (type === 'annonce') {
      let autorise = false;
      if (typeof secret === 'string' && secret.length >= 24) {
        const { data: s } = await db.from('annonces_secrets').delete().eq('secret', secret).gte('cree_le', il_y_a(600)).select('secret');
        autorise = !!s?.length;
      } else {
        const jeton = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
        const { data: a } = await db.auth.getUser(jeton);
        const { data: adm } = await db.from('profils').select('est_admin').eq('id', a?.user?.id ?? '').maybeSingle();
        autorise = !!adm?.est_admin;
      }
      if (!autorise) return reponse(403, { erreur: 'Réservé au capitaine du navire.' });
      if (typeof titre !== 'string' || typeof corps !== 'string' || !titre.trim()) return reponse(400, { erreur: 'Annonce vide.' });
      const { data: cfg } = await db.rpc('config_notifications');
      const vapid: Vapid = { ...(cfg as Omit<Vapid, 'sujet'>), sujet: 'mailto:123melvin007@gmail.com' };
      const { data: abos } = await db.from('push_abonnements').select('endpoint, p256dh, auth').eq('actif', true);
      const note = { titre: titre.slice(0, 80), corps: corps.slice(0, 200), url: '/', tag: `annonce-${Date.now()}`, icone: '/icones/icone-192.png' };
      let envoyees = 0, echecs = 0;
      await Promise.all((abos ?? []).map(async (ab) => {
        try {
          const code = await envoyer(ab, note, vapid);
          if (code === 404 || code === 410) { echecs++; await db.from('push_abonnements').update({ actif: false }).eq('endpoint', ab.endpoint); }
          else if (code < 300) envoyees++;
          else echecs++;
        } catch { echecs++; }
      }));
      return reponse(200, { envoyees, echecs, abonnes: abos?.length ?? 0 });
    }

    const jeton = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: a } = await db.auth.getUser(jeton);
    const moi = a?.user?.id;
    if (!moi) return reponse(401, { erreur: 'Non connecté.' });
    if (typeof cible !== 'string' || cible === moi) return reponse(400, { erreur: 'Cible invalide.' });
    const { data: p } = await db.from('profils').select('pseudo').eq('id', moi).maybeSingle();
    const pseudo = p?.pseudo ?? 'Un pirate';
    let note: { titre: string; corps: string; url: string; tag: string } | null = null;

    if (type === 'invitation') {
      const { data } = await db.from('invitations').select('code').eq('de', moi).eq('a', cible).gte('cree_le', il_y_a(60))
        .order('cree_le', { ascending: false }).limit(1).maybeSingle();
      if (data) note = { titre: `🏴‍☠️ ${pseudo} t’invite à bord !`, corps: 'Touche pour rejoindre sa table sur SKULL ARENA.', url: `/?salon=${data.code}`, tag: `invitation-${moi}` };
    } else if (type === 'message') {
      const { data } = await db.from('messages_prives').select('texte').eq('de', moi).eq('a', cible).gte('cree_le', il_y_a(60))
        .order('cree_le', { ascending: false }).limit(1).maybeSingle();
      if (data) note = { titre: `💬 ${pseudo}`, corps: data.texte.slice(0, 140), url: `/?messages=${moi}`, tag: `message-${moi}` };
    } else if (type === 'ami') {
      const { data } = await db.from('amities').select('statut').eq('demandeur', moi).eq('destinataire', cible).eq('statut', 'attente').maybeSingle();
      if (data) note = { titre: '🤝 Nouvelle demande d’ami', corps: `${pseudo} veut rejoindre ton équipage.`, url: '/?amis=1', tag: `ami-${moi}` };
    }
    if (!note) return reponse(200, { envoyees: 0 });

    const { data: cfg } = await db.rpc('config_notifications');
    const vapid: Vapid = { ...(cfg as Omit<Vapid, 'sujet'>), sujet: 'mailto:123melvin007@gmail.com' };
    const { data: abos } = await db.from('push_abonnements').select('endpoint, p256dh, auth').eq('joueur', cible).eq('actif', true);
    let envoyees = 0;
    for (const ab of abos ?? []) {
      try {
        const code = await envoyer(ab, { ...note, icone: '/icones/icone-192.png' }, vapid);
        if (code === 404 || code === 410) await db.from('push_abonnements').update({ actif: false }).eq('endpoint', ab.endpoint);
        else if (code < 300) envoyees++;
        else console.error('push', code, ab.endpoint.slice(0, 40));
      } catch (e) { console.error('push', e); }
    }
    return reponse(200, { envoyees });
  } catch (e) {
    console.error(e);
    return reponse(500, { erreur: 'Erreur du serveur.' });
  }
});
