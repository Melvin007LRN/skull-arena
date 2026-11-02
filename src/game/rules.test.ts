import { describe, expect, it } from "vitest";
import { resolveTrick } from "./rules";
import type { GameCard } from "./cards";

const mary: GameCard = {
  id: "mary-throne",
  name: "Mary Throne",
  type: "pirate",
  isExpansionCard: true,
  extension: "expansion_2025",
};

const greenFourteen: GameCard = {
  id: "green-14-test",
  name: "Vert 14",
  type: "number",
  suit: "green",
  value: 14,
  isExpansionCard: false,
};

const pirate: GameCard = {
  id: "pirate-test",
  name: "Pirate",
  type: "pirate",
  isExpansionCard: false,
};

describe("Pouvoir Mary Throne", () => {
  it("identifie Mary Throne comme gagnante lorsqu'elle remporte le pli", () => {
    const result = resolveTrick([
      { playerId: "mary-player", card: mary, order: 0 },
      { playerId: "other-player", card: greenFourteen, order: 1 },
    ]);

    expect(result.winnerPlayerId).toBe("mary-player");
    expect(result.maryThroneWinnerPlayerId).toBe("mary-player");
    expect(result.piratePowerTriggers).toEqual([]);
  });

  it("ne déclenche pas Mary Throne lorsqu'un autre Pirate remporte le pli", () => {
    const result = resolveTrick([
      { playerId: "other-player", card: pirate, order: 0 },
      { playerId: "mary-player", card: mary, order: 1 },
    ]);

    expect(result.winnerPlayerId).toBe("other-player");
    expect(result.maryThroneWinnerPlayerId).toBeNull();
  });

  it("ne déclenche pas Mary Throne si elle perd contre le Skull King", () => {
    const skullKing: GameCard = {
      id: "skull-king-test",
      name: "Skull King",
      type: "skull_king",
      isExpansionCard: false,
    };
    const result = resolveTrick([
      { playerId: "mary-player", card: mary, order: 0 },
      { playerId: "king-player", card: skullKing, order: 1 },
    ]);

    expect(result.winnerPlayerId).toBe("king-player");
    expect(result.maryThroneWinnerPlayerId).toBeNull();
  });
});
