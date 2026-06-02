import { describe, it, expect } from "vitest";
import { checkCompliance } from "@/lib/compliance";

// Post propre : longueur 600-1200, 0 exclamation, pas de superlatif/«nous», closing présente.
const CLEAN = "On organise un événement. ".repeat(30) + "On se voit là-bas.";

describe("checkCompliance", () => {
  it("post conforme → score 100, aucune violation", () => {
    const r = checkCompliance(CLEAN);
    expect(r.score).toBe(100);
    expect(r.violations).toEqual([]);
    expect(r.infos).not.toContain("Pas de closing formula habituelle");
  });

  it("plus de 3 exclamations → violation, score 75", () => {
    const r = checkCompliance(CLEAN + "!!!!");
    expect(r.score).toBe(75);
    expect(r.violations).toContain("Plus de 3 points d'exclamation");
  });

  it("« nous » → violation", () => {
    const r = checkCompliance(CLEAN.replace("On organise", "nous organisons"));
    expect(r.violations).toContain("'Nous' détecté (utiliser 'on')");
  });

  it("superlatif creux → violation", () => {
    const r = checkCompliance(CLEAN + " C'est génial.");
    expect(r.violations.some((v) => v.includes("génial"))).toBe(true);
  });

  it("trop court → violation de longueur", () => {
    const r = checkCompliance("Trop court.");
    expect(r.violations.some((v) => v.includes("Longueur"))).toBe(true);
  });

  it("[À COMPLÉTER] → info (pas une violation)", () => {
    const r = checkCompliance(CLEAN + " [À COMPLÉTER : lieu]");
    expect(r.infos).toContain("Trou factuel à compléter");
  });

  it("sans closing formula → info", () => {
    const r = checkCompliance("On organise un événement. ".repeat(30));
    expect(r.infos).toContain("Pas de closing formula habituelle");
  });
});
