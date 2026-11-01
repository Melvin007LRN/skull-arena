import type { GameCard } from "./cards";

import type { PlayedCard, TigressMode } from "./rules";

import { describe, expect, it } from "vitest";
import { validateCardPlay, determineLeadSuit } from "./validation";

const pirate: GameCard = {
  id: "pirate-test",
  name: "Pirate test",
  type: "pirate",
  isExpansionCard: false,
};

const greenThree: GameCard = {
  id: "green-3-test",
  name: "Vert 3",
  type: "number",
  suit: "green",
  value: 3,
  isExpansionCard: false,
};

const yellowFour: GameCard = {
  id: "yellow-4-test",
  name: "Jaune 4",
  type: "number",
  suit: "yellow",
  value: 4,
  isExpansionCard: false,
};

const escape: GameCard = {
  id: "escape-test",
  name: "Fuite",
  type: "escape",
  isExpansionCard: false,
};

function play(playerId: string, card: GameCard, order: number, tigressMode?: TigressMode): PlayedCard {
  return { playerId, card, order, ...(tigressMode ? { tigressMode } : {}) };
}

describe("Détermination de la couleur demandée", () => {
  it("n'impose aucune couleur si le pli commence par un Pirate", () => {
    const played = [play("p1", pirate, 0), play("p2", greenThree, 1)];
    expect(determineLeadSuit(played)).toBeNull();
    expect(validateCardPlay({
      playerId: "p3",
      hand: [greenThree, yellowFour],
      playedCards: played,
      card: yellowFour,
    }).valid).toBe(true);
  });

  it.each(["skull_king", "second"] as const)(
    "n'impose aucune couleur si le pli commence par %s",
    (type) => {
      const special: GameCard = {
        id: `${type}-test`,
        name: type,
        type,
        isExpansionCard: false,
      };
      expect(determineLeadSuit([
        play("p1", special, 0),
        play("p2", greenThree, 1),
      ])).toBeNull();
    },
  );

  it("ignore une carte Fuite avant la première carte numérique", () => {
    expect(determineLeadSuit([
      play("p1", escape, 0),
      play("p2", greenThree, 1),
    ])).toBe("green");
  });

  it("ignore une Tigresse jouée en mode Pirate avant la première carte numérique", () => {
    const tigress: GameCard = {
      id: "tigress-test",
      name: "Tigresse",
      type: "tigress",
      isExpansionCard: false,
    };
    expect(determineLeadSuit([
      play("p1", tigress, 0, "pirate"),
      play("p2", greenThree, 1),
    ])).toBeNull();
  });

  it("renvoie null si le pli ne contient aucune carte de couleur", () => {
    expect(determineLeadSuit([play("p1", pirate, 0), play("p2", escape, 1)])).toBeNull();
  });
});
