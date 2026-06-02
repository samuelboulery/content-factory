import { describe, it, expect } from "vitest";
import { getNetworkCharter, mergeNetworkCharter } from "@/lib/network-charter";
import type { Workspace } from "@/lib/types";

function ws(network_charters: Record<string, string>): Workspace {
  return { network_charters } as unknown as Workspace;
}

describe("getNetworkCharter", () => {
  it("renvoie l'overlay trimmé", () => {
    expect(getNetworkCharter(ws({ LinkedIn: "  ton pro  " }), "LinkedIn")).toBe(
      "ton pro",
    );
  });

  it("réseau sans overlay → chaîne vide", () => {
    expect(getNetworkCharter(ws({ LinkedIn: "x" }), "Instagram")).toBe("");
  });
});

describe("mergeNetworkCharter", () => {
  it("sans overlay → charte de base inchangée", () => {
    expect(mergeNetworkCharter("BASE", "", "LinkedIn")).toBe("BASE");
  });

  it("avec overlay → base + bloc réseau", () => {
    const merged = mergeNetworkCharter("BASE", "OVERLAY", "Instagram");
    expect(merged).toContain("BASE");
    expect(merged).toContain("OVERLAY");
    expect(merged).toContain('reseau="Instagram"');
  });
});
