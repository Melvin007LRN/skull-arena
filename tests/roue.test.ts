import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  avancer, CASES, choisir, esperance, gainsRoue, miserRoue, nouvelEtatRoue, retirerMises, signaler, ZONES,
  type EtatRoue, type SecretRoue, type Zone,
} from '../src/engine/roue.ts';

function hasard(graine: number) {
  let s = graine >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const J = (id: string, niveau = 200) => ({ id, pseudo: id, photo: null, niveau });

test('la roue a 54 cases dans les bonnes proportions', () => {
  const n = (z: Zone) => CASES.filter((c) => c === z).length;
  assert.equal(CASES.length, 54);
  assert.deepEqual(ZONES.map(n), [21, 13, 7, 4, 4, 2, 2, 1]);
});

test('chaque case rend environ 95 % des mises (calcul exact)', () => {
  for (const z of ZONES) {
    const e = esperance(z);
    assert.ok(e > 0.92 && e < 0.975, `${z} : ${e.toFixed(4)}`);
  }
});

/** Joue un tour complet ; renvoie l'état final et le tirage. */
function jouerTour(e: EtatRoue, s: SecretRoue, h: () => number, t0: number) {
  let t = t0;
  for (let i = 0; i < 12 && e.phase !== 'resultats'; i++) { t = (e.echeance ?? t) + 1; avancer(e, s, h, t); }
  return t;
}

test('simulation : le retour moyen reste proche de 95 % sur chaque case', () => {
  const h = hasard(42);
  const mise: Record<Zone, number> = { '1': 0, '2': 0, '5': 0, '10': 0, piece: 0, abysses: 0, chasse: 0, tempete: 0 };
  const rendu = { ...mise };
  let t = 1000;
  for (let tour = 0; tour < 150000; tour++) {
    const e = nouvelEtatRoue(); const s: SecretRoue = { grille: null };
    signaler(e, 'a', t);
    miserRoue(e, J('a'), Object.fromEntries(ZONES.map((z) => [z, 10])), t);
    t = jouerTour(e, s, h, t);
    const z = CASES[e.arret!];
    for (const zz of ZONES) mise[zz] += 10;
    rendu[z] += e.gains.a ?? 0;
  }
  for (const z of ZONES) {
    const r = rendu[z] / mise[z];
    const tol = z === 'tempete' ? 0.2 : z === 'chasse' || z === 'abysses' ? 0.1 : 0.04;
    assert.ok(Math.abs(r - 0.95) < tol, `${z} : ${r.toFixed(3)}`);
  }
});

test('une mise sur 5 qui sort paie 6 fois la mise (sans Boussole)', () => {
  const e = nouvelEtatRoue(); const s: SecretRoue = { grille: null };
  miserRoue(e, J('a'), { '5': 20 }, 0);
  avancer(e, s, () => 0.99, e.echeance!); // Boussole : aucune case
  e.boussole = { zone: null, mult: 1 };
  avancer(e, s, () => 3 / 54 + 0.001, e.echeance!); // arrêt sur la case 3 = « 5 »
  assert.equal(CASES[e.arret!], '5');
  avancer(e, s, Math.random, e.echeance!);
  assert.equal(e.phase, 'resultats');
  assert.deepEqual(gainsRoue(e), [{ joueur: 'a', montant: 120 }]);
});

test('la Boussole multiplie la case qu’elle désigne', () => {
  const e = nouvelEtatRoue(); const s: SecretRoue = { grille: null };
  miserRoue(e, J('a'), { '2': 10, '1': 10 }, 0);
  avancer(e, s, Math.random, e.echeance!);
  e.boussole = { zone: '2', mult: 10 };
  avancer(e, s, () => 1 / 54 + 0.001, e.echeance!); // case 1 = « 2 »
  avancer(e, s, Math.random, e.echeance!);
  assert.equal(e.gains.a, 10 * 2 * 10 + 10);
});

test('mise max par case selon le niveau, et retrait possible pendant les mises', () => {
  const e = nouvelEtatRoue();
  assert.throws(() => miserRoue(e, J('a', 1), { '1': 100 }, 0), /Mise max/);
  miserRoue(e, J('a', 1), { '1': 75 }, 0);
  assert.equal(retirerMises(e, 'a', 10), 75);
  assert.equal(e.mises.a, undefined);
});

test('Chasse au trésor : choix d’une croix, grille secrète révélée ensuite', () => {
  const e = nouvelEtatRoue(); const s: SecretRoue = { grille: null };
  miserRoue(e, J('a'), { chasse: 10 }, 0); miserRoue(e, J('b'), { chasse: 10 }, 0);
  avancer(e, s, Math.random, e.echeance!); e.boussole = { zone: null, mult: 1 };
  avancer(e, s, () => 17 / 54 + 0.001, e.echeance!);
  assert.equal(CASES[e.arret!], 'chasse');
  avancer(e, s, Math.random, e.echeance!);
  assert.equal(e.bonus?.type, 'chasse');
  assert.equal((e.bonus as { grille: number[] | null }).grille, null, 'la grille reste cachée pendant le choix');
  choisir(e, 'a', 7, e.debut + 100);
  assert.throws(() => choisir(e, 'c', 3, e.debut + 100), /pas misé/);
  avancer(e, s, Math.random, e.echeance!);
  const g = (e.bonus as { grille: number[] }).grille;
  assert.equal(g.length, 24);
  avancer(e, s, Math.random, e.echeance!);
  assert.equal(e.gains.a, 10 * g[7] + 10);
  assert.ok(e.gains.b > 10, 'le joueur sans choix reçoit une croix au hasard');
});

test('Tempête : chaque drapeau donne son multiplicateur', () => {
  const e = nouvelEtatRoue(); const s: SecretRoue = { grille: null };
  miserRoue(e, J('a'), { tempete: 10 }, 0);
  avancer(e, s, Math.random, e.echeance!); e.boussole = { zone: null, mult: 1 };
  avancer(e, s, () => 31 / 54 + 0.001, e.echeance!);
  assert.equal(CASES[e.arret!], 'tempete');
  avancer(e, s, Math.random, e.echeance!);
  choisir(e, 'a', 'or', e.debut + 10);
  avancer(e, s, Math.random, e.echeance!);
  avancer(e, s, Math.random, e.echeance!);
  assert.equal(e.phase, 'resultats');
  assert.ok(e.gains.a >= 10 * 10 + 10);
});

test('sans personne, la roue se met en attente après les résultats', () => {
  const e = nouvelEtatRoue(); const s: SecretRoue = { grille: null };
  miserRoue(e, J('a'), { '1': 10 }, 0);
  const t = jouerTour(e, s, hasard(3), 0);
  avancer(e, s, Math.random, t + 200000);
  assert.equal(e.phase, 'attente');
});
