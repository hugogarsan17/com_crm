import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { choose, hasCredentials, login, uniqueName } from "./helpers";

test.describe("flujo del comercial", () => {
  test.skip(!hasCredentials, "Requiere E2E_USER_A_* en .env.test.local");
  test.describe.configure({ mode: "serial" });

  test("crear, buscar, editar, contactar, seguimiento, póliza, archivar y eliminar", async ({ page }) => {
    const name = uniqueName("Cliente Demo");
    await login(page);

    // Crear ficha
    await page.goto("/leads/new");
    await page.getByRole("button", { name: "Crear ficha" }).click();
    await expect(page.getByText("El nombre es obligatorio")).toBeVisible();
    await page.getByLabel("Nombre y apellidos").fill(name);
    await page.getByLabel("Teléfono").fill("12");
    await page.getByRole("button", { name: "Crear ficha" }).click();
    await expect(page.getByText(/Teléfono no válido/)).toBeVisible();
    await page.getByLabel("Teléfono").fill("600 123 987");
    await page.getByLabel("Email").fill("cliente.demo@example.test");
    await page.getByLabel("Producto a ofrecer").fill("Hogar");
    await page.getByRole("button", { name: "Crear ficha" }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("Pendiente de contactar").first()).toBeVisible();
    const leadUrl = page.url();

    // Buscar
    await page.goto("/leads");
    await page.getByLabel("Buscar fichas").fill("123 987");
    await expect(page.getByRole("link", { name }).first()).toBeVisible();

    // Editar
    await page.goto(`${leadUrl}/edit`);
    await page.getByLabel("Localidad").fill("Villa Ejemplo");
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await expect(page.getByText("Villa Ejemplo")).toBeVisible();

    // Registrar llamada con seguimiento
    await page.getByRole("button", { name: "Registrar contacto" }).click();
    const dialog = page.getByRole("dialog");
    await choose(page, "Resultado", "Interesado");
    await dialog.getByLabel("Resumen").fill("Le interesa el seguro de hogar");
    await expect(dialog.getByLabel("Qué hacer")).toBeVisible();
    await dialog.getByLabel("Qué hacer").fill("Enviar presupuesto");
    await dialog.getByRole("button", { name: "Guardar contacto" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByText("Llamada · Interesado")).toBeVisible();
    await expect(page.getByText("Le interesa el seguro de hogar")).toBeVisible();
    await expect(page.getByText("Enviar presupuesto").first()).toBeVisible();
    await expect(page.getByText("Interesado", { exact: true }).first()).toBeVisible();

    // El seguimiento aparece en Próximas y se completa
    await page.goto("/tasks?view=upcoming");
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Marcar como completada" }).click();
    await expect(page.getByText("Seguimiento completado")).toBeVisible();
    await page.goto("/tasks?view=completed");
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible();

    // Registrar póliza contratada con comisión manual
    await page.goto(leadUrl);
    await page.getByRole("button", { name: "Póliza", exact: true }).click();
    const policy = page.getByRole("dialog");
    await policy.getByLabel("Prima (€)").fill("-5");
    await policy.getByRole("button", { name: "Registrar póliza" }).click();
    await expect(policy.getByText("El importe no puede ser negativo")).toBeVisible();
    await policy.getByLabel("Prima (€)").fill("320,00");
    await policy.getByLabel("Comisión estimada (€)").fill("32,50");
    await policy.getByLabel("Comisión confirmada (€)").fill("30");
    await choose(page, "Estado de la comisión", "Confirmada");
    await policy.getByRole("button", { name: "Registrar póliza" }).click();
    await expect(policy).toBeHidden();
    await expect(page.getByText("Póliza contratada").first()).toBeVisible();
    await expect(page.getByText("Comisión confirmada")).toBeVisible();
    await expect(page.getByText(/Estimada 32,50\s€/)).toBeVisible();

    // El panel refleja los datos reales
    await page.goto("/dashboard");
    const policiesTile = page.locator("p", { hasText: /^Pólizas contratadas$/ }).locator("..").locator("..");
    await expect(policiesTile).not.toContainText(/^Pólizas contratadas0$/);
    await expect(page.locator("p", { hasText: /^Comisión confirmada$/ }).first()).toBeVisible();

    // Archivar y restaurar
    await page.goto(leadUrl);
    await page.getByRole("button", { name: "Más acciones de la ficha" }).click();
    await page.getByRole("menuitem", { name: "Archivar ficha" }).click();
    await expect(page.getByText(/Ficha archivada el/)).toBeVisible();
    await page.goto("/leads?view=archived");
    await expect(page.getByRole("link", { name }).first()).toBeVisible();

    // Eliminar definitivamente (limpieza)
    await page.goto(leadUrl);
    await page.getByRole("button", { name: "Más acciones de la ficha" }).click();
    await page.getByRole("menuitem", { name: "Eliminar definitivamente" }).click();
    await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
    await page.getByRole("button", { name: "Eliminar", exact: true }).click();
    await expect(page).toHaveURL(/\/leads$/);
  });

  test("cerrar como rechazada y como mantiene condiciones", async ({ page }) => {
    await login(page);
    for (const [label, status] of [
      ["Rechazada", "Rechazado"],
      ["Mantiene condiciones", "Mantiene condiciones"],
    ] as const) {
      const name = uniqueName(`Cierre ${label}`);
      await page.goto("/leads/new");
      await page.getByLabel("Nombre y apellidos").fill(name);
      await page.getByRole("button", { name: "Crear ficha" }).click();
      await expect(page.getByRole("heading", { name })).toBeVisible();
      await page.getByRole("button", { name: "Más acciones de la ficha" }).click();
      await page.getByRole("menuitem", { name: label }).click();
      await page.getByLabel("Motivo (opcional)").fill("Precio");
      await page.getByRole("button", { name: `Marcar como «${status}»` }).click();
      await expect(page.getByText("Motivo de cierre")).toBeVisible();
      await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
      // limpieza
      await page.getByRole("button", { name: "Más acciones de la ficha" }).click();
      await page.getByRole("menuitem", { name: "Eliminar definitivamente" }).click();
      await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page).toHaveURL(/\/leads$/);
    }
  });

  test("importación CSV con errores y duplicados", async ({ page }, testInfo) => {
    const tag = Date.now().toString(36);
    mkdirSync(testInfo.outputDir, { recursive: true });
    const file = path.join(testInfo.outputDir, "fichas.csv");
    writeFileSync(
      file,
      [
        "Nombre;Teléfono;Email;Referencia;Producto",
        `Import Uno ${tag};611${tag.slice(-6).replace(/\D/g, "0").padStart(6, "0")};uno-${tag}@example.test;R-${tag}-1;Vida`,
        `Import Dos ${tag};;dos-${tag}@example.test;R-${tag}-2;Auto`,
        `Import Repetido ${tag};;uno-${tag}@example.test;;Vida`,
        `;600000000;mal;;`,
      ].join("\n"),
    );
    await login(page);
    await page.goto("/leads/import");
    await page.locator("#csv-file").setInputFiles(file);
    await expect(page.getByText("Asigna las columnas")).toBeVisible();
    await page.getByRole("button", { name: "Validar filas" }).click();
    await expect(page.getByText("Revisa antes de importar")).toBeVisible();
    await expect(page.getByText(/Duplicado por email con Import Uno/)).toBeVisible();
    await expect(page.getByText(/Falta el nombre/)).toBeVisible();
    await page.getByRole("button", { name: "Importar 2 fichas" }).click();
    await expect(page.getByText("2 fichas importadas")).toBeVisible();

    // Reimportar el mismo archivo: todas las válidas son duplicadas de fichas existentes.
    await page.getByRole("button", { name: "Importar otro archivo" }).click();
    await page.locator("#csv-file").setInputFiles(file);
    await page.getByRole("button", { name: "Validar filas" }).click();
    await expect(page.getByText(/Duplicado por teléfono con la ficha Import Uno|Duplicado por email con la ficha Import Uno/).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Importar 0 fichas" })).toBeDisabled();

    // Limpieza
    for (const n of [`Import Uno ${tag}`, `Import Dos ${tag}`]) {
      await page.goto(`/leads?q=${encodeURIComponent(n)}`);
      await page.getByRole("link", { name: n }).first().click();
      await page.getByRole("button", { name: "Más acciones de la ficha" }).click();
      await page.getByRole("menuitem", { name: "Eliminar definitivamente" }).click();
      await page.getByLabel("Escribe ELIMINAR para confirmar").fill("ELIMINAR");
      await page.getByRole("button", { name: "Eliminar", exact: true }).click();
      await expect(page).toHaveURL(/\/leads$/);
    }
  });

  test("navegación móvil @mobile", async ({ page }) => {
    await login(page);
    const nav = page.getByRole("navigation", { name: "Navegación rápida" });
    await expect(nav).toBeVisible();
    await nav.getByRole("link", { name: "Fichas" }).click();
    await expect(page).toHaveURL(/\/leads/);
    await expect(page.getByRole("heading", { name: "Fichas de clientes" })).toBeVisible();
  });
});
