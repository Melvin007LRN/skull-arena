// Arbitre de Skull Arena : seul ce serveur modifie les salons et les parties.
// Chaque coup est vérifié avec le moteur de règles (le même que dans les tests) avant d'être accepté.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  creerPartie, appliquer, ErreurRegle, vuePublique, vuePrivee, type Action, type EtatPartie,
} from './engine/index.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

class Refus extends Error {}

const MAX_JOUEURS = 8;
const ALPHABET_CODE = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function reponse(statut: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// deno-lint-ignore no-explicit-any
function verifier<T>(res: { data: T; error: any }): T {
  if (res.error) throw res.error;
  return res.data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const jeton = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: auth } = await db.auth.getUser(jeton);
    const moi = auth?.user?.id;
    if (!moi) throw new Refus('Connecte-toi pour jouer.');
    const corps = await req.json();
    return reponse(200, await traiter(moi, corps));
  } catch (e) {
    if (e instanceof Refus || e instanceof ErreurRegle) return reponse(400, { erreur: e.message });
    console.error(e);
    return reponse(500, { erreur: 'Le serveur a rencontré un problème. Réessaie.' });
  }
});

// deno-lint-ignore no-explicit-any
async function traiter(moi: string, c: any): Promise<unknown> {
  switch (c?.action) {
    case 'creer_salon': return creerSalon(moi, Boolean(c.public));
    case 'rejoindre': return rejoindre(moi, String(c.code ?? ''));
    case 'quitter': return quitter(moi, String(c.salon_id));
    case 'pret': return pret(moi, String(c.salon_id), Boolean(c.pret));
    case 'exclure': return exclure(moi, String(c.salon_id), String(c.joueur_id));
    case 'lancer': return lancer(moi, String(c.salon_id));
    case 'jouer': return jouer(moi, String(c.partie_id), c.coup);
    default: throw new Refus('Action inconnue.');
  }
}

// ---------- Profils et salons ----------

async function profil(moi: string) {
  const p = verifier(await db.from('profils').select('pseudo, photo_url, banni').eq('id', moi).maybeSingle());
  if (!p) throw new Refus('Profil introuvable.');
  if (p.banni) throw new Refus('Ton compte a été banni.');
  return p as { pseudo: string; photo_url: string | null };
}

async function salon(id: string) {
  const s = verifier(await db.from('salons').select('*').eq('id', id).maybeSingle());
  if (!s) throw new Refus("Ce salon n'existe plus.");
  return s as { id: string; code: string; public: boolean; hote: string; statut: string };
}

async function membres(salonId: string) {
  return verifier(await db.from('salon_joueurs').select('*').eq('salon_id', salonId).order('place')) as Array<{
    joueur_id: string; pseudo: string; est_robot: boolean; pret: boolean; place: number;
  }>;
}

/** Un joueur ne peut attendre que dans un seul salon à la fois : on le retire des autres salons en attente. */
async function quitterAutresSalonsEnAttente(moi: string, sauf?: string) {
  const miens = verifier(await db.from('salon_joueurs').select('salon_id, salons!inner(statut)').eq('joueur_id', moi)) as Array<{
    salon_id: string; salons: { statut: string };
  }>;
  for (const m of miens) {
    if (m.salon_id !== sauf && m.salons.statut === 'attente') await retirerDuSalon(moi, m.salon_id);
  }
}

async function retirerDuSalon(joueur: string, salonId: string) {
  verifier(await db.from('salon_joueurs').delete().eq('salon_id', salonId).eq('joueur_id', joueur));
  const s = await salon(salonId);
  const restants = (await membres(salonId)).filter((m) => !m.est_robot);
  if (restants.length === 0) {
    verifier(await db.from('salons').delete().eq('id', salonId));
  } else if (s.hote === joueur) {
    verifier(await db.from('salons').update({ hote: restants[0].joueur_id, maj_le: new Date().toISOString() }).eq('id', salonId));
  }
}

function nouveauCode() {
  const octets = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(octets, (o) => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
}

async function creerSalon(moi: string, estPublic: boolean) {
  const p = await profil(moi);
  await quitterAutresSalonsEnAttente(moi);
  for (let essai = 0; essai < 5; essai++) {
    const code = nouveauCode();
    const res = await db.from('salons').insert({ code, public: estPublic, hote: moi }).select('id, code').single();
    if (res.error?.code === '23505') continue; // code déjà pris, on en tire un autre
    const s = verifier(res);
    verifier(await db.from('salon_joueurs').insert({
      salon_id: s.id, joueur_id: moi, pseudo: p.pseudo, photo_url: p.photo_url, place: 0, pret: true,
    }));
    return { salon_id: s.id, code: s.code };
  }
  throw new Refus('Impossible de créer le salon, réessaie.');
}

async function rejoindre(moi: string, codeBrut: string) {
  const code = codeBrut.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Refus('Le code fait 6 caractères.');
  const s = verifier(await db.from('salons').select('*').eq('code', code).maybeSingle());
  if (!s) throw new Refus('Aucun salon avec ce code.');
  const exclu = verifier(await db.from('salon_exclus').select('joueur_id').eq('salon_id', s.id).eq('joueur_id', moi).maybeSingle());
  if (exclu) throw new Refus("L'hôte t'a exclu de ce salon.");
  const liste = await membres(s.id);
  if (liste.some((m) => m.joueur_id === moi)) return { salon_id: s.id, code: s.code }; // déjà dedans (retour après déconnexion)
  if (s.statut === 'en_jeu') throw new Refus('La partie a déjà commencé.');
  if (s.statut === 'terminee') throw new Refus('Cette partie est terminée.');
  if (liste.length >= MAX_JOUEURS) throw new Refus('Ce salon est complet (8 joueurs).');
  const p = await profil(moi);
  await quitterAutresSalonsEnAttente(moi, s.id);
  const place = liste.reduce((m, j) => Math.max(m, j.place), -1) + 1;
  verifier(await db.from('salon_joueurs').insert({ salon_id: s.id, joueur_id: moi, pseudo: p.pseudo, photo_url: p.photo_url, place }));
  verifier(await db.from('salons').update({ maj_le: new Date().toISOString() }).eq('id', s.id));
  return { salon_id: s.id, code: s.code };
}

async function quitter(moi: string, salonId: string) {
  const s = await salon(salonId);
  // En pleine partie, on garde sa place pour pouvoir revenir (le remplacement par un robot arrive à l'étape suivante).
  if (s.statut === 'attente') await retirerDuSalon(moi, salonId);
  return { ok: true };
}

async function pret(moi: string, salonId: string, valeur: boolean) {
  const s = await salon(salonId);
  if (s.statut !== 'attente') throw new Refus('La partie a déjà commencé.');
  verifier(await db.from('salon_joueurs').update({ pret: valeur }).eq('salon_id', salonId).eq('joueur_id', moi));
  return { ok: true };
}

async function exclure(moi: string, salonId: string, joueur: string) {
  const s = await salon(salonId);
  if (s.hote !== moi) throw new Refus("Seul l'hôte peut exclure un joueur.");
  if (joueur === moi) throw new Refus('Tu ne peux pas t’exclure toi-même.');
  if (s.statut !== 'attente') throw new Refus("L'exclusion en pleine partie arrive avec les robots.");
  verifier(await db.from('salon_exclus').upsert({ salon_id: salonId, joueur_id: joueur }));
  await retirerDuSalon(joueur, salonId);
  return { ok: true };
}

// ---------- Parties ----------

interface Extra {
  continuer: string[];
  debutManche: string;
}

function vueComplete(etat: EtatPartie, extra: Extra, partieId: string) {
  return { ...vuePublique(etat), continuer: extra.continuer, debutManche: extra.debutManche, partieId };
}

function vuesPrivees(etat: EtatPartie) {
  return Object.fromEntries(etat.joueurs.map((j) => [j, vuePrivee(etat, j)]));
}

async function lancer(moi: string, salonId: string) {
  const s = await salon(salonId);
  if (s.hote !== moi) throw new Refus("Seul l'hôte peut lancer la partie.");
  if (s.statut !== 'attente') throw new Refus('La partie est déjà lancée.');
  const liste = await membres(salonId);
  if (liste.length < 2) throw new Refus('Il faut au moins 2 joueurs.');
  const pasPrets = liste.filter((m) => m.joueur_id !== moi && !m.pret);
  if (pasPrets.length > 0) throw new Refus(`En attente de : ${pasPrets.map((m) => m.pseudo).join(', ')}.`);

  // Le salon passe "en jeu" d'abord, pour qu'un double appui ne lance pas deux parties.
  const verrou = verifier(await db.from('salons').update({ statut: 'en_jeu', maj_le: new Date().toISOString() })
    .eq('id', salonId).eq('statut', 'attente').select('id'));
  if (verrou.length === 0) throw new Refus('La partie est déjà lancée.');

  const graine = crypto.getRandomValues(new Uint32Array(1))[0];
  const etat = creerPartie(liste.map((m) => m.joueur_id), graine);
  const extra: Extra = { continuer: [], debutManche: new Date().toISOString() };
  const partie = verifier(await db.from('parties').insert({ salon_id: salonId, vue: {} }).select('id').single());
  verifier(await db.from('parties_etat').insert({ partie_id: partie.id, etat, extra }));
  const ok = verifier(await db.rpc('ecrire_partie', {
    p_partie: partie.id, p_version: 0, p_etat: etat, p_extra: extra,
    p_vue: vueComplete(etat, extra, partie.id), p_mains: vuesPrivees(etat), p_termine: false,
  }));
  if (!ok) throw new Refus('Lancement interrompu, réessaie.');
  return { partie_id: partie.id };
}

// deno-lint-ignore no-explicit-any
async function jouer(moi: string, partieId: string, coup: any) {
  for (let essai = 0; essai < 4; essai++) {
    const partie = verifier(await db.from('parties').select('version, salon_id, termine').eq('id', partieId).maybeSingle());
    if (!partie) throw new Refus('Partie introuvable.');
    if (partie.termine) throw new Refus('La partie est terminée.');
    const ligne = verifier(await db.from('parties_etat').select('etat, extra').eq('partie_id', partieId).single());
    let etat = ligne.etat as EtatPartie;
    const extra = ligne.extra as Extra;
    if (!etat.joueurs.includes(moi)) throw new Refus("Tu ne joues pas dans cette partie.");

    if (coup?.type === 'continuer') {
      if (etat.phase !== 'fin_manche') throw new Refus("La manche n'est pas terminée.");
      if (!extra.continuer.includes(moi)) extra.continuer.push(moi);
      if (etat.joueurs.every((j) => extra.continuer.includes(j))) {
        etat = appliquer(etat, { type: 'continuer' });
        extra.continuer = [];
        extra.debutManche = new Date().toISOString();
      }
    } else {
      // Le joueur ne peut agir qu'en son nom : on ignore toute autre identité envoyée.
      const action = { ...coup, joueur: moi } as Action;
      etat = appliquer(etat, action);
    }

    const termine = etat.phase === 'fin_partie';
    const ok = verifier(await db.rpc('ecrire_partie', {
      p_partie: partieId, p_version: partie.version, p_etat: etat, p_extra: extra,
      p_vue: vueComplete(etat, extra, partieId), p_mains: vuesPrivees(etat), p_termine: termine,
    }));
    if (ok) {
      if (termine) verifier(await db.from('salons').update({ statut: 'terminee' }).eq('id', partie.salon_id));
      return { ok: true };
    }
    // Un autre joueur a joué au même moment : on recharge et on réessaie.
  }
  throw new Refus('Trop de coups en même temps, réessaie.');
}
