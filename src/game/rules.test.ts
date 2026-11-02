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

describe("Contrôles Dernière Salve", () => {
  const lastVolley: GameCard = {
    id: "last-volley-test",
    name: "Dernière Salve",
    type: "last_volley",
    isExpansionCard: true,
  };
  const greenSix: GameCard = {
    id: "green-6-test",
    name: "Vert 6",
    type: "number",
    suit: "green",
    value: 6,
    isExpansionCard: false,
  };
  const greenTwelve: GameCard = {
    id: "green-12-test",
    name: "Vert 12",
    type: "number",
    suit: "green",
    value: 12,
    isExpansionCard: false,
  };

  it("refuse une seconde carte si Dernière Salve n'a pas été jouée en premier", () => {
    expect(() => resolveTrick([
      { playerId: "p1", card: greenSix, order: 0 },
      { playerId: "p2", card: greenTwelve, order: 1 },
      { playerId: "p1", card: lastVolley, order: 2 },
    ])).toThrow(/Dernière Salve/);
  });

  it("refuse deux joueurs qui rejouent dans le même pli", () => {
    const anotherLastVolley: GameCard = {
      ...lastVolley,
      id: "last-volley-test-2",
    };
    expect(() => resolveTrick([
      { playerId: "p1", card: lastVolley, order: 0 },
      { playerId: "p2", card: anotherLastVolley, order: 1 },
      { playerId: "p1", card: greenSix, order: 2 },
      { playerId: "p2", card: greenTwelve, order: 3 },
    ])).toThrow(/Dernière Salve/);
  });

  it("refuse une troisième carte du même joueur", () => {
    const extra: GameCard = {
      id: "green-9-test",
      name: "Vert 9",
      type: "number",
      suit: "green",
      value: 9,
      isExpansionCard: false,
    };
    expect(() => resolveTrick([
      { playerId: "p1", card: lastVolley, order: 0 },
      { playerId: "p2", card: greenSix, order: 1 },
      { playerId: "p1", card: greenTwelve, order: 2 },
      { playerId: "p1", card: extra, order: 3 },
    ])).toThrow(/Dernière Salve/);
  });
});
