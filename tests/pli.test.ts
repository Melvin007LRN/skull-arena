// Tests de la résolution des plis et de l'obligation de suivre la couleur.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resoudrePli, cartesJouables, couleurDemandee, type CarteJouee } from '../src/engine/index.ts';

// Petit raccourci : pli('A:jaune_9', 'B:tigresse=pirate', ...)
function pli(...spec: string[]): CarteJouee[] {
  return spec.map((s) => {
    const [joueur, reste] = s.split(':');
    const [carteId, mode] = reste.split('=');
    return mode ? { joueur, carteId, tigresse: mode as 'pirate' | 'fuite' } : { joueur, carteId };
  });
}
const gagne = (...spec: string[]) => resoudrePli(pli(...spec)).gagnant;

test('la plus haute carte de la couleur demandée gagne', () => {
  assert.equal(gagne('A:jaune_9', 'B:jaune_12', 'C:jaune_3'), 'B');
});

test('une autre couleur ne bat pas la couleur demandée', () => {
  assert.equal(gagne('A:jaune_5', 'B:violet_14', 'C:vert_13'), 'A');
});

test('le noir (atout) bat toutes les couleurs', () => {
  assert.equal(gagne('A:jaune_14', 'B:noir_1', 'C:violet_13'), 'B');
  assert.equal(gagne('A:noir_3', 'B:noir_10', 'C:jaune_14'), 'B');
});

test('Sirène bat les cartes numérotées, même le noir', () => {
  assert.equal(gagne('A:noir_14', 'B:sirene_1', 'C:jaune_2'), 'B');
});

test('Pirate bat la Sirène (+20 par Sirène)', () => {
  const r = resoudrePli(pli('A:sirene_1', 'B:pirate_rosie', 'C:sirene_2'));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 40);
});

test('Skull King bat les Pirates (+30 par Pirate, Tigresse en Pirate comprise)', () => {
  const r = resoudrePli(pli('A:pirate_bendt', 'B:skull_king', 'C:tigresse=pirate', 'D:jaune_4'));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 60);
});

test('Sirène bat le Skull King (+40), même avec des Pirates', () => {
  const r = resoudrePli(pli('A:pirate_harry', 'B:skull_king', 'C:sirene_2'));
  assert.equal(r.gagnant, 'C');
  assert.equal(r.bonus, 40);
});

test('deux cartes spéciales identiques : la première posée gagne', () => {
  assert.equal(gagne('A:pirate_rosie', 'B:pirate_bendt'), 'A');
  assert.equal(gagne('A:sirene_2', 'B:sirene_1', 'C:jaune_8'), 'A');
  assert.equal(gagne('A:tigresse=pirate', 'B:pirate_harry'), 'A');
});

test('la Fuite perd toujours ; uniquement des Fuites : la première posée gagne', () => {
  assert.equal(gagne('A:fuite_1', 'B:jaune_1'), 'B');
  assert.equal(gagne('A:fuite_1', 'B:fuite_2', 'C:butin_1', 'D:tigresse=fuite'), 'A');
});

test('Fuite en tête : la première carte de couleur fixe la couleur', () => {
  const cartes = pli('A:fuite_3', 'B:vert_4');
  assert.equal(couleurDemandee(cartes), 'vert');
  assert.equal(gagne('A:fuite_3', 'B:vert_4', 'C:jaune_13'), 'B');
});

test('personnage en tête : aucune couleur imposée', () => {
  assert.equal(couleurDemandee(pli('A:pirate_rosie')), null);
  assert.equal(couleurDemandee(pli('A:fuite_1', 'B:sirene_1', 'C:jaune_3')), null);
});

test('Kraken et Baleine en tête : la carte de couleur suivante fixe la couleur', () => {
  assert.equal(couleurDemandee(pli('A:kraken', 'B:violet_2')), 'violet');
  assert.equal(couleurDemandee(pli('A:baleine', 'B:fuite_1', 'C:noir_5')), 'noir');
});

test('obligation de suivre la couleur, spéciales toujours jouables', () => {
  const main = ['jaune_3', 'violet_10', 'pirate_rosie', 'fuite_2'];
  const jouables = cartesJouables(main, pli('A:jaune_9'));
  assert.deepEqual(jouables.sort(), ['fuite_2', 'jaune_3', 'pirate_rosie'].sort());
  // sans la couleur demandée : tout est jouable
  assert.deepEqual(cartesJouables(['violet_10', 'vert_1'], pli('A:jaune_9')).sort(), ['vert_1', 'violet_10']);
  // un noir demandé oblige aussi à suivre en noir
  assert.deepEqual(cartesJouables(['noir_2', 'jaune_14'], pli('A:noir_9')), ['noir_2']);
});

test('Kraken : personne ne gagne, celui qui aurait gagné entame', () => {
  const r = resoudrePli(pli('A:jaune_5', 'B:kraken', 'C:jaune_12'));
  assert.equal(r.gagnant, null);
  assert.equal(r.effet, 'kraken');
  assert.equal(r.prochainMeneur, 'C');
  assert.equal(r.pouvoir, null);
});

test('Kraken : pas de bonus, pas d’alliance de Butin, pas de pouvoir', () => {
  const r = resoudrePli(pli('A:sirene_1', 'B:pirate_rosie', 'C:kraken', 'D:butin_1'));
  assert.equal(r.gagnant, null);
  assert.equal(r.bonus, 0);
  assert.deepEqual(r.alliances, []);
  assert.equal(r.pouvoir, null);
  assert.equal(r.prochainMeneur, 'B');
});

test('Baleine : les spéciales sont sans effet, la plus haute carte numérotée gagne, toutes couleurs', () => {
  const r = resoudrePli(pli('A:skull_king', 'B:jaune_9', 'C:baleine', 'D:violet_11', 'E:noir_10'));
  assert.equal(r.gagnant, 'D');
  assert.equal(r.effet, 'baleine');
  assert.equal(r.pouvoir, null);
});

test('Baleine : à valeur égale, la première posée gagne', () => {
  assert.equal(gagne('A:violet_7', 'B:baleine', 'C:jaune_7', 'D:noir_7'), 'A');
});

test('Baleine avec uniquement des spéciales : pli défaussé, le joueur de la Baleine entame', () => {
  const r = resoudrePli(pli('A:pirate_bendt', 'B:baleine', 'C:sirene_1'));
  assert.equal(r.gagnant, null);
  assert.equal(r.prochainMeneur, 'B');
});

test('Baleine : les 14 capturés comptent, mais pas les bonus de personnages', () => {
  const r = resoudrePli(pli('A:skull_king', 'B:pirate_rosie', 'C:baleine', 'D:noir_14', 'E:jaune_14'));
  assert.equal(r.gagnant, 'D');
  assert.equal(r.bonus, 30);
});

test('Kraken puis Baleine : seul l’effet de la seconde posée s’applique (Baleine)', () => {
  const r = resoudrePli(pli('A:kraken', 'B:jaune_3', 'C:baleine', 'D:vert_6'));
  assert.equal(r.effet, 'baleine');
  assert.equal(r.gagnant, 'D');
});

test('Baleine puis Kraken : seul l’effet de la seconde posée s’applique (Kraken)', () => {
  const r = resoudrePli(pli('A:baleine', 'B:jaune_3', 'C:kraken', 'D:jaune_6'));
  assert.equal(r.effet, 'kraken');
  assert.equal(r.gagnant, null);
  assert.equal(r.prochainMeneur, 'D');
});

test('bonus des 14 : +10 par 14 de couleur, +20 pour le 14 noir', () => {
  const r = resoudrePli(pli('A:jaune_14', 'B:noir_14', 'C:violet_14'));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 40);
});

test('Butin : alliance entre le joueur du Butin et le gagnant', () => {
  const r = resoudrePli(pli('A:butin_1', 'B:jaune_10', 'C:butin_2'));
  assert.equal(r.gagnant, 'B');
  assert.deepEqual(r.alliances, [['A', 'B'], ['C', 'B']]);
});

test('Butin gagné par son propre joueur : pas d’alliance avec soi-même', () => {
  const r = resoudrePli(pli('A:butin_1', 'B:fuite_1'));
  assert.equal(r.gagnant, 'A');
  assert.deepEqual(r.alliances, []);
});

test('Tigresse en Fuite perd, en Pirate gagne', () => {
  assert.equal(gagne('A:tigresse=fuite', 'B:jaune_2'), 'B');
  assert.equal(gagne('A:jaune_2', 'B:tigresse=pirate'), 'B');
});

test('pouvoir activé seulement quand le pirate gagne le pli (jamais la Tigresse)', () => {
  assert.equal(resoudrePli(pli('A:pirate_juanita', 'B:jaune_2')).pouvoir, 'juanita');
  assert.equal(resoudrePli(pli('A:pirate_juanita', 'B:skull_king')).pouvoir, null);
  assert.equal(resoudrePli(pli('A:tigresse=pirate', 'B:jaune_2')).pouvoir, null);
  assert.equal(resoudrePli(pli('A:pirate_rosie', 'B:pirate_harry')).pouvoir, 'rosie');
});

test('plusieurs pirates : le premier posé l’emporte (Tigresse en Pirate comprise)', () => {
  assert.equal(gagne('A:pirate_rosie', 'B:pirate_harry', 'C:pirate_bendt'), 'A');
  assert.equal(gagne('A:jaune_5', 'B:pirate_juanita', 'C:pirate_rascal', 'D:noir_14'), 'B');
  assert.equal(gagne('A:pirate_rosie', 'B:tigresse=pirate'), 'A');
  assert.equal(gagne('A:tigresse=pirate', 'B:pirate_rosie'), 'A');
  assert.equal(gagne('A:pirate_rosie', 'B:sirene_1', 'C:pirate_harry'), 'A');
  assert.equal(gagne('A:pirate_rosie', 'B:pirate_harry', 'C:skull_king'), 'C');
});
