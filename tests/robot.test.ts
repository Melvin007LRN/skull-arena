// Les robots jouent toujours des coups valides et battent nettement des joueurs qui jouent au hasard.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  creerPartie, appliquer, actionRobot, cartesAutorisees, joueurActif, creerHasard, type Action, type EtatPartie,
} from '../src/engine/index.ts';

function auHasard(e: EtatPartie, j: string, h: () => number): Action | null {
  const pick = <T>(l: readonly T[]) => l[Math.floor(h() * l.length)];
  if (e.phase === 'mise') return e.mises[j] === null ? { type: 'miser', joueur: j, mise: Math.floor(h() * (e.cartesParJoueur + 1)) } : null;
  if (e.phase === 'jeu') {
    if (joueurActif(e) !== j) return null;
    const c = pick(cartesAutorisees(e, j));
    return { type: 'jouer', joueur: j, carteId: c, tigresse: c === 'tigresse' ? pick(['pirate', 'fuite'] as const) : undefined };
  }
  if (e.phase === 'pouvoir' && e.pouvoir?.joueur === j) {
    const p = e.pouvoir;
    if (p.type === 'rosie') return { type: 'rosie', joueur: j, choix: pick(e.joueurs) };
    if (p.type === 'rascal') return { type: 'rascal', joueur: j, pari: 0 };
    return { type: 'bendt', joueur: j, defausse: e.mains[j].slice(0, p.aDefausser) };
  }
  if (e.phase === 'harry' && e.harryEnAttente.includes(j)) return { type: 'harry', joueur: j, ajustement: 0 };
  return null;
}

test('robots contre joueurs au hasard : coups toujours valides et nette supériorité', () => {
  const h = creerHasard(99);
  let scoreRobots = 0, scoreHasard = 0, victoiresRobots = 0, parties = 0, misesReussies = 0, mises = 0;
  for (let k = 0; k < 600; k++) {
    const n = 2 + (k % 7);
    const joueurs = Array.from({ length: n }, (_, i) => (i % 2 === 0 ? `R${i}` : `H${i}`));
    let e = creerPartie(joueurs, 1000 + k);
    let garde = 0;
    while (e.phase !== 'fin_partie') {
      if (++garde > 5000) throw new Error('boucle infinie');
      if (e.phase === 'fin_manche') {
        for (const r of e.historique.at(-1)!) if (r.joueur.startsWith('R')) { mises++; if (r.reussie) misesReussies++; }
        e = appliquer(e, { type: 'continuer' });
        continue;
      }
      let action: Action | null = null;
      for (const j of e.joueurs) {
        action = j.startsWith('R') ? actionRobot(e, j) : auHasard(e, j, h);
        if (action) break;
      }
      assert.ok(action, `aucune action possible en phase ${e.phase}`);
      e = appliquer(e, action!); // lève une erreur si le robot joue un coup interdit
    }
    const robots = joueurs.filter((j) => j.startsWith('R'));
    const autres = joueurs.filter((j) => j.startsWith('H'));
    scoreRobots += robots.reduce((s, j) => s + e.scores[j], 0) / robots.length;
    scoreHasard += autres.reduce((s, j) => s + e.scores[j], 0) / autres.length;
    const meilleur = [...joueurs].sort((a, b) => e.scores[b] - e.scores[a])[0];
    if (meilleur.startsWith('R')) victoiresRobots++;
    parties++;
  }
  const moyR = scoreRobots / parties, moyH = scoreHasard / parties;
  console.log(`  robots : ${moyR.toFixed(0)} pts/partie, hasard : ${moyH.toFixed(0)} pts/partie, victoires robots ${Math.round(100 * victoiresRobots / parties)} %, mises réussies ${Math.round(100 * misesReussies / mises)} %`);
  assert.ok(moyR > moyH + 100, 'les robots doivent nettement battre le hasard');
  assert.ok(victoiresRobots / parties > 0.75);
});

test('partie entièrement jouée par des robots, de 2 à 8 joueurs', () => {
  for (let n = 2; n <= 8; n++) {
    const joueurs = Array.from({ length: n }, (_, i) => `R${i}`);
    let e = creerPartie(joueurs, n * 7);
    while (e.phase !== 'fin_partie') {
      if (e.phase === 'fin_manche') { e = appliquer(e, { type: 'continuer' }); continue; }
      const a = joueurs.map((j) => actionRobot(e, j)).find(Boolean);
      assert.ok(a);
      e = appliquer(e, a!);
    }
    assert.equal(e.historique.length, 10);
  }
});
