
import {
  BASE_DECK,
  buildDeck,
  validateDeck,
} from "./cards";

import {
  validateCardPlay,
  getPlayableCards,
} from "./validation";

import {
  calculateBidPoints,
  calculateRoundScores,
} from "./scoring";

import {
  resolveTrick,
} from "./rules";

import type {
  PlayedCard,
} from "./rules";

import type {
  GameCard,
} from "./cards";

export interface GameTestResult {
  name: string;
  passed: boolean;
  error?: string;
}

function assert(
  condition: boolean,
  message: string,
): void {
  if (!condition) {
    throw new Error(message);
  }
}

function makeCard(
  id: string,
  type: GameCard["type"],
  options: Partial<GameCard> = {},
): GameCard {
  return {
    id,
    name: id,
    type,
    isExpansionCard: false,
    ...options,
  };
}

function makePlay(
  playerId: string,
  card: GameCard,
  order: number,
  options: Partial<PlayedCard> = {},
): PlayedCard {
  return {
    playerId,
    card,
    order,
    ...options,
  };
}

/**
 * Exécute les tests du moteur SKULL ARENA.
 */
export function runGameTests(): GameTestResult[] {
  const results: GameTestResult[] = [];

  function test(
    name: string,
    callback: () => void,
  ): void {
    try {
      callback();

      results.push({
        name,
        passed: true,
      });
    } catch (error) {
      results.push({
        name,
        passed: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      });
    }
  }

  // TEST 1 : paquet de base
  test("Le paquet de base contient 70 cartes", () => {
    assert(
      BASE_DECK.length === 70,
      `Nombre incorrect : ${BASE_DECK.length}`,
    );
  });

  // TEST 2 : identifiants uniques
  test("Toutes les cartes possèdent un identifiant unique", () => {
    assert(
      validateDeck(BASE_DECK),
      "Des identifiants de cartes sont en double.",
    );
  });

  // TEST 3 : extensions désactivées
  test("Le paquet sans extensions contient 70 cartes", () => {
    const deck = buildDeck({
      loot: false,
      kraken: false,
      white_whale: false,
      expansion_2025: false,
      last_shot: false,
      second: false,
      spotted_stingray: false,
      davys_locker: false,
      walk_the_plank: false,
    });

    assert(
      deck.length === 70,
      `Le paquet contient ${deck.length} cartes au lieu de 70.`,
    );
  });

  // TEST 4 : paquet complet
  test("Le paquet complet contient 93 cartes", () => {
    const deck = buildDeck({
      loot: true,
      kraken: true,
      white_whale: true,
      expansion_2025: true,
      last_shot: true,
      second: true,
      spotted_stingray: true,
      davys_locker: true,
      walk_the_plank: true,
    });

    assert(
      deck.length === 93,
      `Le paquet contient ${deck.length} cartes au lieu de 93.`,
    );

    assert(
      validateDeck(deck),
      "Le paquet complet contient des doublons.",
    );
  });

  // TEST 5 : annonce exacte
  test("Une annonce de 2 plis réussie rapporte 40 points", () => {
    assert(
      calculateBidPoints(2, 2, 4) === 40,
      "Le calcul de l'annonce exacte est incorrect.",
    );
  });

  // TEST 6 : annonce ratée
  test("Une annonce de 2 plis avec 1 pli rapporte -10 points", () => {
    assert(
      calculateBidPoints(2, 1, 4) === -10,
      "La pénalité de l'annonce ratée est incorrecte.",
    );
  });

  // TEST 7 : annonce zéro réussie
  test("Une annonce zéro réussie rapporte 30 points en manche 3", () => {
    assert(
      calculateBidPoints(0, 0, 3) === 30,
      "Le calcul de l'annonce zéro est incorrect.",
    );
  });

  // TEST 8 : annonce zéro ratée
  test("Une annonce zéro ratée coûte 30 points en manche 3", () => {
    assert(
      calculateBidPoints(0, 1, 3) === -30,
      "La pénalité de l'annonce zéro est incorrecte.",
    );
  });

  // TEST 9 : couleur obligatoire
  test("Un joueur doit suivre la couleur s'il la possède", () => {
    const greenCard = BASE_DECK.find(
      (card) => card.id === "green-3",
    );

    const yellowCard = BASE_DECK.find(
      (card) => card.id === "yellow-4",
    );

    const greenLead = BASE_DECK.find(
      (card) => card.id === "green-8",
    );

    assert(
      !!greenCard && !!yellowCard && !!greenLead,
      "Cartes de test introuvables.",
    );

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [greenCard, yellowCard],
      playedCards: [
        makePlay("player-2", greenLead, 0),
      ],
      card: yellowCard,
    });

    assert(
      !result.valid,
      "Une carte d'une autre couleur a été autorisée.",
    );
  });

  // TEST 10 : carte de la bonne couleur
  test("Un joueur peut suivre la couleur demandée", () => {
    const greenCard = BASE_DECK.find(
      (card) => card.id === "green-3",
    );

    const greenLead = BASE_DECK.find(
      (card) => card.id === "green-8",
    );

    assert(
      !!greenCard && !!greenLead,
      "Cartes de test introuvables.",
    );

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [greenCard],
      playedCards: [
        makePlay("player-2", greenLead, 0),
      ],
      card: greenCard,
    });

    assert(result.valid, result.message);
  });

  // TEST 11 : bonus des cartes 14
  test("Le 14 noir rapporte 20 points de bonus", () => {
    const scores = calculateRoundScores(
      [
        {
          playerId: "player-1",
          bid: 1,
          tricksWon: 1,
          capturedCards: [
            BASE_DECK.find(
              (card) => card.id === "black-14",
            )!,
          ],
          capturedTricks: [],
        },
      ],
      {
        roundNumber: 1,
      },
    );

    assert(
      scores[0].bonusPoints === 20,
      "Le bonus du 14 noir est incorrect.",
    );
  });

  // TEST 12 : bonus des cartes 7 et 8
  test("Le 7 et le 8 de l'extension donnent -5 et +5", () => {
    const deck = buildDeck({
      expansion_2025: true,
    });

    const seven = deck.find(
      (card) => card.id === "exp-2025-green-7",
    );

    const eight = deck.find(
      (card) => card.id === "exp-2025-green-8",
    );

    assert(
      !!seven && !!eight,
      "Cartes d'extension introuvables.",
    );

    const scores = calculateRoundScores(
      [
        {
          playerId: "player-1",
          bid: 1,
          tricksWon: 1,
          capturedCards: [seven, eight],
          capturedTricks: [],
        },
      ],
      {
        roundNumber: 1,
      },
    );

    assert(
      scores[0].bonusPoints === 0,
      "Les bonus du 7 et du 8 ne s'annulent pas correctement.",
    );
  });

  // TEST 13 : un joueur ne peut pas jouer deux fois
  test("Un joueur ne peut pas jouer deux cartes dans le même pli", () => {
    const card = BASE_DECK.find(
      (item) => item.id === "green-2",
    );

    assert(!!card, "Carte introuvable.");

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [card],
      playedCards: [
        makePlay("player-1", card, 0),
      ],
      card,
    });

    assert(
      !result.valid,
      "Le système autorise deux cartes du même joueur.",
    );
  });

  // TEST 14 : résolution d'un pli simple
  test("La carte noire la plus forte remporte un pli", () => {
    const greenCard = BASE_DECK.find(
      (card) => card.id === "green-14",
    );

    const blackCard = BASE_DECK.find(
      (card) => card.id === "black-2",
    );

    assert(
      !!greenCard && !!blackCard,
      "Cartes de test introuvables.",
    );

    const result = resolveTrick([
      makePlay("player-1", greenCard, 0),
      makePlay("player-2", blackCard, 1),
    ]);

    assert(
      result.winnerPlayerId === "player-2",
      "La carte noire n'a pas remporté le pli.",
    );
  });

  // TEST 15 : Joker valeur 15
  test("Le Joker peut être joué avec la valeur 15", () => {
    const joker = makeCard("test-joker", "joker", {
      value: 15,
      selectableValue: [15],
      extension: "expansion_2025",
    });

    const greenLead = makeCard("test-green-14", "number", {
      suit: "green",
      value: 14,
    });

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [joker],
      playedCards: [
        makePlay("player-2", greenLead, 0),
      ],
      card: joker,
      chosenValue: 15,
      chosenSuit: "green",
      extensions: {
        expansion_2025: true,
      },
    });

    assert(result.valid, result.message);
  });

  // TEST 16 : couleur du Joker
  test("Le Joker ne peut pas prendre la couleur noire", () => {
    const joker = makeCard("test-joker-black", "joker", {
      value: 15,
      selectableValue: [15],
      extension: "expansion_2025",
    });

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [joker],
      playedCards: [],
      card: joker,
      chosenValue: 15,
      chosenSuit: "black",
      extensions: {
        expansion_2025: true,
      },
    });

    assert(
      !result.valid,
      "Le Joker a été autorisé en couleur noire.",
    );
  });

  // TEST 17 : Joker disponible dans la main
  test("Le Joker reste proposé lorsqu'il peut être joué", () => {
    const joker = makeCard("test-joker", "joker", {
      value: 15,
      selectableValue: [15],
      extension: "expansion_2025",
    });

    const greenLead = makeCard("test-green-8", "number", {
      suit: "green",
      value: 8,
    });

    const playable = getPlayableCards({
      playerId: "player-1",
      hand: [joker],
      playedCards: [
        makePlay("player-2", greenLead, 0),
      ],
      extensions: {
        expansion_2025: true,
      },
    });

    assert(
      playable.some((card) => card.id === joker.id),
      "Le Joker jouable n'apparaît pas dans les cartes proposées.",
    );
  });

  // TEST 18 : Tigresse en mode Fuite
  test("La Tigresse peut être jouée en mode Fuite", () => {
    const tigress = makeCard("test-tigress", "tigress");

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [tigress],
      playedCards: [],
      card: tigress,
      tigressMode: "escape",
    });

    assert(result.valid, result.message);
  });

  // TEST 19 : Tigresse sans déclaration
  test("La Tigresse exige un choix de mode", () => {
    const tigress = makeCard("test-tigress", "tigress");

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [tigress],
      playedCards: [],
      card: tigress,
    });

    assert(
      !result.valid,
      "La Tigresse a été autorisée sans déclaration.",
    );
  });

  // TEST 20 : Skull King contre Pirate
  test("Le Skull King bat un Pirate", () => {
    const skullKing = makeCard("test-skull", "skull_king");
    const pirate = makeCard("test-pirate", "pirate");

    const result = resolveTrick([
      makePlay("player-1", pirate, 0),
      makePlay("player-2", skullKing, 1),
    ]);

    assert(
      result.winnerPlayerId === "player-2",
      "Le Skull King n'a pas battu le Pirate.",
    );
  });

  // TEST 21 : Pirate contre Sirène
  test("Le Pirate bat la Sirène", () => {
    const pirate = makeCard("test-pirate", "pirate");
    const mermaid = makeCard("test-mermaid", "mermaid");

    const result = resolveTrick([
      makePlay("player-1", mermaid, 0),
      makePlay("player-2", pirate, 1),
    ]);

    assert(
      result.winnerPlayerId === "player-2",
      "Le Pirate n'a pas battu la Sirène.",
    );
  });

  // TEST 22 : Sirène contre Skull King
  test("La Sirène bat le Skull King", () => {
    const skullKing = makeCard("test-skull", "skull_king");
    const mermaid = makeCard("test-mermaid", "mermaid");

    const result = resolveTrick([
      makePlay("player-1", skullKing, 0),
      makePlay("player-2", mermaid, 1),
    ]);

    assert(
      result.winnerPlayerId === "player-2",
      "La Sirène n'a pas battu le Skull King.",
    );
  });

  // TEST 23 : Second contre Pirate
  test("Le Second bat un Pirate", () => {
    const second = makeCard("test-second", "second");
    const pirate = makeCard("test-pirate", "pirate");

    const result = resolveTrick([
      makePlay("player-1", pirate, 0),
      makePlay("player-2", second, 1),
    ]);

    assert(
      result.winnerPlayerId === "player-2",
      "Le Second n'a pas battu le Pirate.",
    );
  });

  // TEST 24 : Second contre Skull King
  test("Le Second perd contre le Skull King", () => {
    const second = makeCard("test-second", "second");
    const skullKing = makeCard("test-skull", "skull_king");

    const result = resolveTrick([
      makePlay("player-1", second, 0),
      makePlay("player-2", skullKing, 1),
    ]);

    assert(
      result.winnerPlayerId === "player-2",
      "Le Skull King n'a pas battu le Second.",
    );
  });

  // TEST 25 : Kraken
  test("Le Kraken empêche de remporter le pli", () => {
    const kraken = makeCard("test-kraken", "kraken");
    const greenCard = makeCard("test-green-10", "number", {
      suit: "green",
      value: 10,
    });

    const result = resolveTrick([
      makePlay("player-1", greenCard, 0),
      makePlay("player-2", kraken, 1),
    ]);

    assert(
      result.effect === "kraken",
      "L'effet Kraken n'a pas été détecté.",
    );

    assert(
      result.winnerPlayerId === null,
      "Un joueur a remporté le pli malgré le Kraken.",
    );

    assert(
      result.nextLeaderPlayerId === "player-1",
      "Le prochain leader hypothétique est incorrect.",
    );
  });

  // TEST 26 : Baleine blanche
  test("La Baleine blanche laisse gagner la plus forte valeur numérique", () => {
    const whale = makeCard("test-whale", "white_whale");
    const low = makeCard("test-green-4", "number", {
      suit: "green",
      value: 4,
    });
    const high = makeCard("test-black-14", "number", {
      suit: "black",
      value: 14,
    });

    const result = resolveTrick([
      makePlay("player-1", low, 0),
      makePlay("player-2", whale, 1),
      makePlay("player-3", high, 2),
    ]);

    assert(
      result.effect === "white_whale",
      "L'effet Baleine blanche n'a pas été détecté.",
    );

    assert(
      result.winnerPlayerId === "player-3",
      "La plus forte valeur numérique n'a pas gagné.",
    );
  });

  // TEST 27 : Raie tachetée
  test("La Raie tachetée laisse gagner la plus faible valeur numérique", () => {
    const stingray = makeCard(
      "test-stingray",
      "spotted_stingray",
    );

    const high = makeCard("test-green-12", "number", {
      suit: "green",
      value: 12,
    });

    const low = makeCard("test-yellow-2", "number", {
      suit: "yellow",
      value: 2,
    });

    const result = resolveTrick([
      makePlay("player-1", high, 0),
      makePlay("player-2", stingray, 1),
      makePlay("player-3", low, 2),
    ]);

    assert(
      result.effect === "spotted_stingray",
      "L'effet Raie tachetée n'a pas été détecté.",
    );

    assert(
      result.winnerPlayerId === "player-3",
      "La plus faible valeur numérique n'a pas gagné.",
    );
  });

  // TEST 28 : Supplice de la planche
  test("Le Supplice de la planche retire le Pirate ciblé", () => {
    const plank = makeCard(
      "test-plank",
      "walk_the_plank",
    );

    const pirate = makeCard("test-pirate", "pirate");

    const number = makeCard("test-green-10", "number", {
      suit: "green",
      value: 10,
    });

    const result = resolveTrick(
      [
        makePlay("player-1", pirate, 0),
        makePlay("player-2", plank, 1),
        makePlay("player-3", number, 2),
      ],
      {
        walkThePlankTargetPlayerId: "player-1",
      },
    );

    assert(
      result.removedPirates.length === 1,
      "Le Pirate n'a pas été retiré.",
    );

    assert(
      result.removedPirates[0].playerId === "player-1",
      "Le mauvais Pirate a été retiré.",
    );

    assert(
      result.winnerPlayerId === "player-3",
      "Le Pirate retiré a remporté le pli.",
    );
  });

  // TEST 29 : Casier de Davy Jones
  test("Le Casier détruit les Léviathans et donne 20 points par carte", () => {
    const locker = makeCard(
      "test-locker",
      "davys_locker",
    );

    const kraken = makeCard("test-kraken", "kraken");
    const whale = makeCard("test-whale", "white_whale");

    const number = makeCard("test-green-10", "number", {
      suit: "green",
      value: 10,
    });

    const result = resolveTrick([
      makePlay("player-1", kraken, 0),
      makePlay("player-2", locker, 1),
      makePlay("player-3", whale, 2),
      makePlay("player-4", number, 3),
    ]);

    assert(
      result.effect === "davys_locker",
      "L'effet Casier de Davy Jones n'a pas été détecté.",
    );

    assert(
      result.destroyedLeviathans === 2,
      "Le nombre de Léviathans détruits est incorrect.",
    );

    assert(
      result.bonusPoints === 40,
      "Le bonus de destruction est incorrect.",
    );

    assert(
      result.winnerPlayerId === "player-4",
      "La carte numérique restante n'a pas remporté le pli.",
    );
  });


  // TEST 30 : extension désactivée
  test("Une carte d'extension désactivée ne peut pas être jouée", () => {
    const expansionCard = makeCard("expansion-green-7", "number", {
      suit: "green",
      value: 7,
      extension: "expansion_2025",
      isExpansionCard: true,
    });

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [expansionCard],
      playedCards: [],
      card: expansionCard,
      extensions: { expansion_2025: false },
    });

    assert(!result.valid, "Une carte d'extension désactivée a été autorisée.");
  });

  // TEST 31 : Joker doit suivre la couleur
  test("Le Joker doit respecter la couleur demandée", () => {
    const joker = makeCard("test-joker", "joker", {
      value: 15,
      selectableValue: [15],
      extension: "expansion_2025",
      isExpansionCard: true,
    });
    const lead = makeCard("test-green-8", "number", {
      suit: "green",
      value: 8,
    });

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [joker],
      playedCards: [makePlay("player-2", lead, 0)],
      card: joker,
      chosenValue: 15,
      chosenSuit: "yellow",
      extensions: { expansion_2025: true },
    });

    assert(!result.valid, "Le Joker a pu ignorer la couleur demandée.");
  });

  // TEST 32 : valeur sélectionnable obligatoire
  test("Une carte 0/14 exige un choix explicite", () => {
    const card = makeCard("exp-green-0-14", "number", {
      suit: "green",
      selectableValue: [0, 14],
      extension: "expansion_2025",
      isExpansionCard: true,
    });

    const result = validateCardPlay({
      playerId: "player-1",
      hand: [card],
      playedCards: [],
      card,
      extensions: { expansion_2025: true },
    });

    assert(!result.valid, "La carte 0/14 a été jouée sans choisir sa valeur.");
  });

  // TEST 33 : égalité des cartes numériques
  test("En cas d'égalité numérique, la première carte jouée gagne", () => {
    const first = makeCard("green-10-first", "number", {
      suit: "green",
      value: 10,
    });
    const second = makeCard("green-10-second", "number", {
      suit: "green",
      value: 10,
    });

    const result = resolveTrick([
      makePlay("player-1", first, 0),
      makePlay("player-2", second, 1),
    ]);

    assert(result.winnerPlayerId === "player-1", "L'égalité n'a pas été départagée en faveur du premier joueur.");
  });


  // TEST 34 : pouvoir de Rosie
  test("Rosie déclenche le choix du prochain leader", () => {
    const rosie = makeCard("pirate-rosie", "pirate", { piratePower: "rosie" });
    const result = resolveTrick([makePlay("player-1", rosie, 0)]);
    assert(result.piratePowerTriggers.length === 1, "Le pouvoir de Rosie n'a pas été déclenché.");
    assert(result.piratePowerTriggers[0].playerId === "player-1", "Le pouvoir de Rosie est attribué au mauvais joueur.");
    assert(result.piratePowerTriggers[0].power === "rosie", "Le mauvais pouvoir est déclenché.");
  });

  // TEST 35 : pouvoir de Bendt
  test("Bendt déclenche son pouvoir de pioche et défausse", () => {
    const bendt = makeCard("pirate-bendt", "pirate", { piratePower: "bendt" });
    const result = resolveTrick([makePlay("player-1", bendt, 0)]);
    assert(result.piratePowerTriggers.some((trigger) => trigger.power === "bendt" && trigger.playerId === "player-1"), "Le pouvoir de Bendt n'a pas été déclenché.");
  });

  // TEST 36 : pouvoir de Rascal
  test("Rascal déclenche son pari supplémentaire", () => {
    const rascal = makeCard("pirate-rascal", "pirate", { piratePower: "rascal" });
    const result = resolveTrick([makePlay("player-1", rascal, 0)]);
    assert(result.piratePowerTriggers.some((trigger) => trigger.power === "rascal"), "Le pouvoir de Rascal n'a pas été déclenché.");
  });

  // TEST 37 : pouvoir de Juanita
  test("Juanita déclenche la consultation du paquet restant", () => {
    const juanita = makeCard("pirate-juanita", "pirate", { piratePower: "juanita" });
    const result = resolveTrick([makePlay("player-1", juanita, 0)]);
    assert(result.piratePowerTriggers.some((trigger) => trigger.power === "juanita"), "Le pouvoir de Juanita n'a pas été déclenché.");
  });

  // TEST 38 : pouvoir de Harry
  test("Harry déclenche la modification de son annonce", () => {
    const harry = makeCard("pirate-harry", "pirate", { piratePower: "harry" });
    const result = resolveTrick([makePlay("player-1", harry, 0)]);
    assert(result.piratePowerTriggers.some((trigger) => trigger.power === "harry"), "Le pouvoir de Harry n'a pas été déclenché.");
  });

  // TEST 39 : Mary Throne
  test("Mary Throne identifie son gagnant sans déclencher un pouvoir classique", () => {
    const mary = makeCard("mary-throne", "pirate");
    const result = resolveTrick([makePlay("player-1", mary, 0)]);
    assert(result.maryThroneWinnerPlayerId === "player-1", "Le gagnant de Mary Throne n'est pas identifié.");
    assert(result.piratePowerTriggers.length === 0, "Mary Throne déclenche à tort un pouvoir de Pirate classique.");
  });

  // TEST 40 : Second récupère les pouvoirs des Pirates capturés
  test("Second déclenche les pouvoirs des Pirates qu'il capture", () => {
    const rosie = makeCard("pirate-rosie", "pirate", { piratePower: "rosie" });
    const second = makeCard("test-second", "second");
    const result = resolveTrick([
      makePlay("player-1", rosie, 0),
      makePlay("player-2", second, 1),
    ]);
    assert(result.winnerPlayerId === "player-2", "Second n'a pas remporté le pli.");
    assert(result.piratePowerTriggers.some((trigger) => trigger.playerId === "player-2" && trigger.power === "rosie"), "Second n'a pas récupéré le pouvoir de Rosie.");
  });

  return results;
}

/**
 * Résumé des tests.
 */
export function getGameTestSummary(
  results: GameTestResult[],
) {
  const passed = results.filter(
    (result) => result.passed,
  ).length;

  const failed = results.length - passed;

  return {
    total: results.length,
    passed,
    failed,
    success: failed === 0,
  };
}
