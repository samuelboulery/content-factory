import { describe, it, expect } from "vitest";
import { parseEmails } from "@/lib/email-recipients";

describe("parseEmails", () => {
  it("sépare virgules / points-virgules / retours ligne", () => {
    expect(parseEmails("a@b.com, c@d.com;e@f.com\ng@h.com")).toEqual([
      "a@b.com",
      "c@d.com",
      "e@f.com",
      "g@h.com",
    ]);
  });

  it("filtre les entrées invalides", () => {
    expect(parseEmails("ok@x.com, pasunemail, @y.com")).toEqual(["ok@x.com"]);
  });

  it("normalise en minuscules et déduplique", () => {
    expect(parseEmails("A@B.com\na@b.com")).toEqual(["a@b.com"]);
  });

  it("chaîne vide → tableau vide", () => {
    expect(parseEmails("")).toEqual([]);
  });
});
