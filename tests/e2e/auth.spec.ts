import { expect, test } from "@playwright/test";
import { hasCredentials, login } from "./helpers";

test.describe("rutas privadas", () => {
  for (const path of ["/dashboard", "/leads", "/leads/new", "/tasks", "/reports", "/settings"]) {
    test(`${path} redirige a /login sin sesión`, async ({ page }) => {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%2F/g, "(%2F|/)")}`));
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    });
  }

  test("las exportaciones exigen sesión", async ({ request }) => {
    const res = await request.get("/api/export/leads");
    expect(res.status()).toBe(401);
  });
});

test.describe("formularios de autenticación", () => {
  test("el registro valida los campos en español", async ({ page }) => {
    await page.goto("/register");
    await page.getByLabel("Nombre y apellidos").fill("A");
    await page.getByLabel("Email").fill("no-es-email");
    await page.locator("#field-password").fill("corta");
    await page.getByLabel("Repite la contraseña").fill("otra");
    await page.getByRole("button", { name: "Crear cuenta" }).click();
    await expect(page.getByText("Introduce un email válido")).toBeVisible();
    await expect(page.getByText(/al menos 8 caracteres/)).toBeVisible();
  });

  test("muestra un error claro con credenciales incorrectas", async ({ page }) => {
    test.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL && !hasCredentials, "Requiere Supabase configurado");
    await page.goto("/login");
    await page.getByLabel("Email").fill("nadie@cartera-crm.test");
    await page.getByLabel("Contraseña").fill("ContraseñaFalsa123");
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    await expect(page.getByText("Email o contraseña incorrectos.")).toBeVisible();
  });

  test("la recuperación de contraseña es accesible", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "He olvidado mi contraseña" }).click();
    await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
  });

  test("login, redirección del usuario autenticado y logout", async ({ page }) => {
    test.skip(!hasCredentials, "Requiere E2E_USER_A_* en .env.test.local");
    await login(page);
    await page.goto("/login");
    await expect(page).toHaveURL(/\/dashboard/);
    await page.getByRole("button", { name: "Cerrar sesión" }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
