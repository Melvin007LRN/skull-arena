// Serveur du Blackjack du Capitaine : tables, mises en Louidors et minuteries.
// L'état public de chaque table est dans bj_tables (lu en temps réel par les joueurs) ;
// le sabot et la carte cachée du croupier restent dans bj_secrets, que seul ce serveur lit.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  agir, asseoir, delaiEcoule, ErreurBJ, gains, lever, miser, nouvelEtat, nouveauSabot, type EtatBJ, type SecretBJ,
} from './engine/blackjack.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
class Refus extends Error {}
const LETTRES = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function reponse(statut: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
function ok<T>(r: { data: T; error: unknown }): T { if (r.error) throw r.error; return r.data; }
function enArrierePlan(p: Promise<unknown>) {
  const q = p.catch((e) => console.error('blackjack', e));
  // deno-lint-ignore no-explicit-any
  if (typeof (globalThis as any).EdgeRuntime !== 'undefined') (globalThis as any).EdgeRuntime.waitUntil(q);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const jeton = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data } = await db.auth.getUser(jeton);
    const moi = data?.user?.id;
    if (!moi) throw new Refus('Connecte-toi pour jouer.');
    const c = await req.json();
    return reponse(200, await action(moi, c));
  } catch (e) {
    if (e instanceof Refus || e instanceof ErreurBJ) return reponse(400, { erreur: e.message });
    const m = (e as { message?: string })?.message ?? '';
    if (m.includes('Pas assez de Louidors')) return reponse(400, { erreur: 'Pas assez de Louidors pour cette mise.' });
    console.error(e);
    return reponse(500, { erreur: 'Le serveur a rencontré un problème. Réessaie.' });
  }
});

async function action(moi: string, c: Record<string, unknown>) {
  switch (c?.action) {
    case 'rejoindre': return rejoindre(moi, String(c.mode ?? 'public'), c.code ? String(c.code) : null);
    case 'quitter': return modifier(String(c.table_id), (e, s) => { lever(e, moi, s, Date.now()); });
    case 'miser': return miserLouidors(moi, String(c.table_id), Number(c.mise));
    case 'agir': return jouer(moi, String(c.table_id), String(c.coup) as 'tirer' | 'rester' | 'doubler');
    case 'avancer': return modifier(String(c.table_id), (e, s) => { delaiEcoule(e, s, Date.now()); });
    default: throw new Refus('Action inconnue.');
  }
}

async function profil(moi: string) {
  const p = ok(await db.from('profils').select('pseudo, photo_url, cadre, xp, banni').eq('id', moi).maybeSingle()) as
    { pseudo: string; photo_url: string | null; cadre: string | null; xp: number; banni: boolean } | null;
  if (!p) throw new Refus('Profil introuvable.');
  if (p.banni) throw new Refus('Ton compte a été banni.');
  return { joueur: moi, pseudo: p.pseudo, photo: p.photo_url, cadre: p.cadre, niveau: 1 + Math.floor(Math.max(0, p.xp) / 100) };
}

async function creerTable(type: 'public' | 'solo' | 'privee', hote: string | null) {
  for (let i = 0; i < 5; i++) {
    const code = type === 'privee' ? Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => LETTRES[b % LETTRES.length]).join('') : null;
    const r = await db.from('bj_tables').insert({ type, code, hote, etat: nouvelEtat() }).select('id').single();
    if (r.error?.code === '23505') {
      if (type === 'public') return (ok(await db.from('bj_tables').select('id').eq('type', 'public').single()) as { id: string }).id;
      continue;
    }
    const id = (ok(r) as { id: string }).id;
    const graine = crypto.getRandomValues(new Uint32Array(1))[0];
    ok(await db.from('bj_secrets').insert({ table_id: id, secret: { sabot: nouveauSabot(graine), cachee: null, graine } }));
    return id;
  }
  throw new Refus('Impossible de créer la table, réessaie.');
}

async function rejoindre(moi: string, mode: string, code: string | null) {
  const p = await profil(moi);
  let id: string;
  if (mode === 'public') {
    const t = ok(await db.from('bj_tables').select('id').eq('type', 'public').maybeSingle()) as { id: string } | null;
    id = t?.id ?? await creerTable('public', null);
  } else if (mode === 'solo') {
    // On reprend sa table solo si elle existe déjà (pas une nouvelle table à chaque fois).
    const t = ok(await db.from('bj_tables').select('id').eq('type', 'solo').eq('hote', moi).order('cree_le', { ascending: false }).limit(1).maybeSingle()) as { id: string } | null;
    id = t?.id ?? await creerTable('solo', moi);
  } else if (mode === 'privee') {
    id = await creerTable('privee', moi);
  } else {
    const c = (code ?? '').trim().toUpperCase();
    const t = ok(await db.from('bj_tables').select('id').eq('code', c).maybeSingle()) as { id: string } | null;
    if (!t) throw new Refus('Aucune table avec ce code.');
    id = t.id;
  }
  await modifier(id, (e) => { asseoir(e, p); });
  const t = ok(await db.from('bj_tables').select('id, type, code').eq('id', id).single());
  return t;
}

type Avant = { phase: EtatBJ['phase']; manche: number };

/** Lit, modifie et réécrit une table (avec reprise si quelqu'un a joué en même temps). Paie les gains une seule fois. */
async function modifier(id: string, f: (e: EtatBJ, s: SecretBJ) => void) {
  for (let essai = 0; essai < 6; essai++) {
    const t = ok(await db.from('bj_tables').select('etat, version, type').eq('id', id).maybeSingle()) as { etat: EtatBJ; version: number; type: string } | null;
    if (!t) throw new Refus('Cette table n’existe plus.');
    const s = ok(await db.from('bj_secrets').select('secret').eq('table_id', id).single()) as { secret: SecretBJ };
    const etat = t.etat, secret = s.secret;
    const avant: Avant = { phase: etat.phase, manche: etat.manche };
    f(etat, secret);
    const ecrit = ok(await db.rpc('bj_ecrire', { p_table: id, p_version: t.version, p_etat: etat, p_secret: secret })) as boolean;
    if (!ecrit) { await dormir(60 + Math.random() * 120); continue; }
    if (avant.phase !== 'resultats' && etat.phase === 'resultats') {
      for (const g of gains(etat)) {
        try { await db.rpc('louidors_ajuster', { p_joueur: g.joueur, p_delta: g.montant, p_table: id, p_raison: 'gain' }); } catch (e) { console.error('gain', e); }
      }
    }
    if (etat.echeance) enArrierePlan(surveiller(id, etat.echeance));
    return { ok: true };
  }
  throw new Refus('Trop de coups en même temps, réessaie.');
}

/** Fait avancer la table quand une minuterie expire (si aucun joueur ne l'a déjà fait). */
async function surveiller(id: string, echeance: number) {
  const attente = echeance - Date.now() + 250;
  if (attente > 40000) return;
  await dormir(Math.max(0, attente));
  const t = ok(await db.from('bj_tables').select('etat').eq('id', id).maybeSingle()) as { etat: EtatBJ } | null;
  if (!t || t.etat.echeance !== echeance) return;
  await modifier(id, (e, s) => { delaiEcoule(e, s, Date.now()); });
}

async function miserLouidors(moi: string, id: string, mise: number) {
  if (!Number.isInteger(mise) || mise <= 0) throw new Refus('Mise invalide.');
  const t = ok(await db.from('bj_tables').select('type').eq('id', id).maybeSingle()) as { type: string } | null;
  if (!t) throw new Refus('Cette table n’existe plus.');
  await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: -mise, p_table: id, p_raison: 'mise' }).then((r) => { if (r.error) throw r.error; });
  try {
    return await modifier(id, (e, s) => { miser(e, moi, mise, s, Date.now(), t.type === 'solo'); });
  } catch (e) {
    await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: mise, p_table: id, p_raison: 'remboursement' });
    throw e;
  }
}

async function jouer(moi: string, id: string, coup: 'tirer' | 'rester' | 'doubler') {
  if (!['tirer', 'rester', 'doubler'].includes(coup)) throw new Refus('Coup inconnu.');
  let supplement = 0;
  if (coup === 'doubler') {
    const t = ok(await db.from('bj_tables').select('etat').eq('id', id).maybeSingle()) as { etat: EtatBJ } | null;
    const s = t?.etat.tour !== null && t?.etat.tour !== undefined ? t.etat.sieges[t.etat.tour] : null;
    if (!s || s.joueur !== moi || !s.main) throw new Refus('Ce n’est pas ton tour.');
    supplement = s.main.mise;
    await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: -supplement, p_table: id, p_raison: 'double' }).then((r) => { if (r.error) throw r.error; });
  }
  try {
    return await modifier(id, (e, s) => { agir(e, moi, coup, s, Date.now()); });
  } catch (e) {
    if (supplement) await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: supplement, p_table: id, p_raison: 'remboursement' });
    throw e;
  }
}
