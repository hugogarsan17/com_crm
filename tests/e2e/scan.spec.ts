import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { SHEET_LINES } from "../../src/features/scan/__fixtures__/consulta-abreviada";
import { hasCredentials, login } from "./helpers";

/**
 * Escaneo de la hoja «Consulta abreviada» con OCR real (Tesseract en el navegador).
 * Usa la hoja de ejemplo con datos inventados. Solo revisa: no guarda nada.
 */
test.describe("escaneo de hoja de póliza", () => {
  test.skip(!hasCredentials, "Requiere E2E_USER_A_* en .env.test.local");

  test("lee la hoja, rellena la revisión y no muestra el IBAN", async ({ page, browser }, testInfo) => {
    test.setTimeout(180_000);

    // Imagen de la hoja (ancho fijo, ligeramente girada como una foto).
    const dir = testInfo.outputPath();
    mkdirSync(dir, { recursive: true });
    const image = path.join(dir, "hoja-consulta.png");
    const doc = await browser.newPage({ viewport: { width: 1100, height: 520 } });
    await doc.setContent(
      `<body style="margin:0;background:#e9e6df"><pre style="margin:28px;padding:26px;background:#fff;font:17px/1.55 'Courier New',monospace;color:#111;transform:rotate(-0.6deg)">${SHEET_LINES.join("\n").replace(/&/g, "&amp;").replace(/</g, "&lt;")}</pre></body>`,
    );
    await doc.screenshot({ path: image });
    await doc.close();

    await login(page);
    await page.goto("/leads/new");
    await page.getByRole("link", { name: "Hoja de póliza" }).click();
    await page.locator("input[type=file]:not([capture])").setInputFiles(image);
    await expect(page.getByText("Ficha del cliente")).toBeVisible({ timeout: 150_000 });

    const value = (name: string) => page.locator(`[name="${name}"]`).inputValue();
    expect(await value("lead.full_name")).toBe("Maria Isabel Garcia Lopez");
    expect(await value("lead.phone")).toBe("600 123 456");
    expect(await value("lead.postal_code")).toBe("08172");
    expect(await value("lead.locality")).toBe("S Cugat del Valles");
    expect(await value("lead.customer_reference")).toBe("0012345678");
    expect(await value("policy.effect_date")).toBe("2019-03-01");
    expect(await value("policy.annual_premium")).toBe("245,40");
    expect(await value("policy.covered_until")).toBe("2026-12-31");
    expect(await value("policy.payment_frequency")).toBe("MEN");
    await expect(page.locator('[name="insured.2.nombre"]')).toHaveValue("LUCIA PEREZ GARCIA");
    // SER.DECESOS → seguro de decesos «Sí».
    await expect(page.getByRole("combobox", { name: /decesos/ })).toHaveText("Sí");
    // Nunca se muestra ni se envía el IBAN ni el domicilio de cobro.
    expect(await page.content()).not.toMatch(/ES12|BADALONA|PUERTO/);
  });
});
