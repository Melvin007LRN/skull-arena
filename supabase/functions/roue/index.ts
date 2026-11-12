// Serveur de la Roue du Kraken : une roue publique partagée, mises en Louidors, minuteries et paiements.
// L'état public est dans roue_tables (lu en temps réel) ; la grille cachée de la Chasse au trésor est dans roue_secrets.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  avancer, choisir, ErreurRoue, gainsRoue, miserRoue, nouvelEtatRoue, retirerMises, signaler, ZONES,
  type Drapeau, type EtatRoue, type SecretRoue, type Zone,
} from './engine/roue.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
class Refus extends Error {}
const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hasard = () => crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
const reponse = (s: number, c: unknown) => new Response(JSON.stringify(c), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });
function ok<T>(r: { data: T; error: unknown }): T { if (r.error) throw r.error; return r.data; }
function enArrierePlan(p: Promise<unknown>) {
  const q = p.catch((e) => console.error('roue', e));
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
    return reponse(200, await action(moi, await req.json()));
  } catch (e) {
    if (e instanceof Refus || e instanceof ErreurRoue) return reponse(400, { erreur: e.message });
    const m = (e as { message?: string })?.message ?? '';
    if (m.includes('Pas assez de Louidors')) return reponse(400, { erreur: 'Pas assez de Louidors pour cette mise.' });
    console.error(e);
    return reponse(500, { erreur: 'Le serveur a rencontré un problème. Réessaie.' });
  }
});

async function action(moi: string, c: Record<string, unknown>) {
  switch (c?.action) {
    case 'rejoindre': {
      const id = await tablePublique();
      await modifier(id, (e) => { signaler(e, moi, Date.now()); });
      return { id };
    }
    case 'present': return modifier(String(c.table_id), (e) => { if (Date.now() - (e.presents[moi] ?? 0) > 25000) signaler(e, moi, Date.now()); });
    case 'miser': return miser(moi, String(c.table_id), c.zones as Record<string, number>);
    case 'retirer': return retirer(moi, String(c.table_id));
    case 'choisir': return modifier(String(c.table_id), (e) => { choisir(e, moi, c.choix as number | Drapeau, Date.now()); });
    case 'avancer': return modifier(String(c.table_id), (e, s) => { avancer(e, s, hasard, Date.now()); });
    default: throw new Refus('Action inconnue.');
  }
}

async function tablePublique(): Promise<string> {
  const t = ok(await db.from('roue_tables').select('id').eq('nom', 'publique').maybeSingle()) as { id: string } | null;
  if (t) return t.id;
  const r = await db.from('roue_tables').insert({ nom: 'publique', etat: nouvelEtatRoue() }).select('id').single();
  if (r.error?.code === '23505') return tablePublique();
  const id = (ok(r) as { id: string }).id;
  ok(await db.from('roue_secrets').insert({ table_id: id, secret: { grille: null } }));
  return id;
}

async function profil(moi: string) {
  const p = ok(await db.from('profils').select('pseudo, photo_url, xp, banni').eq('id', moi).maybeSingle()) as
    { pseudo: string; photo_url: string | null; xp: number; banni: boolean } | null;
  if (!p) throw new Refus('Profil introuvable.');
  if (p.banni) throw new Refus('Ton compte a été banni.');
  return { id: moi, pseudo: p.pseudo, photo: p.photo_url, niveau: 1 + Math.floor(Math.max(0, p.xp) / 100) };
}

/** Lit, modifie et réécrit la roue (avec reprise si quelqu'un a joué en même temps). Paie les gains une seule fois. */
async function modifier(id: string, f: (e: EtatRoue, s: SecretRoue) => void) {
  for (let essai = 0; essai < 8; essai++) {
    const t = ok(await db.from('roue_tables').select('etat, version').eq('id', id).maybeSingle()) as { etat: EtatRoue; version: number } | null;
    if (!t) throw new Refus('La roue est introuvable.');
    const s = ok(await db.from('roue_secrets').select('secret').eq('table_id', id).maybeSingle()) as { secret: SecretRoue } | null;
    const etat = t.etat, secret = s?.secret ?? { grille: null };
    const avant = etat.phase, manche = etat.manche, echeanceAvant = etat.echeance;
    const empreinte = JSON.stringify(etat) + JSON.stringify(secret);
    f(etat, secret);
    // Rien n'a changé (minuterie pas encore expirée, signe de vie récent) : on n'écrit pas, pour ne pas gêner les autres.
    if (JSON.stringify(etat) + JSON.stringify(secret) === empreinte) return { ok: true };
    const ecrit = ok(await db.rpc('roue_ecrire', { p_table: id, p_version: t.version, p_etat: etat, p_secret: secret })) as boolean;
    if (!ecrit) { await dormir(50 + Math.random() * 120); continue; }
    if (avant !== 'resultats' && etat.phase === 'resultats' && etat.manche === manche) {
      for (const g of gainsRoue(etat)) {
        for (let k = 0; k < 3; k++) {
          const r = await db.rpc('louidors_ajuster', { p_joueur: g.joueur, p_delta: g.montant, p_table: id, p_raison: 'roue-gain' });
          if (!r.error) break;
          console.error('gain', g, r.error);
          await dormir(300);
        }
      }
    }
    // Une seule minuterie par échéance : seulement quand celle-ci vient de changer.
    if (etat.echeance && etat.echeance !== echeanceAvant) enArrierePlan(surveiller(id, etat.echeance));
    return { ok: true };
  }
  throw new Refus('Trop de monde en même temps, réessaie.');
}

/** Fait tourner la roue quand une minuterie expire (si personne ne l'a déjà fait). */
async function surveiller(id: string, echeance: number): Promise<void> {
  const attente = echeance - Date.now() + 200;
  if (attente > 40000) return;
  await dormir(Math.max(0, attente));
  const t = ok(await db.from('roue_tables').select('etat').eq('id', id).maybeSingle()) as { etat: EtatRoue } | null;
  if (!t || t.etat.echeance !== echeance) return;
  await modifier(id, (e, s) => { avancer(e, s, hasard, Date.now()); });
}

async function miser(moi: string, id: string, zones: Record<string, number>) {
  const propres: Partial<Record<Zone, number>> = {};
  for (const z of ZONES) { const v = Number(zones?.[z] ?? 0); if (v) { if (!Number.isInteger(v) || v < 0) throw new Refus('Mise invalide.'); propres[z] = v; } }
  const total = Object.values(propres).reduce((s, v) => s + (v ?? 0), 0);
  if (total <= 0) throw new Refus('Pose au moins un jeton.');
  const p = await profil(moi);
  ok(await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: -total, p_table: id, p_raison: 'roue-mise' }));
  try {
    return await modifier(id, (e) => { miserRoue(e, p, propres, Date.now()); });
  } catch (e) {
    await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: total, p_table: id, p_raison: 'roue-remboursement' });
    throw e;
  }
}

async function retirer(moi: string, id: string) {
  let rendu = 0;
  await modifier(id, (e) => { rendu = retirerMises(e, moi, Date.now()); });
  if (rendu > 0) ok(await db.rpc('louidors_ajuster', { p_joueur: moi, p_delta: rendu, p_table: id, p_raison: 'roue-retrait' }));
  return { ok: true, rendu };
}
