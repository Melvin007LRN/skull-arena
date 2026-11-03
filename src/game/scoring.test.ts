import { describe, expect, it } from "vitest";
import { calculateFourteenBonuses } from "./scoring";
import type { GameCard } from "./cards";
import type { PlayedCard } from "./rules";

const extensionZeroFourteen: GameCard = {
  id: "exp-2025-green-0-14",
  name: "Vert 0/14",
  type: "number",
  suit: "green",
  selectableValue: [0, 14],
  extension: "expansion_2025",
  isExpansionCard: true,
};

describe("bonus des cartes 14", () => {
  it("attribue le bonus à une carte 0/14 jouée avec la valeur 14", () => {
    const play: PlayedCard = {
      playerId: "solo-human",
      card: extensionZeroFourteen,
      order: 0,
      chosenValue: 14,
    };

    expect(calculateFourteenBonuses([play])).toBe(10);
  });

  it("n'attribue pas le bonus à une carte 0/14 jouée avec la valeur zéro", () => {
    const play: PlayedCard = {
      playerId: "solo-human",
      card: extensionZeroFourteen,
      order: 0,
      chosenValue: 0,
    };

    expect(calculateFourteenBonuses([play])).toBe(0);
  });

  it("conserve les bonus des cartes 14 imprimées", () => {
    const greenFourteen: GameCard = {
      id: "green-14",
      name: "Vert 14",
      type: "number",
      suit: "green",
      value: 14,
      isExpansionCard: false,
    };
    const blackFourteen: GameCard = {
      id: "black-14",
      name: "Noir 14",
      type: "number",
      suit: "black",
      value: 14,
      isExpansionCard: false,
    };

    expect(calculateFourteenBonuses([greenFourteen, blackFourteen])).toBe(30);
  });
});
