import { test } from 'node:test';
import assert from 'node:assert/strict';
import { agir, asseoir, delaiEcoule, gains, miser, miseMax, nouvelEtat, nouveauSabot, valeurMain, estBlackjack, type SecretBJ, nouvelleDonne, lever } from '../src/engine/blackjack.ts';

const joueur = (id: string, niveau = 5) => ({ joueur: id, pseudo: id, photo: null, cadre: null, niveau });
const secretAvec = (cartes: string[]): SecretBJ => ({ sabot: [...nouveauSabot(1).slice(0, 40), ...[...cartes].reverse()], cachee: null, graine: 1 });

test('valeur des mains et As souples', () => {
  assert.equal(valeurMain(['pique_A', 'coeur_R']).total, 21);
  assert.ok(estBlackjack(['pique_A', 'coeur_R']));
  assert.equal(valeurMain(['pique_A', 'coeur_A', 'trefle_9']).total, 21);
  assert.equal(valeurMain(['pique_A', 'coeur_5']).souple, true);
  assert.equal(valeurMain(['pique_R', 'coeur_5', 'trefle_9']).total, 24);
});

test('sabot de 6 jeux, mélangé de façon reproductible', () => {
  const s = nouveauSabot(42);
  assert.equal(s.length, 312);
  assert.deepEqual(s, nouveauSabot(42));
  assert.notDeepEqual(s, nouveauSabot(43));
});

test('mise plafonnée selon le niveau', () => {
  assert.equal(miseMax(1), 75);
  assert.equal(miseMax(13), 375);
  assert.equal(miseMax(50), 5000);
  assert.equal(miseMax(150), 10000);
  const e = nouvelEtat(); const sec = secretAvec([]);
  asseoir(e, joueur('a', 1));
  assert.throws(() => miser(e, 'a', 500, sec, 0), /jusqu’à 75/);
  assert.throws(() => miser(e, 'a', 5, sec, 0), /minimale/);
});

test('solo : une main gagnée contre un croupier qui saute', () => {
  const e = nouvelEtat();
  // ordre de tirage : joueur, croupier visible, joueur, croupier caché, puis le joueur tire, puis le croupier
  const sec = secretAvec(['pique_10', 'coeur_6', 'trefle_7', 'carreau_10', 'pique_3', 'coeur_9']);
  asseoir(e, joueur('a'));
  miser(e, 'a', 50, sec, 0, true);
  assert.equal(e.phase, 'jeu');
  assert.equal(e.croupier.cartes.length, 1);
  agir(e, 'a', 'tirer', sec, 0); // 10+7+3 = 20
  agir(e, 'a', 'rester', sec, 0);
  assert.equal(e.phase, 'resultats');
  assert.deepEqual(e.croupier.cartes, ['coeur_6', 'carreau_10', 'coeur_9']); // 25 : sauté
  assert.equal(e.sieges[0]!.main!.resultat, 'gagne');
  assert.deepEqual(gains(e), [{ joueur: 'a', montant: 100 }]);
});

test('blackjack payé 3 contre 2, doubler double la mise', () => {
  const e = nouvelEtat();
  const sec = secretAvec(['pique_A', 'trefle_5', 'carreau_9', 'coeur_R', 'carreau_2', 'pique_8', 'coeur_10']);
  asseoir(e, joueur('a')); asseoir(e, joueur('b'));
  miser(e, 'a', 100, sec, 0);
  assert.equal(e.phase, 'mises');
  miser(e, 'b', 40, sec, 0);
  assert.equal(e.phase, 'jeu');
  assert.equal(e.sieges[0]!.main!.etat, 'blackjack'); // A + R
  assert.equal(e.tour, 1); // b : 5 + 2 = 7
  const { supplement } = agir(e, 'b', 'doubler', sec, 0); // + 10 = 17
  assert.equal(supplement, 40);
  // croupier : 9 + 8 = 17, reste
  assert.equal(e.phase, 'resultats');
  assert.equal(e.sieges[0]!.main!.gain, 250);
  assert.equal(e.sieges[1]!.main!.resultat, 'egalite');
  assert.equal(e.sieges[1]!.main!.gain, 80);
});

test('minuteries : mises closes, tour passé, nouvelle donne', () => {
  const e = nouvelEtat(); const sec = secretAvec([]);
  asseoir(e, joueur('a')); asseoir(e, joueur('b'));
  miser(e, 'a', 20, sec, 1000);
  assert.equal(e.echeance, 16000);
  assert.equal(delaiEcoule(e, sec, 5000), false);
  assert.equal(delaiEcoule(e, sec, 16000), true);
  assert.equal(e.sieges[1]!.absences, 1);
  if (e.phase === 'jeu') { delaiEcoule(e, sec, 999999); }
  assert.equal(e.phase, 'resultats');
  delaiEcoule(e, sec, Number.MAX_SAFE_INTEGER);
  assert.equal(e.phase, 'mises');
  assert.equal(e.sieges[0]!.mise, 0);
  nouvelleDonne(e);
  lever(e, 'a', sec, 0);
  assert.equal(e.sieges[0], null);
});

test('table complète à 5', () => {
  const e = nouvelEtat();
  for (const id of ['a', 'b', 'c', 'd', 'e']) asseoir(e, joueur(id));
  assert.throws(() => asseoir(e, joueur('f')), /complète/);
});
