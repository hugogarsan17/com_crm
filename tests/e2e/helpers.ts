import { expect, type Page } from "@playwright/test";

export const userA = { email: process.env.E2E_USER_A_EMAIL ?? "", password: process.env.E2E_USER_A_PASSWORD ?? "" };
export const hasCredentials = Boolean(userA.email && userA.password);

export async function login(page: Page, user = userA) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Contraseña").fill(user.password);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Selecciona una opción en un Select de shadcn/Radix por su etiqueta. */
export async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("combobox", { name: label }).click();
  await page.getByRole("option", { name: option, exact: typeof option === "string" }).click();
}

export function uniqueName(prefix: string) {
  return `${prefix} ${Date.now().toString(36)}`;
}
