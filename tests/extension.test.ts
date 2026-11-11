// Règles de l'extension : 7 et 8, 0/14, Joker 15, Second, Mary Thorne, Raie, Davy Jones, Planche, Dernière salve.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerPartie, appliquer, cartesAutorisees, joueurActif, creerHasard, resoudrePli, actionRobot, classement,
  creerPaquet, cartesParJoueur, NB_MANCHES, type EtatPartie, type Action, type CarteJouee,
} from '../src/engine/index.ts';

const pli = (...c: Array<[string, string, Partial<CarteJouee>?]>): CarteJouee[] =>
  c.map(([joueur, carteId, plus]) => ({ joueur, carteId, ...plus }));

test('paquet : 93 cartes avec l’extension, 10 manches complètes à 8 joueurs', () => {
  const p = creerPaquet(true);
  assert.equal(p.length, 93);
  assert.equal(new Set(p.map((c) => c.id)).size, 93);
  assert.equal(creerPaquet().length, 74);
  assert.equal(cartesParJoueur(10, 8, true), 10);
  assert.equal(cartesParJoueur(10, 8), 9);
});

test('9 joueurs : possible seulement avec l’extension, 10 cartes à la dernière manche', () => {
  const neuf = Array.from({ length: 9 }, (_, i) => `J${i}`);
  assert.throws(() => creerPartie(neuf, 1));
  let e = creerPartie(neuf, 1, { extension: true });
  assert.equal(e.joueurs.length, 9);
  while (e.manche < 10) { e = structuredClone(e); e.phase = 'fin_manche'; e = appliquer(e, { type: 'continuer' }); }
  assert.equal(e.cartesParJoueur, 10);
  assert.equal(e.nonDistribuees.length, 3);
});

test('7 et 8 : -5 / +5 au gagnant ; à égalité, la première posée gagne', () => {
  let r = resoudrePli(pli(['A', 'jaune_8x'], ['B', 'jaune_2']));
  assert.equal(r.gagnant, 'A');
  assert.equal(r.bonus, 5);
  r = resoudrePli(pli(['A', 'jaune_3'], ['B', 'jaune_7x']));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, -5);
  r = resoudrePli(pli(['A', 'vert_7'], ['B', 'vert_7x']));
  assert.equal(r.gagnant, 'A');
  assert.equal(r.bonus, -5);
});

test('0/14 : la valeur choisie compte, sans bonus', () => {
  let r = resoudrePli(pli(['A', 'jaune_13'], ['B', 'jaune_0_14', { valeur: 14 }]));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 0);
  r = resoudrePli(pli(['A', 'jaune_1'], ['B', 'jaune_0_14', { valeur: 0 }]));
  assert.equal(r.gagnant, 'A');
  r = resoudrePli(pli(['A', 'noir_0_14', { valeur: 14 }], ['B', 'noir_13']));
  assert.equal(r.gagnant, 'A');
  assert.equal(r.bonus, 0);
});

test('Joker 15 : prend la couleur demandée, perd contre le noir', () => {
  let r = resoudrePli(pli(['A', 'violet_14'], ['B', 'joker_15', { couleur: 'violet' }]));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 10);
  r = resoudrePli(pli(['A', 'noir_1'], ['B', 'joker_15']));
  assert.equal(r.gagnant, 'A');
  r = resoudrePli(pli(['A', 'fuite_1'], ['B', 'joker_15', { couleur: 'vert' }], ['C', 'vert_14']));
  assert.equal(r.gagnant, 'B');
});

test('Joker 15 : choix de couleur obligatoire seulement si la couleur est libre', () => {
  let e = partieAvec({ A: ['joker_15', 'jaune_1'], B: ['jaune_3', 'jaune_4'], C: ['vert_1', 'vert_2'] }, 'A');
  assert.throws(() => appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'joker_15' }));
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'joker_15', couleur: 'vert' });
  assert.equal(e.pliEnCours[0].couleur, 'vert');
  assert.deepEqual(cartesAutorisees(e, 'B'), ['jaune_3', 'jaune_4']); // pas de vert : B joue ce qu'il veut
  let f = partieAvec({ A: ['jaune_9', 'jaune_1'], B: ['joker_15', 'jaune_4'], C: ['vert_1', 'vert_2'] }, 'A');
  f = appliquer(f, { type: 'jouer', joueur: 'A', carteId: 'jaune_9' });
  assert.ok(cartesAutorisees(f, 'B').includes('joker_15'), 'le 15 se pose toujours');
  f = appliquer(f, { type: 'jouer', joueur: 'B', carteId: 'joker_15', couleur: 'violet' });
  assert.equal(f.pliEnCours[1].couleur, 'jaune', 'il prend la couleur demandée');
});

test('Le Second : bat les Pirates, perd contre la Sirène et le Skull King (+30)', () => {
  let r = resoudrePli(pli(['A', 'pirate_rosie'], ['B', 'second']));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 0, 'pas de bonus de capture pour le Second');
  assert.deepEqual(r.pouvoirs, ['rosie'], 'il prend le pouvoir du Pirate capturé');
  r = resoudrePli(pli(['A', 'pirate_rosie'], ['B', 'second'], ['C', 'sirene_1']));
  assert.equal(r.gagnant, 'C');
  assert.equal(r.bonus, 30, 'une Sirène qui prend un Pirate ne gagne rien, le Second capturé +30');
  r = resoudrePli(pli(['A', 'second'], ['B', 'skull_king']));
  assert.equal(r.gagnant, 'B');
  assert.equal(r.bonus, 30);
  r = resoudrePli(pli(['A', 'second'], ['B', 'skull_king'], ['C', 'sirene_2']));
  assert.equal(r.gagnant, 'C');
  assert.equal(r.bonus, 40 + 30);
  r = resoudrePli(pli(['A', 'pirate_bendt'], ['B', 'second'], ['C', 'pirate_mary']));
  assert.deepEqual(r.pouvoirs, ['bendt', 'mary']);
});

test('Raie tachetée : la plus petite carte numérotée gagne', () => {
  let r = resoudrePli(pli(['A', 'pirate_rosie'], ['B', 'jaune_5'], ['C', 'raie'], ['D', 'noir_3']));
  assert.equal(r.effet, 'raie');
  assert.equal(r.gagnant, 'D');
  r = resoudrePli(pli(['A', 'jaune_4'], ['B', 'raie'], ['C', 'vert_4']));
  assert.equal(r.gagnant, 'A', 'égalité : la première posée');
  r = resoudrePli(pli(['A', 'skull_king'], ['B', 'raie']));
  assert.equal(r.gagnant, null);
  r = resoudrePli(pli(['A', 'jaune_9'], ['B', 'kraken'], ['C', 'raie'], ['D', 'jaune_2']));
  assert.equal(r.effet, 'raie', 'le dernier léviathan décide');
  r = resoudrePli(pli(['A', 'jaune_9'], ['B', 'raie'], ['C', 'baleine'], ['D', 'jaune_2']));
  assert.equal(r.effet, 'baleine');
  assert.equal(r.gagnant, 'A');
});

test('Casier de Davy Jones : détruit les léviathans, +20 chacun pour celui qui l’a posé', () => {
  const r = resoudrePli(pli(['A', 'jaune_5'], ['B', 'kraken'], ['C', 'davy_jones'], ['D', 'jaune_9'], ['E', 'raie']));
  assert.equal(r.effet, 'normal');
  assert.equal(r.gagnant, 'D');
  assert.equal(r.bonus, 0, 'le gagnant du pli ne touche pas le bonus du Casier');
  assert.deepEqual(r.davy, { joueur: 'C', points: 40 });
  assert.deepEqual(r.detruits, [1, 4]);
  const s = resoudrePli(pli(['A', 'jaune_5'], ['B', 'davy_jones']));
  assert.equal(s.gagnant, 'A', 'sans léviathan il ne fait rien et ne gagne pas');
});

test('Supplice de la planche : le Pirate retiré ne compte plus', () => {
  const r = resoudrePli(pli(['A', 'pirate_rosie'], ['B', 'jaune_9'], ['C', 'planche'], ['D', 'jaune_12']), 0);
  assert.equal(r.gagnant, 'D');
  assert.equal(r.pouvoir, null);
  const s = resoudrePli(pli(['A', 'pirate_rosie'], ['B', 'pirate_bendt'], ['C', 'planche']), 0);
  assert.equal(s.gagnant, 'B', 'le premier Pirate restant gagne');
  const t = resoudrePli(pli(['A', 'skull_king'], ['B', 'pirate_bendt'], ['C', 'planche']), 1);
  assert.equal(t.bonus, 0, 'le Pirate retiré ne rapporte rien au Skull King');
});

/** Partie de 3 joueurs en cours de jeu, avec des mains choisies. */
function partieAvec(mains: Record<string, string[]>, meneur: string): EtatPartie {
  const joueurs = Object.keys(mains);
  let e = creerPartie(joueurs, 7, { extension: true });
  const n = Object.values(mains)[0].length;
  e = { ...e, manche: n, cartesParJoueur: n, mains: structuredClone(mains), meneur, phase: 'mise' };
  for (const j of joueurs) e = appliquer(e, { type: 'miser', joueur: j, mise: 0 });
  return e;
}

test('Planche : choix du Pirate quand il y en a plusieurs', () => {
  let e = partieAvec({ A: ['pirate_rosie', 'jaune_1'], B: ['pirate_harry', 'jaune_2'], C: ['planche', 'jaune_3'] }, 'A');
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'pirate_rosie' });
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: 'pirate_harry' });
  e = appliquer(e, { type: 'jouer', joueur: 'C', carteId: 'planche' });
  assert.equal(e.phase, 'pouvoir');
  assert.deepEqual(e.pouvoir, { type: 'planche', joueur: 'C', pirates: [0, 1] });
  assert.throws(() => appliquer(e, { type: 'planche', joueur: 'A', index: 0 }));
  e = appliquer(e, { type: 'planche', joueur: 'C', index: 0 });
  assert.equal(e.dernierPli!.resultat.gagnant, 'B');
  assert.equal(e.dernierPli!.resultat.retire, 0);
});

test('Dernière salve : une carte de plus, puis on passe le dernier pli', () => {
  let e = partieAvec({ A: ['salve', 'jaune_1', 'jaune_2'], B: ['jaune_9', 'vert_1', 'vert_3'], C: ['jaune_5', 'vert_2', 'vert_4'] }, 'A');
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'salve' });
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: 'jaune_9' });
  e = appliquer(e, { type: 'jouer', joueur: 'C', carteId: 'jaune_5' });
  assert.equal(joueurActif(e), 'A', 'A tire sa deuxième carte');
  assert.deepEqual(cartesAutorisees(e, 'A'), ['jaune_1', 'jaune_2'], 'elle suit la couleur');
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'jaune_2' });
  assert.equal(e.dernierPli!.cartes.length, 4);
  assert.equal(e.dernierPli!.resultat.gagnant, 'B');
  // Pli 2 : B mène, tout le monde joue
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: 'vert_1' });
  e = appliquer(e, { type: 'jouer', joueur: 'C', carteId: 'vert_2' });
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'jaune_1' });
  assert.equal(e.mains.A.length, 0);
  // Pli 3 : A n'a plus de carte, il passe son tour
  assert.equal(joueurActif(e), 'C');
  e = appliquer(e, { type: 'jouer', joueur: 'C', carteId: 'vert_4' });
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: 'vert_3' });
  assert.equal(e.phase, 'fin_manche');
  assert.equal(e.dernierPli!.cartes.length, 2);
});

test('Mary Thorne : la carte prise doit être posée au pli suivant', () => {
  let e = partieAvec({ A: ['pirate_mary', 'jaune_1', 'jaune_2'], B: ['jaune_9', 'vert_1', 'noir_3'], C: ['jaune_5', 'vert_2', 'vert_4'] }, 'A');
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'pirate_mary' });
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: 'jaune_9' });
  e = appliquer(e, { type: 'jouer', joueur: 'C', carteId: 'jaune_5' });
  assert.equal(e.phase, 'pouvoir');
  assert.equal(e.pouvoir!.type, 'mary');
  e = appliquer(e, { type: 'mary', joueur: 'A', cible: 'B' });
  const imposee = e.imposee!.carteId;
  assert.ok(['vert_1', 'noir_3'].includes(imposee));
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'jaune_1' });
  assert.deepEqual(cartesAutorisees(e, 'B'), [imposee], 'même sans suivre la couleur');
  const autre = imposee === 'vert_1' ? 'noir_3' : 'vert_1';
  assert.throws(() => appliquer(e, { type: 'jouer', joueur: 'B', carteId: autre }));
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: imposee });
  assert.equal(e.imposee, null);
});

test('Le Second enchaîne les pouvoirs des Pirates capturés', () => {
  let e = partieAvec({ A: ['pirate_rosie', 'jaune_1', 'jaune_2'], B: ['second', 'vert_1', 'noir_3'], C: ['pirate_rascal', 'vert_2', 'vert_4'] }, 'A');
  e = appliquer(e, { type: 'jouer', joueur: 'A', carteId: 'pirate_rosie' });
  e = appliquer(e, { type: 'jouer', joueur: 'B', carteId: 'second' });
  e = appliquer(e, { type: 'jouer', joueur: 'C', carteId: 'pirate_rascal' });
  assert.deepEqual(e.pouvoir, { type: 'rosie', joueur: 'B' });
  e = appliquer(e, { type: 'rosie', joueur: 'B', choix: 'C' });
  assert.deepEqual(e.pouvoir, { type: 'rascal', joueur: 'B' });
  e = appliquer(e, { type: 'rascal', joueur: 'B', pari: 10 });
  assert.equal(e.phase, 'jeu');
  assert.equal(joueurActif(e), 'C');
});

function actionAuHasard(e: EtatPartie, h: () => number): Action {
  const pick = <T>(l: readonly T[]) => l[Math.floor(h() * l.length)];
  switch (e.phase) {
    case 'mise': {
      const j = e.joueurs.find((x) => e.mises[x] === null)!;
      return { type: 'miser', joueur: j, mise: Math.floor(h() * (e.cartesParJoueur + 1)) };
    }
    case 'jeu': {
      const j = joueurActif(e)!;
      const carteId = pick(cartesAutorisees(e, j));
      return {
        type: 'jouer', joueur: j, carteId,
        tigresse: carteId === 'tigresse' ? pick(['pirate', 'fuite'] as const) : undefined,
        valeur: carteId.endsWith('_0_14') ? pick([0, 14] as const) : undefined,
        couleur: carteId === 'joker_15' ? pick(['jaune', 'violet', 'vert'] as const) : undefined,
      };
    }
    case 'pouvoir': {
      const p = e.pouvoir!;
      if (p.type === 'rosie') return { type: 'rosie', joueur: p.joueur, choix: pick(e.joueurs) };
      if (p.type === 'rascal') return { type: 'rascal', joueur: p.joueur, pari: pick([0, 10, 20] as const) };
      if (p.type === 'mary') return { type: 'mary', joueur: p.joueur, cible: pick(p.cibles) };
      if (p.type === 'planche') return { type: 'planche', joueur: p.joueur, index: pick(p.pirates) };
      const main = [...e.mains[p.joueur]].sort(() => h() - 0.5);
      return { type: 'bendt', joueur: p.joueur, defausse: main.slice(0, p.aDefausser) };
    }
    case 'harry': {
      const j = e.harryEnAttente[0];
      const base = (e.mises[j] ?? 0) + e.harry[j];
      return { type: 'harry', joueur: j, ajustement: base === 0 ? pick([0, 1] as const) : pick([-1, 0, 1] as const) };
    }
    case 'fin_manche':
      return { type: 'continuer' };
    case 'fin_partie':
      throw new Error('partie finie');
  }
}

function simuler(nb: number, robots: boolean) {
  const h = creerHasard(77);
  const vus = { raie: 0, davy: 0, planche: 0, salve: 0, mary: 0, second: 0 };
  for (let k = 0; k < nb; k++) {
    const n = 2 + (k % 8); // jusqu'à 9 joueurs avec l'extension
    const joueurs = Array.from({ length: n }, (_, i) => `J${i + 1}`);
    let e = creerPartie(joueurs, 1000 + k, { extension: true });
    let garde = 0;
    while (e.phase !== 'fin_partie') {
      if (++garde > 8000) throw new Error('boucle infinie');
      const avant = e;
      let action: Action | null = null;
      if (robots) {
        for (const j of joueurs) { action = actionRobot(e, j); if (action) break; }
        action ??= { type: 'continuer' };
      } else action = actionAuHasard(e, h);
      if (action.type === 'jouer') assert.ok(cartesAutorisees(e, action.joueur).includes(action.carteId));
      e = appliquer(e, action);
      const toutes = [...Object.values(e.mains).flat(), ...e.nonDistribuees, ...e.defausse, ...e.pliEnCours.map((c) => c.carteId)];
      assert.equal(toutes.length, 93);
      assert.equal(new Set(toutes).size, 93);
      if (e.pouvoir?.type === 'mary' && avant.pouvoir?.type !== 'mary') vus.mary++;
      if (e.dernierPli && e.dernierPli !== avant.dernierPli) {
        const ids = e.dernierPli.cartes.map((c) => c.carteId);
        if (ids.includes('raie')) vus.raie++;
        if (e.dernierPli.resultat.detruits.length) vus.davy++;
        if (e.dernierPli.resultat.retire !== null) vus.planche++;
        if (ids.includes('salve')) vus.salve++;
        if (ids.includes('second')) vus.second++;
      }
      if (e.phase === 'fin_manche' && avant.phase !== 'fin_manche') {
        for (const r of e.historique.at(-1)!) {
          if (!r.reussie) assert.ok(r.bonus === 0 && r.alliances === 0);
          assert.equal(r.total, r.pointsMise + r.bonus + r.alliances + r.rascal);
        }
        for (const j of joueurs) assert.equal(e.mains[j].length, 0);
      }
    }
    assert.equal(e.historique.length, NB_MANCHES);
    assert.equal(classement(e)[0].place, 1);
  }
  return vus;
}

test('600 parties simulées au hasard avec l’extension', () => {
  const v = simuler(600, false);
  console.log('  ', v);
  for (const [k, x] of Object.entries(v)) assert.ok(x > 20, `${k} rencontré`);
});

test('150 parties jouées par les robots avec l’extension', () => {
  const v = simuler(150, true);
  console.log('  ', v);
});
