import { describe, expect, it } from "vitest";
import { createSoloMatch, playSoloCard, submitSoloBid } from "./solo";

describe("moteur local solo", () => {
  it("crée une partie sans identifiants Supabase et avec le nombre de bots demandé", () => {
    const match = createSoloMatch({ botCount: 3, difficulty: "normal", username: "Capitaine" });
    expect(match.players).toHaveLength(4);
    expect(match.players[0].id).toBe("solo-human");
    expect(match.players.slice(1).every((player) => player.id.startsWith("solo-bot-"))).toBe(true);
    expect(match.players.every((player) => player.hand.length === 1)).toBe(true);
  });

  it("refuse une enchère hors limites et accepte une enchère valide", () => {
    const match = createSoloMatch({ botCount: 2, difficulty: "easy", username: "Test" });
    expect(submitSoloBid(match, -1)).toBe(match);
    const started = submitSoloBid(match, 0);
    expect(started.phase).toBe("playing");
    expect(started.players[0].bid).toBe(0);
  });

  it("ne permet pas de jouer une carte absente de la main", () => {
    const match = submitSoloBid(
      createSoloMatch({ botCount: 1, difficulty: "normal", username: "Test" }),
      0,
    );
    const after = playSoloCard(match, "solo-human", "not-in-hand");
    expect(after).toBe(match);
  });

  it("n'autorise pas un joueur à jouer hors de son tour", () => {
    const match = submitSoloBid(
      createSoloMatch({ botCount: 1, difficulty: "normal", username: "Test" }),
      0,
    );
    const bot = match.players.find((player) => !player.isHuman)!;
    const after = playSoloCard(match, bot.id, bot.hand[0].id);
    expect(after).toBe(match);
  });
});
