import { describe, expect, it } from "vitest";
import { chooseBotCard, estimateBotBid } from "./bots";
import type { GameCard } from "./cards";

const card = (id: string, type: GameCard["type"], extra: Partial<GameCard> = {}): GameCard => ({
  id, name: id, type, isExpansionCard: false, ...extra,
});

describe("IA des bots", () => {
  it("ne propose jamais une enchère négative", () => {
    expect(estimateBotBid([], "expert")).toBe(0);
  });

  it("borne l'enchère au nombre de cartes en main", () => {
    const hand = [card("pirate", "pirate"), card("king", "skull_king")];
    expect(estimateBotBid(hand, "expert")).toBeLessThanOrEqual(hand.length);
  });

  it("choisit exclusivement une carte de sa propre main", () => {
    const hand = [card("green-4", "number", { suit: "green", value: 4 }), card("escape", "escape")];
    const choice = chooseBotCard({
      hand,
      playedCards: [],
      playerId: "bot-1",
      playersRemaining: 2,
      tricksRemaining: 1,
      difficulty: "normal",
    });
    expect(hand.some((item) => item.id === choice?.cardId)).toBe(true);
  });

  it("déclare un mode pour la Tigresse", () => {
    const hand = [card("tigress", "tigress")];
    const choice = chooseBotCard({
      hand,
      playedCards: [],
      playerId: "bot-1",
      playersRemaining: 3,
      tricksRemaining: 2,
      difficulty: "normal",
    });
    expect(["pirate", "escape"]).toContain(choice?.tigressMode);
  });

  it("ne déclare aucune couleur pour le Joker quand le noir est demandé", () => {
    const hand = [card("joker", "joker")];
    const choice = chooseBotCard({
      hand,
      playedCards: [{
        playerId: "player-1",
        card: card("black-14", "number", { suit: "black", value: 14 }),
        order: 0,
      }],
      playerId: "bot-1",
      playersRemaining: 2,
      tricksRemaining: 1,
      difficulty: "normal",
    });
    expect(choice?.chosenSuit).toBeNull();
  });

  it("suit la couleur demandée avec le Joker", () => {
    const hand = [card("joker", "joker")];
    const choice = chooseBotCard({
      hand,
      playedCards: [{
        playerId: "player-1",
        card: card("green-5", "number", { suit: "green", value: 5 }),
        order: 0,
      }],
      playerId: "bot-1",
      playersRemaining: 2,
      tricksRemaining: 1,
      difficulty: "normal",
    });
    expect(choice?.chosenSuit).toBe("green");
  });

  it("choisit une couleur non noire pour le Joker", () => {
    const hand = [card("joker", "joker")];
    const choice = chooseBotCard({
      hand,
      playedCards: [],
      playerId: "bot-1",
      playersRemaining: 3,
      tricksRemaining: 2,
      difficulty: "expert",
    });
    expect(["green", "purple", "yellow"]).toContain(choice?.chosenSuit);
  });
});
