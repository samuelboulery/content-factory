import { test, expect } from "@playwright/test";

// Smoke public : ne nécessite pas d'auth ni de Supabase (page de connexion = client).
test.describe("smoke public", () => {
  test("la page de connexion s'affiche", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Content Factory")).toBeVisible();
    await expect(page.getByLabel("E-mail")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /lien magique/i }),
    ).toBeVisible();
  });

  test("page d'invitation invalide → message d'erreur", async ({ page }) => {
    // Token bidon : la fonction publique renvoie rien → invitation invalide.
    await page.goto("/invite/00000000-0000-0000-0000-000000000000");
    await expect(
      page.getByText(/invitation invalide|expir/i),
    ).toBeVisible();
  });
});
