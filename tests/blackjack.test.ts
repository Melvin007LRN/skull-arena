import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  agir, asseoir, assurer, delaiEcoule, evaluer213, evaluerPaires, gains, lever, miser, miseMax, nouvelEtat, nouveauSabot, nouvelleDonne,
  valeurMain, estBlackjack, coutDuCoup, type SecretBJ,
} from '../src/engine/blackjack.ts';

const joueur = (id: string, niveau = 5) => ({ joueur: id, pseudo: id, photo: null, cadre: null, niveau });
/** Sabot truqué : les cartes sortent dans l'ordre donné. */
const secretAvec = (cartes: string[]): SecretBJ => ({ sabot: [...nouveauSabot(1).slice(0, 40), ...[...cartes].reverse()], cachee: null, graine: 1 });

test('valeur des mains et As souples', () => {
  assert.equal(valeurMain(['pique_A', 'coeur_R']).total, 21);
  assert.ok(estBlackjack(['pique_A', 'coeur_R']));
  assert.equal(valeurMain(['pique_A', 'coeur_A', 'trefle_9']).total, 21);
  assert.equal(valeurMain(['pique_R', 'coeur_5', 'trefle_9']).total, 24);
});

test('sabot de 6 jeux, mélangé de façon reproductible', () => {
  assert.equal(nouveauSabot(42).length, 312);
  assert.deepEqual(nouveauSabot(42), nouveauSabot(42));
});

test('mise plafonnée selon le niveau, paris annexes limités à la mise', () => {
  assert.equal(miseMax(1), 75); assert.equal(miseMax(13), 375); assert.equal(miseMax(50), 5000); assert.equal(miseMax(150), 10000);
  const e = nouvelEtat(); const sec = secretAvec([]);
  asseoir(e, joueur('a', 1));
  assert.throws(() => miser(e, 'a', 500, {}, sec, 0), /jusqu’à 75/);
  assert.throws(() => miser(e, 'a', 50, { paires: 60 }, sec, 0), /annexe/);
});

test('paires parfaites et 21+3', () => {
  assert.equal(evaluerPaires(['pique_8', 'pique_8'])?.multiple, 25);
  assert.equal(evaluerPaires(['pique_8', 'trefle_8'])?.multiple, 12);
  assert.equal(evaluerPaires(['pique_8', 'coeur_8'])?.multiple, 5);
  assert.equal(evaluerPaires(['pique_8', 'coeur_9']), null);
  assert.equal(evaluer213(['coeur_7', 'coeur_7', 'coeur_7'])?.multiple, 100);
  assert.equal(evaluer213(['coeur_9', 'coeur_10', 'coeur_V'])?.multiple, 40);
  assert.equal(evaluer213(['coeur_7', 'pique_7', 'trefle_7'])?.multiple, 30);
  assert.equal(evaluer213(['coeur_D', 'pique_R', 'trefle_A'])?.multiple, 10);
  assert.equal(evaluer213(['coeur_2', 'coeur_9', 'coeur_R'])?.multiple, 5);
  assert.equal(evaluer213(['coeur_2', 'pique_9', 'coeur_R']), null);
});

test('solo : gagner contre un croupier qui saute, avec paris annexes', () => {
  const e = nouvelEtat();
  // joueur, croupier visible, joueur, croupier caché, puis tirage du joueur, puis le croupier
  const sec = secretAvec(['pique_8', 'coeur_6', 'trefle_8', 'carreau_10', 'pique_3', 'coeur_9']);
  asseoir(e, joueur('a'));
  const debit = miser(e, 'a', 50, { paires: 10, vingtEtUn: 10 }, sec, 0, true);
  assert.equal(debit, 70);
  assert.equal(e.phase, 'jeu');
  const s = e.sieges[0]!;
  assert.deepEqual(s.resultatsAnnexes!.map((r) => [r.pari, r.gain]), [['paires', 130], ['21+3', 0]]); // paire colorée (pique/trèfle) 12:1
  agir(e, 'a', 'tirer', sec, 0); // 8+8+3 = 19
  agir(e, 'a', 'rester', sec, 0);
  assert.equal(e.phase, 'resultats');
  assert.equal(s.mains[0].resultat, 'gagne'); // croupier 6+10+9 = 25
  assert.deepEqual(gains(e), [{ joueur: 'a', montant: 100 + 130 }]);
  assert.equal(s.dernierGain, 230 - 70);
});

test('séparer une paire puis doubler une des mains', () => {
  const e = nouvelEtat();
  const sec = secretAvec(['pique_8', 'coeur_6', 'trefle_8', 'carreau_10', 'pique_3', 'coeur_2', 'trefle_9', 'carreau_7']);
  asseoir(e, joueur('a'));
  miser(e, 'a', 40, {}, sec, 0, true);
  assert.equal(coutDuCoup(e, 'a', 'separer'), 40);
  agir(e, 'a', 'separer', sec, 0); // mains : 8+3 et 8+2
  const s = e.sieges[0]!;
  assert.equal(s.mains.length, 2);
  assert.throws(() => agir(e, 'a', 'separer', sec, 0), /une seule fois/);
  agir(e, 'a', 'doubler', sec, 0); // 8+3+9 = 20, mise 80
  assert.equal(s.mains[0].mise, 80);
  assert.equal(s.active, 1);
  agir(e, 'a', 'rester', sec, 0); // 8+2 = 10 : reste
  // croupier : 6 + 10 + 7 = 23 → saute
  assert.equal(e.phase, 'resultats');
  assert.deepEqual(s.mains.map((m) => m.resultat), ['gagne', 'gagne']);
  assert.deepEqual(gains(e), [{ joueur: 'a', montant: 160 + 80 }]);
});

test('As séparés : une seule carte chacun', () => {
  const e = nouvelEtat();
  const sec = secretAvec(['pique_A', 'coeur_6', 'trefle_A', 'carreau_10', 'pique_R', 'coeur_5', 'carreau_2']);
  asseoir(e, joueur('a'));
  miser(e, 'a', 20, {}, sec, 0, true);
  agir(e, 'a', 'separer', sec, 0);
  const s = e.sieges[0]!;
  assert.deepEqual(s.mains.map((m) => m.etat), ['reste', 'reste']);
  assert.equal(e.phase, 'resultats'); // A+R = 21 (pas blackjack après séparation), A+5 = 16 ; croupier 6+10+2 = 18
  assert.deepEqual(s.mains.map((m) => m.resultat), ['gagne', 'perdu']);
  assert.equal(s.mains[0].gain, 40);
});

test('assurance : le croupier montre un As et a blackjack', () => {
  const e = nouvelEtat();
  const sec = secretAvec(['pique_10', 'coeur_A', 'trefle_9', 'carreau_R']);
  asseoir(e, joueur('a'));
  miser(e, 'a', 100, {}, sec, 0, true);
  assert.equal(e.phase, 'assurance');
  assert.equal(assurer(e, 'a', true, sec, 0), 50);
  assert.equal(e.phase, 'resultats');
  const s = e.sieges[0]!;
  assert.equal(s.mains[0].resultat, 'perdu');
  assert.deepEqual(gains(e), [{ joueur: 'a', montant: 150 }]); // assurance 2:1 rendue avec sa mise
  assert.equal(s.dernierGain, 0);
});

test('assurance refusée par minuterie, pas de blackjack : on joue', () => {
  const e = nouvelEtat();
  const sec = secretAvec(['pique_10', 'coeur_A', 'trefle_9', 'carreau_6']);
  asseoir(e, joueur('a')); asseoir(e, joueur('b'));
  miser(e, 'a', 30, {}, sec, 0);
  // b ne mise pas : la mise se ferme à l'échéance
  delaiEcoule(e, sec, 15000);
  assert.equal(e.phase, 'assurance');
  delaiEcoule(e, sec, 10 ** 12);
  assert.equal(e.phase, 'jeu');
  assert.equal(e.sieges[0]!.assurance, 0);
});

test('figure visible : le croupier regarde et arrête la donne s’il a blackjack', () => {
  const e = nouvelEtat();
  const sec = secretAvec(['pique_10', 'coeur_R', 'trefle_9', 'carreau_A']);
  asseoir(e, joueur('a'));
  miser(e, 'a', 30, {}, sec, 0, true);
  assert.equal(e.phase, 'resultats');
  assert.equal(e.sieges[0]!.mains[0].resultat, 'perdu');
});

test('minuteries, absences et table complète', () => {
  const e = nouvelEtat(); const sec = secretAvec([]);
  asseoir(e, joueur('a')); asseoir(e, joueur('b'));
  miser(e, 'a', 20, {}, sec, 1000);
  assert.equal(e.echeance, 16000);
  delaiEcoule(e, sec, 16000);
  assert.equal(e.sieges[1]!.absences, 1);
  for (let k = 0; k < 6 && e.phase !== 'resultats'; k++) delaiEcoule(e, sec, 10 ** 12);
  assert.equal(e.phase, 'resultats');
  delaiEcoule(e, sec, Number.MAX_SAFE_INTEGER);
  assert.equal(e.phase, 'mises');
  nouvelleDonne(e);
  lever(e, 'a', sec, 0);
  assert.equal(e.sieges[0], null);
  const f = nouvelEtat();
  for (const id of ['a', 'b', 'c', 'd', 'e']) asseoir(f, joueur(id));
  assert.throws(() => asseoir(f, joueur('z')), /complète/);
});
