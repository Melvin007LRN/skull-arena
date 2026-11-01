import { describe, it, expect } from "vitest";
import { runGameTests } from "./tests";

describe("Moteur de jeu SKULL ARENA", () => {
  const results = runGameTests();

  for (const result of results) {
    it(result.name, () => {
      expect(
        result.passed,
        result.error ?? "Le test a échoué"
      ).toBe(true);
    });
  }
});
