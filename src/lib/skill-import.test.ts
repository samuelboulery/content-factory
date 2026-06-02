import { describe, it, expect } from "vitest";
import { parseSkillCharter } from "@/lib/skill-import";

describe("parseSkillCharter", () => {
  it("retire le frontmatter YAML et renvoie le corps", () => {
    const raw = `---\nname: tds\ndescription: x\n---\nLe corps de la charte.`;
    expect(parseSkillCharter(raw)).toBe("Le corps de la charte.");
  });

  it("sans frontmatter → tout le contenu trimmé", () => {
    expect(parseSkillCharter("  Juste du texte.  ")).toBe("Juste du texte.");
  });

  it("retire le BOM en tête", () => {
    expect(parseSkillCharter("﻿Avec BOM")).toBe("Avec BOM");
  });
});
