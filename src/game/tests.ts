import {
  BASE_DECK,
  buildDeck,
  validateDeck,
} from "./cards";

import { validateCardPlay } from "./validation";

import {
  calculateBidPoints,
  calculateRoundScores,
} from "./scoring";

import { resolveTrick } from "./rules";

import type { PlayedCard } from "./rules";

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
        {
          playerId: "player-2",
          card: greenLead,
          order: 0,
        },
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
        {
          playerId: "player-2",
          card: greenLead,
          order: 0,
        },
      ],
      card: greenCard,
    });

    assert(
      result.valid,
      result.message,
    );
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
        {
          playerId: "player-1",
          card,
          order: 0,
        },
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

    const plays: PlayedCard[] = [
      {
        playerId: "player-1",
        card: greenCard,
        order: 0,
      },
      {
        playerId: "player-2",
        card: blackCard,
        order: 1,
      },
    ];

    const result = resolveTrick(plays);

    assert(
      result.winnerPlayerId === "player-2",
      "La carte noire n'a pas remporté le pli.",
    );
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
