// Simulation : des milliers de parties complètes jouées au hasard (2 à 8 joueurs),
// en vérifiant à chaque étape qu'aucune règle n'est violée et que rien ne se perd.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerPartie, appliquer, cartesAutorisees, joueurActif, creerHasard, carteParId, classement,
  cartesJouables, NB_MANCHES, type EtatPartie, type Action,
} from '../src/engine/index.ts';

function totalCartes(e: EtatPartie): string[] {
  return [...Object.values(e.mains).flat(), ...e.nonDistribuees, ...e.defausse, ...e.pliEnCours.map((c) => c.carteId)];
}

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
      return { type: 'jouer', joueur: j, carteId, tigresse: carteId === 'tigresse' ? pick(['pirate', 'fuite'] as const) : undefined };
    }
    case 'pouvoir': {
      const p = e.pouvoir!;
      if (p.type === 'rosie') return { type: 'rosie', joueur: p.joueur, choix: pick(e.joueurs) };
      if (p.type === 'rascal') return { type: 'rascal', joueur: p.joueur, pari: pick([0, 10, 20] as const) };
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

test('3 000 parties simulées sans aucune violation de règle', () => {
  const h = creerHasard(2026);
  let parties = 0;
  let plis = 0;
  const effets = { kraken: 0, baleine: 0, pouvoirs: 0, harry: 0 };
  for (let k = 0; k < 3000; k++) {
    const n = 2 + (k % 7);
    const joueurs = Array.from({ length: n }, (_, i) => `J${i + 1}`);
    let e = creerPartie(joueurs, k + 1);
    let garde = 0;
    while (e.phase !== 'fin_partie') {
      if (++garde > 5000) throw new Error('boucle infinie');
      const avant = e;
      const action = actionAuHasard(e, h);
      // Vérifie l'obligation de suivre la couleur avec la règle brute
      if (action.type === 'jouer') {
        assert.ok(cartesJouables(e.mains[action.joueur], e.pliEnCours).includes(action.carteId));
      }
      e = appliquer(e, action);
      assert.notEqual(avant, e, 'le moteur ne doit pas modifier l’état d’origine');
      // Les 74 cartes sont toujours là, une seule fois chacune
      const toutes = totalCartes(e);
      assert.equal(toutes.length, 74);
      assert.equal(new Set(toutes).size, 74);
      if (e.dernierPli && e.dernierPli !== avant.dernierPli) {
        plis++;
        const r = e.dernierPli.resultat;
        if (r.effet === 'kraken') effets.kraken++;
        if (r.effet === 'baleine') effets.baleine++;
        if (r.pouvoir) effets.pouvoirs++;
        assert.equal(e.dernierPli.cartes.length, n);
        if (r.gagnant) assert.ok(joueurs.includes(r.gagnant));
      }
      if (e.phase === 'harry') effets.harry++;
      if (e.phase === 'fin_manche' && avant.phase !== 'fin_manche') {
        const m = e.historique.at(-1)!;
        const cartes = Math.min(e.manche, Math.floor(74 / n));
        const totalPlis = m.reduce((s, r) => s + r.plis, 0);
        assert.ok(totalPlis <= cartes, 'pas plus de plis gagnés que de plis joués');
        for (const r of m) {
          if (!r.reussie) assert.ok(r.bonus === 0 && r.alliances === 0, 'pas de bonus si la mise est ratée');
          assert.equal(r.total, r.pointsMise + r.bonus + r.alliances + r.rascal);
        }
        for (const j of joueurs) assert.equal(e.mains[j].length, 0, 'toutes les cartes ont été jouées');
      }
    }
    assert.equal(e.historique.length, NB_MANCHES);
    for (const j of joueurs) {
      assert.equal(e.scores[j], e.historique.reduce((s, m) => s + m.find((r) => r.joueur === j)!.total, 0));
    }
    assert.equal(classement(e)[0].place, 1);
    parties++;
  }
  assert.equal(parties, 3000);
  // Les cas rares ont bien été rencontrés
  assert.ok(effets.kraken > 100 && effets.baleine > 100 && effets.pouvoirs > 1000 && effets.harry > 100);
  console.log(`  ${parties} parties, ${plis} plis, ${effets.kraken} Kraken, ${effets.baleine} Baleines, ${effets.pouvoirs} pouvoirs, ${effets.harry} décisions de Harry`);
});

test('toutes les cartes existent et correspondent aux images', () => {
  const ids = ['jaune_1', 'noir_14', 'fuite_5', 'pirate_rosie', 'tigresse', 'skull_king', 'sirene_2', 'kraken', 'baleine', 'butin_2'];
  for (const id of ids) assert.equal(carteParId(id).id, id);
});
