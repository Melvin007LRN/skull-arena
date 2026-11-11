// Tests du déroulé d'une partie : distribution, mises, pouvoirs, score de manche.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerPartie, appliquer, calculerScoreJoueur, classement, cartesAutorisees, joueurActif,
  ErreurRegle, type EtatPartie, type Action,
} from '../src/engine/index.ts';

const J3 = ['A', 'B', 'C'];

/** Prépare une manche avec des mains choisies (le reste du paquet ne sert qu'à Bendt et Juanita). */
function avecMains(etat: EtatPartie, mains: Record<string, string[]>, nonDistribuees: string[] = []): EtatPartie {
  const e = structuredClone(etat);
  e.mains = structuredClone(mains);
  e.cartesParJoueur = Object.values(mains)[0].length;
  e.nonDistribuees = nonDistribuees;
  return e;
}
function suite(etat: EtatPartie, ...actions: Action[]): EtatPartie {
  return actions.reduce(appliquer, etat);
}
const mise = (joueur: string, m: number): Action => ({ type: 'miser', joueur, mise: m });
const joue = (joueur: string, carteId: string, tigresse?: 'pirate' | 'fuite'): Action => ({ type: 'jouer', joueur, carteId, tigresse });

test('distribution : N cartes à la manche N, toutes différentes', () => {
  const e = creerPartie(['A', 'B', 'C', 'D'], 42);
  assert.equal(e.manche, 1);
  assert.equal(e.cartesParJoueur, 1);
  for (const j of e.joueurs) assert.equal(e.mains[j].length, 1);
  const toutes = [...Object.values(e.mains).flat(), ...e.nonDistribuees];
  assert.equal(toutes.length, 74);
  assert.equal(new Set(toutes).size, 74);
});

test('à 8 joueurs, la manche 10 se joue avec 9 cartes', () => {
  let e = creerPartie(['1', '2', '3', '4', '5', '6', '7', '8'], 7);
  e = structuredClone(e);
  e.manche = 9;
  e.phase = 'fin_manche';
  e = appliquer(e, { type: 'continuer' });
  assert.equal(e.manche, 10);
  assert.equal(e.cartesParJoueur, 9);
  assert.equal(e.nonDistribuees.length, 2);
});

test('couronne : tirée au sort, le joueur suivant entame, elle tourne à chaque manche', () => {
  const e = creerPartie(['A', 'B', 'C', 'D'], 123);
  const c = e.couronne;
  assert.equal(e.meneur, e.joueurs[(c + 1) % 4]);
  let f = structuredClone(e);
  f.phase = 'fin_manche';
  f = appliquer(f, { type: 'continuer' });
  assert.equal(f.couronne, (c + 1) % 4);
  assert.equal(f.meneur, f.joueurs[(c + 2) % 4]);
});

test('mises secrètes : verrouillées, et le jeu commence quand tout le monde a misé', () => {
  let e = creerPartie(J3, 1);
  e = appliquer(e, mise('A', 1));
  assert.equal(e.phase, 'mise');
  assert.throws(() => appliquer(e, mise('A', 0)), ErreurRegle);
  assert.throws(() => appliquer(e, mise('B', 2)), ErreurRegle); // manche 1 : mise de 0 à 1
  e = suite(e, mise('B', 0), mise('C', 1));
  assert.equal(e.phase, 'jeu');
});

test('on ne peut pas jouer hors de son tour ni une carte interdite', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['jaune_5', 'violet_1'], B: ['jaune_2', 'violet_9'], C: ['vert_3', 'noir_1'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 0), mise('C', 1));
  assert.throws(() => appliquer(e, joue('B', 'jaune_2')), ErreurRegle);
  e = appliquer(e, joue('A', 'jaune_5'));
  assert.deepEqual(cartesAutorisees(e, 'B'), ['jaune_2']);
  assert.throws(() => appliquer(e, joue('B', 'violet_9')), ErreurRegle);
});

test('la Tigresse exige de choisir Pirate ou Fuite', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['tigresse'], B: ['jaune_2'], C: ['vert_3'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 0), mise('C', 0));
  assert.throws(() => appliquer(e, joue('A', 'tigresse')), ErreurRegle);
  e = suite(e, joue('A', 'tigresse', 'pirate'), joue('B', 'jaune_2'), joue('C', 'vert_3'));
  assert.equal(e.phase, 'fin_manche');
  assert.equal(e.plisGagnes.A, 1);
});

test('score : mise réussie, ratée, mise de 0', () => {
  assert.equal(calculerScoreJoueur({ manche: 5, mise: 3, plis: 3, bonus: 0, alliances: 0, rascal: 0 }).total, 60);
  assert.equal(calculerScoreJoueur({ manche: 5, mise: 3, plis: 1, bonus: 30, alliances: 20, rascal: 0 }).total, -20);
  assert.equal(calculerScoreJoueur({ manche: 7, mise: 0, plis: 0, bonus: 0, alliances: 0, rascal: 0 }).total, 70);
  assert.equal(calculerScoreJoueur({ manche: 7, mise: 0, plis: 2, bonus: 0, alliances: 0, rascal: 0 }).total, -70);
});

test('score : les bonus ne comptent que si la mise est exacte', () => {
  assert.equal(calculerScoreJoueur({ manche: 3, mise: 1, plis: 1, bonus: 40, alliances: 20, rascal: 20 }).total, 100);
  assert.equal(calculerScoreJoueur({ manche: 3, mise: 2, plis: 1, bonus: 40, alliances: 20, rascal: 20 }).total, -30);
});

test('manche complète avec bonus Sirène contre Skull King', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['skull_king'], B: ['sirene_1'], C: ['jaune_4'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 0), mise('B', 1), mise('C', 0), joue('A', 'skull_king'), joue('B', 'sirene_1'), joue('C', 'jaune_4'));
  assert.equal(e.phase, 'fin_manche');
  const s = Object.fromEntries(e.historique[0].map((r) => [r.joueur, r.total]));
  assert.deepEqual(s, { A: 10, B: 60, C: 10 }); // B : 20 + 40 de bonus
});

test('alliance de Butin : +20 chacun seulement si les deux réussissent', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['butin_1', 'jaune_1'], B: ['jaune_10', 'jaune_2'], C: ['fuite_1', 'fuite_2'] });
  e.manche = 2;
  e.meneur = 'A';
  e = suite(e, mise('A', 0), mise('B', 2), mise('C', 0),
    joue('A', 'butin_1'), joue('B', 'jaune_10'), joue('C', 'fuite_1'),
    joue('B', 'jaune_2'), joue('C', 'fuite_2'), joue('A', 'jaune_1'));
  const s = Object.fromEntries(e.historique[0].map((r) => [r.joueur, r]));
  assert.equal(s.A.plis, 0);
  assert.equal(s.B.plis, 2);
  assert.equal(s.A.total, 20 + 20); // mise 0 réussie en manche 2 + alliance
  assert.equal(s.B.total, 40 + 20);
});

test('Rosie choisit qui entame (elle peut se choisir)', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_rosie', 'jaune_1'], B: ['jaune_9', 'jaune_2'], C: ['vert_3', 'vert_4'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 1), mise('C', 0), joue('A', 'pirate_rosie'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  assert.equal(e.phase, 'pouvoir');
  assert.throws(() => appliquer(e, { type: 'rosie', joueur: 'B', choix: 'C' }), ErreurRegle);
  e = appliquer(e, { type: 'rosie', joueur: 'A', choix: 'C' });
  assert.equal(e.phase, 'jeu');
  assert.equal(joueurActif(e), 'C');
});

test('Rosie sur le dernier pli : pas de choix, la manche se termine', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_rosie'], B: ['jaune_9'], C: ['vert_3'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 0), mise('C', 0), joue('A', 'pirate_rosie'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  assert.equal(e.phase, 'fin_manche');
});

test('Bendt pioche 2 cartes puis en défausse 2', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_bendt', 'jaune_1'], B: ['jaune_9', 'jaune_2'], C: ['vert_3', 'vert_4'] }, ['noir_14', 'sirene_2', 'violet_5']);
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 1), mise('C', 0), joue('A', 'pirate_bendt'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  assert.equal(e.phase, 'pouvoir');
  assert.deepEqual(e.mains.A.sort(), ['jaune_1', 'noir_14', 'sirene_2']);
  assert.throws(() => appliquer(e, { type: 'bendt', joueur: 'A', defausse: ['jaune_1'] }), ErreurRegle);
  e = appliquer(e, { type: 'bendt', joueur: 'A', defausse: ['jaune_1', 'sirene_2'] });
  assert.deepEqual(e.mains.A, ['noir_14']);
  assert.deepEqual(e.nonDistribuees, ['violet_5']);
});

test('Bendt sans cartes non distribuées : sans effet', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_bendt', 'jaune_1'], B: ['jaune_9', 'jaune_2'], C: ['vert_3', 'vert_4'] }, []);
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 1), mise('C', 0), joue('A', 'pirate_bendt'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  assert.equal(e.phase, 'jeu');
  assert.equal(e.mains.A.length, 1);
});

test('Bendt avec une seule carte non distribuée : pioche 1, défausse 1', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_bendt', 'jaune_1'], B: ['jaune_9', 'jaune_2'], C: ['vert_3', 'vert_4'] }, ['noir_2']);
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 1), mise('C', 0), joue('A', 'pirate_bendt'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  e = appliquer(e, { type: 'bendt', joueur: 'A', defausse: ['jaune_1'] });
  assert.deepEqual(e.mains.A, ['noir_2']);
});

test('Rascal : pari gagné si la mise est exacte, perdu sinon', () => {
  const base = () => {
    let e = creerPartie(J3, 1);
    e = avecMains(e, { A: ['pirate_rascal', 'jaune_1'], B: ['jaune_9', 'jaune_12'], C: ['vert_3', 'vert_4'] });
    e.manche = 2;
    e.meneur = 'A';
    return suite(e, mise('A', 1), mise('B', 1), mise('C', 0), joue('A', 'pirate_rascal'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  };
  let e = appliquer(base(), { type: 'rascal', joueur: 'A', pari: 20 });
  e = suite(e, joue('A', 'jaune_1'), joue('B', 'jaune_12'), joue('C', 'vert_4'));
  assert.equal(e.historique[0].find((r) => r.joueur === 'A')!.total, 20 + 20);
  assert.throws(() => appliquer(base(), { type: 'rascal', joueur: 'A', pari: 15 as 10 }), ErreurRegle);
});

test('Juanita voit les cartes non distribuées, en secret', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_juanita', 'jaune_1'], B: ['jaune_9', 'jaune_2'], C: ['vert_3', 'vert_4'] }, ['noir_7', 'kraken']);
  e.meneur = 'A';
  e = suite(e, mise('A', 1), mise('B', 1), mise('C', 0), joue('A', 'pirate_juanita'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  assert.deepEqual(e.revelationJuanita, { joueur: 'A', cartes: ['noir_7', 'kraken'] });
  assert.equal(e.phase, 'jeu');
});

test('Harry modifie sa mise de ±1 en fin de manche, même s’il gagne le dernier pli', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['jaune_1', 'pirate_harry'], B: ['jaune_9', 'jaune_2'], C: ['vert_3', 'vert_4'] });
  e.manche = 2;
  e.meneur = 'A';
  e = suite(e, mise('A', 2), mise('B', 1), mise('C', 0),
    joue('A', 'jaune_1'), joue('B', 'jaune_9'), joue('C', 'vert_3'),
    joue('B', 'jaune_2'), joue('C', 'vert_4'), joue('A', 'pirate_harry'));
  assert.equal(e.phase, 'harry');
  e = appliquer(e, { type: 'harry', joueur: 'A', ajustement: -1 });
  assert.equal(e.phase, 'fin_manche');
  const a = e.historique[0].find((r) => r.joueur === 'A')!;
  assert.equal(a.mise, 1);
  assert.equal(a.total, 20);
});

test('Harry ne peut pas descendre sous 0', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['pirate_harry'], B: ['jaune_9'], C: ['vert_3'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 0), mise('B', 0), mise('C', 0), joue('A', 'pirate_harry'), joue('B', 'jaune_9'), joue('C', 'vert_3'));
  assert.throws(() => appliquer(e, { type: 'harry', joueur: 'A', ajustement: -1 }), ErreurRegle);
  e = appliquer(e, { type: 'harry', joueur: 'A', ajustement: 1 });
  assert.equal(e.historique[0].find((r) => r.joueur === 'A')!.total, 20);
});

test('Kraken : le pli ne compte pour personne', () => {
  let e = creerPartie(J3, 1);
  e = avecMains(e, { A: ['jaune_5'], B: ['kraken'], C: ['jaune_12'] });
  e.meneur = 'A';
  e = suite(e, mise('A', 0), mise('B', 0), mise('C', 1), joue('A', 'jaune_5'), joue('B', 'kraken'), joue('C', 'jaune_12'));
  const s = Object.fromEntries(e.historique[0].map((r) => [r.joueur, r]));
  assert.equal(s.C.plis, 0);
  assert.equal(s.C.total, -10);
  assert.equal(s.A.total, 10);
});

test('fin de partie après la manche 10 et classement avec égalités', () => {
  let e = creerPartie(J3, 1);
  e = structuredClone(e);
  e.manche = 10;
  e.phase = 'fin_manche';
  e.scores = { A: 120, B: 120, C: 40 };
  e = appliquer(e, { type: 'continuer' });
  assert.equal(e.phase, 'fin_partie');
  assert.deepEqual(classement(e).map((c) => c.place), [1, 1, 3]);
});

test('vues : la vue publique ne montre ni les mains ni les mises avant la révélation', async () => {
  const { vuePublique, vuePrivee } = await import('../src/engine/index.ts');
  let e = creerPartie(J3, 5);
  e = appliquer(e, mise('A', 1));
  const v = vuePublique(e);
  assert.equal(v.mises, null);
  assert.deepEqual(v.aMise, { A: true, B: false, C: false });
  const texte = JSON.stringify(v);
  for (const j of J3) for (const c of e.mains[j]) assert.ok(!texte.includes(`"${c}"`), 'aucune carte en main visible');
  for (const c of e.nonDistribuees) assert.ok(!texte.includes(`"${c}"`), 'paquet invisible');
  e = suite(e, mise('B', 0), mise('C', 1));
  assert.deepEqual(vuePublique(e).mises, { A: 1, B: 0, C: 1 });
  assert.deepEqual(vuePrivee(e, 'B').main, e.mains.B);
});

test('variante : les bonus comptent même si la mise est ratée', async () => {
  const { calculerScoreJoueur } = await import('../src/engine/partie.ts');
  const normal = calculerScoreJoueur({ manche: 3, mise: 2, plis: 1, bonus: 30, alliances: 0, rascal: 0 });
  const variante = calculerScoreJoueur({ manche: 3, mise: 2, plis: 1, bonus: 30, alliances: 0, rascal: 0, bonusToujours: true });
  assert.equal(normal.total, -10);
  assert.equal(variante.total, 20);
  assert.equal(variante.bonus, 30);
});
