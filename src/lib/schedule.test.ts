import { describe, it, expect } from "vitest";
import { parseISO } from "date-fns";
import { findFreeDate } from "@/lib/schedule";

const base = parseISO("2026-06-10");

describe("findFreeDate", () => {
  it("aucune date occupée → renvoie la date de base", () => {
    expect(findFreeDate(base, new Set())).toBe("2026-06-10");
  });

  it("date de base occupée → préfère le jour plus tôt (base-1)", () => {
    expect(findFreeDate(base, new Set(["2026-06-10"]))).toBe("2026-06-09");
  });

  it("base et base-1 occupées → base+1", () => {
    const occupied = new Set(["2026-06-10", "2026-06-09"]);
    expect(findFreeDate(base, occupied)).toBe("2026-06-11");
  });

  it("à distance égale, préfère le plus tôt", () => {
    // base occupée, base-1 et base+1 libres → -1 choisi
    expect(findFreeDate(base, new Set(["2026-06-10"]))).toBe("2026-06-09");
  });
});
