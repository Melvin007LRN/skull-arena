// Arbitre de Skull Arena : seul ce serveur modifie les salons et les parties.
// Chaque coup est vérifié avec le moteur de règles (le même que dans les tests) avant d'être accepté.
// Les robots jouent ici aussi, avec des pauses pour que les joueurs suivent la partie.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import {
  creerPartie, appliquer, actionRobot, joueurActif, ErreurRegle, vuePublique, vuePrivee,
  type Action, type EtatPartie,
} from './engine/index.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

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
const INACTIVITE_MS = 120_000; // 2 minutes sans jouer : un robot prend le relais
const PAUSE_FIN_PLI_MS = 4_800; // le temps que les joueurs voient le pli terminé
const PAUSE_ROBOT_MS = 1_100;
const NOMS_ROBOTS = [
  'Barbe-Grise', 'Jack l’Écumeur', 'Anne la Rouge', 'Le Borgne', 'Calico', 'Mary la Brave', 'Long John',
  'Œil-de-Lynx', 'Capitaine Fûtaille', 'La Murène', 'Vieux Corbeau', 'Dents-de-Requin',
];

function reponse(statut: number, corps: unknown) {
  return new Response(JSON.stringify(corps), { status: statut, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// deno-lint-ignore no-explicit-any
function verifier<T>(res: { data: T; error: any }): T {
  if (res.error) throw res.error;
  return res.data;
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

function enArrierePlan(p: Promise<unknown>) {
  const garde = p.catch((e) => console.error('robots', e));
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(garde);
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
    case 'entrainement': return entrainement(moi, Number(c.robots ?? 3));
    case 'rejoindre': return rejoindre(moi, String(c.code ?? ''));
    case 'quitter': return quitter(moi, String(c.salon_id));
    case 'pret': return pret(moi, String(c.salon_id), Boolean(c.pret));
    case 'exclure': return exclure(moi, String(c.salon_id), String(c.joueur_id));
    case 'ajouter_robot': return ajouterRobot(moi, String(c.salon_id));
    case 'retirer_robot': return retirerRobot(moi, String(c.salon_id), String(c.joueur_id));
    case 'lancer': return lancer(moi, String(c.salon_id));
    case 'jouer': return jouer(moi, String(c.partie_id), c.coup);
    case 'reveiller': return reveiller(moi, String(c.partie_id));
    case 'revenir': return revenir(moi, String(c.partie_id));
    case 'abandonner': return abandonner(moi, String(c.partie_id));
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

interface SalonLigne { id: string; code: string; public: boolean; hote: string; statut: string; entrainement: boolean }
interface Membre { joueur_id: string; pseudo: string; est_robot: boolean; pret: boolean; place: number }

async function salon(id: string): Promise<SalonLigne> {
  const s = verifier(await db.from('salons').select('*').eq('id', id).maybeSingle());
  if (!s) throw new Refus("Ce salon n'existe plus.");
  return s as SalonLigne;
}

async function membres(salonId: string): Promise<Membre[]> {
  return verifier(await db.from('salon_joueurs').select('*').eq('salon_id', salonId).order('place')) as Membre[];
}

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
  const humains = (await membres(salonId)).filter((m) => !m.est_robot);
  if (humains.length === 0) {
    verifier(await db.from('salons').delete().eq('id', salonId));
  } else if (s.hote === joueur) {
    verifier(await db.from('salons').update({ hote: humains[0].joueur_id, maj_le: new Date().toISOString() }).eq('id', salonId));
  }
}

function nouveauCode() {
  const octets = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(octets, (o) => ALPHABET_CODE[o % ALPHABET_CODE.length]).join('');
}

async function nouveauSalon(moi: string, estPublic: boolean, entrainementSolo: boolean) {
  const p = await profil(moi);
  await quitterAutresSalonsEnAttente(moi);
  for (let essai = 0; essai < 5; essai++) {
    const code = nouveauCode();
    const res = await db.from('salons').insert({ code, public: estPublic, hote: moi, entrainement: entrainementSolo }).select('id, code').single();
    if (res.error?.code === '23505') continue;
    const s = verifier(res);
    verifier(await db.from('salon_joueurs').insert({
      salon_id: s.id, joueur_id: moi, pseudo: p.pseudo, photo_url: p.photo_url, place: 0, pret: true,
    }));
    return { salon_id: s.id as string, code: s.code as string };
  }
  throw new Refus('Impossible de créer le salon, réessaie.');
}

const creerSalon = (moi: string, estPublic: boolean) => nouveauSalon(moi, estPublic, false);

async function insererRobot(salonId: string, place: number, dejaPris: string[]) {
  const libres = NOMS_ROBOTS.filter((n) => !dejaPris.includes(`🤖 ${n}`));
  const nom = libres[Math.floor(Math.random() * libres.length)] ?? 'Pirate';
  verifier(await db.from('salon_joueurs').insert({
    salon_id: salonId, joueur_id: crypto.randomUUID(), pseudo: `🤖 ${nom}`, photo_url: null, est_robot: true, pret: true, place,
  }));
}

async function entrainement(moi: string, nbRobots: number) {
  const n = Math.max(1, Math.min(7, Math.floor(nbRobots) || 3));
  const s = await nouveauSalon(moi, false, true);
  for (let i = 0; i < n; i++) {
    const pris = (await membres(s.salon_id)).map((m) => m.pseudo);
    await insererRobot(s.salon_id, i + 1, pris);
  }
  await lancer(moi, s.salon_id);
  return s;
}

async function rejoindre(moi: string, codeBrut: string) {
  const code = codeBrut.trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(code)) throw new Refus('Le code fait 6 caractères.');
  const s = verifier(await db.from('salons').select('*').eq('code', code).maybeSingle()) as SalonLigne | null;
  if (!s) throw new Refus('Aucun salon avec ce code.');
  const exclu = verifier(await db.from('salon_exclus').select('joueur_id').eq('salon_id', s.id).eq('joueur_id', moi).maybeSingle());
  if (exclu) throw new Refus("L'hôte t'a exclu de ce salon.");
  const liste = await membres(s.id);
  if (liste.some((m) => m.joueur_id === moi)) return { salon_id: s.id, code: s.code };
  if (s.entrainement) throw new Refus("C'est une partie d'entraînement en solo.");
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
  if (s.statut === 'attente') await retirerDuSalon(moi, salonId);
  return { ok: true };
}

async function pret(moi: string, salonId: string, valeur: boolean) {
  const s = await salon(salonId);
  if (s.statut !== 'attente') throw new Refus('La partie a déjà commencé.');
  verifier(await db.from('salon_joueurs').update({ pret: valeur }).eq('salon_id', salonId).eq('joueur_id', moi));
  return { ok: true };
}

async function ajouterRobot(moi: string, salonId: string) {
  const s = await salon(salonId);
  if (s.hote !== moi) throw new Refus("Seul l'hôte peut ajouter un robot.");
  if (s.statut !== 'attente') throw new Refus('La partie a déjà commencé.');
  const liste = await membres(salonId);
  if (liste.length >= MAX_JOUEURS) throw new Refus('La table est complète (8 joueurs).');
  await insererRobot(salonId, liste.reduce((m, j) => Math.max(m, j.place), -1) + 1, liste.map((m) => m.pseudo));
  verifier(await db.from('salons').update({ maj_le: new Date().toISOString() }).eq('id', salonId));
  return { ok: true };
}

async function retirerRobot(moi: string, salonId: string, joueur: string) {
  const s = await salon(salonId);
  if (s.hote !== moi) throw new Refus("Seul l'hôte peut retirer un robot.");
  if (s.statut !== 'attente') throw new Refus('La partie a déjà commencé.');
  verifier(await db.from('salon_joueurs').delete().eq('salon_id', salonId).eq('joueur_id', joueur).eq('est_robot', true));
  return { ok: true };
}

async function exclure(moi: string, salonId: string, joueur: string) {
  const s = await salon(salonId);
  if (s.hote !== moi) throw new Refus("Seul l'hôte peut exclure un joueur.");
  if (joueur === moi) throw new Refus('Tu ne peux pas t’exclure toi-même.');
  verifier(await db.from('salon_exclus').upsert({ salon_id: salonId, joueur_id: joueur }));
  if (s.statut === 'attente') {
    await retirerDuSalon(joueur, salonId);
    return { ok: true };
  }
  // En pleine partie : un robot le remplace jusqu'à la fin, et cette partie ne comptera pas pour lui.
  const partie = verifier(await db.from('parties').select('id').eq('salon_id', salonId).order('cree_le', { ascending: false }).limit(1).maybeSingle());
  if (!partie) throw new Refus('Partie introuvable.');
  await modifierPartie(partie.id, (etat, extra) => {
    if (!etat.joueurs.includes(joueur) || extra.robots.includes(joueur)) throw new Refus('Ce joueur ne peut pas être exclu.');
    ajouter(extra.remplaces, joueur);
    ajouter(extra.definitifs, joueur);
    ajouter(extra.exclus, joueur);
    return etat;
  });
  enArrierePlan(avancerRobots(partie.id));
  return { ok: true };
}

// ---------- Parties ----------

interface Extra {
  continuer: string[];
  debutManche: string;
  robots: string[]; // sièges tenus par des robots depuis le début
  remplaces: string[]; // humains joués par un robot en ce moment
  definitifs: string[]; // humains remplacés jusqu'à la fin (abandon ou exclusion)
  retours: string[]; // humains revenus : ils reprennent la main à la manche suivante
  abandons: string[];
  exclus: string[];
  humainsAuDepart: number;
  entrainement: boolean;
  annulee: boolean;
  finPliA: number; // horodatage de la fin du dernier pli
}

function ajouter(liste: string[], x: string) {
  if (!liste.includes(x)) liste.push(x);
}

function normaliser(extra: Partial<Extra>): Extra {
  return {
    continuer: [], debutManche: new Date().toISOString(), robots: [], remplaces: [], definitifs: [], retours: [],
    abandons: [], exclus: [], humainsAuDepart: 0, entrainement: false, annulee: false, finPliA: 0, ...extra,
  };
}

const pilotesParRobot = (extra: Extra) => [...extra.robots, ...extra.remplaces];

function vueComplete(etat: EtatPartie, extra: Extra, partieId: string) {
  return {
    ...vuePublique(etat), partieId,
    continuer: extra.continuer, debutManche: extra.debutManche,
    robots: extra.robots, remplaces: extra.remplaces, definitifs: extra.definitifs,
    entrainement: extra.entrainement, annulee: extra.annulee,
  };
}

function vuesPrivees(etat: EtatPartie, extra: Extra) {
  return Object.fromEntries(etat.joueurs.filter((j) => !extra.robots.includes(j)).map((j) => [j, vuePrivee(etat, j)]));
}

/** Passe à la manche suivante quand tous les humains présents ont appuyé sur « Continuer ». */
function peutContinuer(etat: EtatPartie, extra: Extra) {
  const bots = pilotesParRobot(extra);
  return etat.joueurs.every((j) => bots.includes(j) || extra.continuer.includes(j));
}

function continuerManche(etat: EtatPartie, extra: Extra): EtatPartie {
  const suite = appliquer(etat, { type: 'continuer' });
  extra.continuer = [];
  extra.debutManche = new Date().toISOString();
  // Les joueurs revenus reprennent la main au début de cette nouvelle manche.
  extra.remplaces = extra.remplaces.filter((j) => extra.definitifs.includes(j) || !extra.retours.includes(j));
  extra.retours = [];
  return suite;
}

async function ecrire(partieId: string, version: number, etat: EtatPartie, extra: Extra, salonId: string) {
  const termine = etat.phase === 'fin_partie' || extra.annulee;
  const ok = verifier(await db.rpc('ecrire_partie', {
    p_partie: partieId, p_version: version, p_etat: etat, p_extra: extra,
    p_vue: vueComplete(etat, extra, partieId), p_mains: vuesPrivees(etat, extra), p_termine: termine,
  }));
  if (ok && termine) verifier(await db.from('salons').update({ statut: 'terminee' }).eq('id', salonId));
  return ok as boolean;
}

async function charger(partieId: string) {
  const partie = verifier(await db.from('parties').select('version, salon_id, termine, maj_le').eq('id', partieId).maybeSingle());
  if (!partie) throw new Refus('Partie introuvable.');
  const ligne = verifier(await db.from('parties_etat').select('etat, extra').eq('partie_id', partieId).single());
  return {
    version: partie.version as number, salonId: partie.salon_id as string, termine: partie.termine as boolean,
    majLe: new Date(partie.maj_le).getTime(), etat: ligne.etat as EtatPartie, extra: normaliser(ligne.extra),
  };
}

/** Lecture-modification-écriture avec nouvel essai si quelqu'un a joué en même temps. */
async function modifierPartie(partieId: string, fn: (etat: EtatPartie, extra: Extra) => EtatPartie) {
  for (let essai = 0; essai < 5; essai++) {
    const p = await charger(partieId);
    if (p.termine) throw new Refus('La partie est terminée.');
    const avant = p.etat.numeroPli + p.etat.manche * 100;
    const etat = fn(p.etat, p.extra);
    if (etat.numeroPli + etat.manche * 100 !== avant && etat.dernierPli) p.extra.finPliA = Date.now();
    if (await ecrire(partieId, p.version, etat, p.extra, p.salonId)) return;
  }
  throw new Refus('Trop de coups en même temps, réessaie.');
}

async function lancer(moi: string, salonId: string) {
  const s = await salon(salonId);
  if (s.hote !== moi) throw new Refus("Seul l'hôte peut lancer la partie.");
  if (s.statut !== 'attente') throw new Refus('La partie est déjà lancée.');
  const liste = await membres(salonId);
  if (liste.length < 2) throw new Refus('Il faut au moins 2 joueurs (ajoute un robot si besoin).');
  const pasPrets = liste.filter((m) => m.joueur_id !== moi && !m.pret);
  if (pasPrets.length > 0) throw new Refus(`En attente de : ${pasPrets.map((m) => m.pseudo).join(', ')}.`);

  const verrou = verifier(await db.from('salons').update({ statut: 'en_jeu', maj_le: new Date().toISOString() })
    .eq('id', salonId).eq('statut', 'attente').select('id'));
  if (verrou.length === 0) throw new Refus('La partie est déjà lancée.');

  const graine = crypto.getRandomValues(new Uint32Array(1))[0];
  const etat = creerPartie(liste.map((m) => m.joueur_id), graine);
  const robots = liste.filter((m) => m.est_robot).map((m) => m.joueur_id);
  const extra = normaliser({
    robots, humainsAuDepart: liste.length - robots.length, entrainement: s.entrainement,
  });
  const partie = verifier(await db.from('parties').insert({ salon_id: salonId, vue: {} }).select('id').single());
  verifier(await db.from('parties_etat').insert({ partie_id: partie.id, etat, extra }));
  if (!(await ecrire(partie.id, 0, etat, extra, salonId))) throw new Refus('Lancement interrompu, réessaie.');
  enArrierePlan(avancerRobots(partie.id, 3_500)); // laisse passer le décompte de 3 secondes
  return { partie_id: partie.id };
}

// deno-lint-ignore no-explicit-any
async function jouer(moi: string, partieId: string, coup: any) {
  await modifierPartie(partieId, (etat, extra) => {
    if (!etat.joueurs.includes(moi)) throw new Refus('Tu ne joues pas dans cette partie.');
    if (extra.definitifs.includes(moi)) throw new Refus('Un robot joue à ta place jusqu’à la fin de cette partie.');
    if (extra.remplaces.includes(moi)) {
      throw new Refus('Un robot joue à ta place : tu reprends la main à la prochaine manche.');
    }
    if (coup?.type === 'continuer') {
      if (etat.phase !== 'fin_manche') throw new Refus("La manche n'est pas terminée.");
      ajouter(extra.continuer, moi);
      return peutContinuer(etat, extra) ? continuerManche(etat, extra) : etat;
    }
    return appliquer(etat, { ...coup, joueur: moi } as Action); // identité imposée par le serveur
  });
  enArrierePlan(avancerRobots(partieId));
  return { ok: true };
}

/** Un joueur revenu (après une déconnexion) reprend la main à la prochaine manche. */
async function revenir(moi: string, partieId: string) {
  const p = await charger(partieId);
  if (p.termine || !p.extra.remplaces.includes(moi) || p.extra.definitifs.includes(moi) || p.extra.retours.includes(moi)) {
    return { ok: true };
  }
  await modifierPartie(partieId, (etat, extra) => {
    ajouter(extra.retours, moi);
    return etat;
  });
  return { ok: true };
}

/** Quitter volontairement : défaite, et un robot finit la partie à sa place. */
async function abandonner(moi: string, partieId: string) {
  await modifierPartie(partieId, (etat, extra) => {
    if (!etat.joueurs.includes(moi)) throw new Refus('Tu ne joues pas dans cette partie.');
    ajouter(extra.remplaces, moi);
    ajouter(extra.definitifs, moi);
    ajouter(extra.abandons, moi);
    // Plus aucun humain à bord : la partie est annulée et ne compte pas.
    const humains = etat.joueurs.filter((j) => !extra.robots.includes(j));
    if (humains.every((j) => extra.definitifs.includes(j))) extra.annulee = true;
    return etat;
  });
  enArrierePlan(avancerRobots(partieId));
  return { ok: true };
}

/** Joueurs humains dont on attend une action en ce moment. */
function enAttente(etat: EtatPartie, extra: Extra): string[] {
  const bots = pilotesParRobot(extra);
  const humains = etat.joueurs.filter((j) => !bots.includes(j));
  switch (etat.phase) {
    case 'mise': return humains.filter((j) => etat.mises[j] === null);
    case 'jeu': { const a = joueurActif(etat); return a && humains.includes(a) ? [a] : []; }
    case 'pouvoir': return etat.pouvoir && humains.includes(etat.pouvoir.joueur) ? [etat.pouvoir.joueur] : [];
    case 'harry': return humains.filter((j) => etat.harryEnAttente.includes(j));
    case 'fin_manche': return humains.filter((j) => !extra.continuer.includes(j));
    default: return [];
  }
}

/** Appelé régulièrement par les joueurs connectés : remplace les inactifs et relance les robots si besoin. */
async function reveiller(moi: string, partieId: string) {
  const p = await charger(partieId);
  if (p.termine || !p.etat.joueurs.includes(moi)) return { ok: true };
  const inactifs = enAttente(p.etat, p.extra).filter((j) => j !== moi);
  if (inactifs.length > 0 && Date.now() - p.majLe > INACTIVITE_MS) {
    await modifierPartie(partieId, (etat, extra) => {
      for (const j of enAttente(etat, extra)) if (j !== moi) ajouter(extra.remplaces, j);
      return etat;
    });
  }
  enArrierePlan(avancerRobots(partieId));
  return { ok: true };
}

/** Fait jouer les robots tant que c'est à eux, avec des pauses naturelles. */
async function avancerRobots(partieId: string, attenteInitiale = 0) {
  if (attenteInitiale) await dormir(attenteInitiale);
  const debut = Date.now();
  for (let tour = 0; tour < 500 && Date.now() - debut < 110_000; tour++) {
    const p = await charger(partieId);
    if (p.termine) return;
    const { etat, extra } = p;
    let suite: EtatPartie | null = null;
    let pause = 0;

    if (etat.phase === 'fin_manche') {
      if (!peutContinuer(etat, extra)) return; // on attend les humains
      suite = continuerManche(etat, extra);
      pause = 1_500;
    } else {
      const bots = pilotesParRobot(extra);
      let action: Action | null = null;
      for (const j of bots) {
        action = actionRobot(etat, j);
        if (action) break;
      }
      if (!action) return; // c'est à un humain
      suite = appliquer(etat, action);
      if (etat.phase === 'mise') pause = 400;
      else if (etat.phase === 'jeu') {
        // Juste après un pli terminé, on laisse le temps de le voir avant que le robot rejoue.
        const reste = extra.finPliA + PAUSE_FIN_PLI_MS - Date.now();
        pause = Math.max(PAUSE_ROBOT_MS, reste);
      } else pause = 1_200;
    }

    await dormir(pause);
    const avant = etat.numeroPli + etat.manche * 100;
    if (suite.numeroPli + suite.manche * 100 !== avant && suite.dernierPli) extra.finPliA = Date.now();
    await ecrire(partieId, p.version, suite, extra, p.salonId); // si quelqu'un a joué entre-temps, on recharge au tour suivant
  }
}
